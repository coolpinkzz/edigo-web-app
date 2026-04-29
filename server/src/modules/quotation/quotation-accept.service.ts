import mongoose from "mongoose";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";
import { assertDocumentBranchAccess } from "../../types/branch-scope";
import type { JwtPayload } from "../../types/express";
import { ROLES } from "../../types/roles";
import { Installment } from "../fee/installment.model";
import {
  ensurePayTokenForTarget,
  lumpReminderKey,
} from "../reminder/reminder.service";
import { createStudent, getTenantType } from "../student/student.service";
import type { StudentClass, StudentSection } from "../student/student.model";
import { Quotation, IQuotation } from "./quotation.model";
import { persistQuotationExpiredIfNeeded } from "./quotation.service";

const SCOPE = "quotation.accept";

function assertRazorpayReady(): void {
  if (!env.razorpayKeyId?.trim() || !env.razorpayKeySecret?.trim()) {
    throw new Error(
      "Online payment is not configured on the server (Razorpay keys missing)",
    );
  }
}

export function assertPublicPdfToken(doc: IQuotation, token: string): void {
  const t = token.trim();
  if (!doc.pdfAccessToken || doc.pdfAccessToken !== t) {
    throw new Error("Invalid or missing access token");
  }
  if (
    !doc.pdfAccessExpiresAt ||
    doc.pdfAccessExpiresAt.getTime() < Date.now()
  ) {
    throw new Error("This quotation link has expired");
  }
}

function checkoutPayTokenTtlMs(): number {
  return Math.max(1, env.quotationPdfTokenTtlDays) * 24 * 60 * 60 * 1000;
}

async function resolveInstallmentKeyForFirstPayment(
  feeId: string,
): Promise<string> {
  const inst = await Installment.findOne({ feeId })
    .sort({ dueDate: 1 })
    .select("_id")
    .lean()
    .exec();
  if (inst?._id) {
    return inst._id.toString();
  }
  return lumpReminderKey(feeId);
}

export type AcceptQuotationPreparePaymentInput = {
  quotationId: string;
  /** Required for public accept (same token as PDF link). Omitted for staff. */
  pdfAccessToken?: string;
  accessUser?: JwtPayload;
  schoolClass?: string;
  schoolSection?: string;
};

/**
 * Creates student + fee (once), ensures pay token, returns Razorpay checkout URL (`GET /pay/:token`).
 * Idempotent: safe to call again for the same quotation while payment is pending.
 */
export async function acceptQuotationPreparePayment(
  input: AcceptQuotationPreparePaymentInput,
): Promise<{ payUrl: string; quotationRef: string }> {
  assertRazorpayReady();
  if (!mongoose.isValidObjectId(input.quotationId)) {
    throw new Error("Invalid quotation id");
  }

  const doc = await Quotation.findById(input.quotationId).exec();
  if (!doc) {
    throw new Error("Quotation not found");
  }

  const liveStatus = await persistQuotationExpiredIfNeeded(doc);

  if (liveStatus === "DRAFT") {
    throw new Error(
      "This quotation has not been sent yet. Ask the institute to send it first.",
    );
  }
  if (liveStatus === "EXPIRED") {
    throw new Error("This quotation has expired");
  }
  if (liveStatus === "REJECTED") {
    throw new Error("This quotation was rejected");
  }
  if (liveStatus === "ACCEPTED") {
    throw new Error("This quotation is already accepted");
  }

  if (liveStatus !== "SENT" && liveStatus !== "PENDING_PAYMENT") {
    throw new Error("Quotation cannot be accepted in its current state");
  }

  const staff = input.accessUser;
  if (staff) {
    if (staff.role !== ROLES.SUPER_ADMIN) {
      assertDocumentBranchAccess(staff, doc.branchId);
    }
  } else {
    if (!input.pdfAccessToken?.trim()) {
      throw new Error("Access token is required");
    }
    assertPublicPdfToken(doc, input.pdfAccessToken);
  }

  const tenantId = doc.tenantId;
  const tenantType = await getTenantType(tenantId);

  let studentId: string | undefined = doc.conversionStudentId?.trim();
  let feeId: string | undefined = doc.conversionFeeId?.trim();

  if (!studentId || !feeId) {
    const courseId = doc.courseId?.trim();
    if (tenantType === "ACADEMY") {
      if (!courseId) {
        throw new Error(
          "This quotation does not list a catalog course; online enrolment is not available. Contact the institute.",
        );
      }
    }

    let cls = input.schoolClass?.trim() as StudentClass | undefined;
    let sec = input.schoolSection?.trim() as StudentSection | undefined;
    if (tenantType === "SCHOOL") {
      if (!cls) cls = doc.schoolClass as StudentClass | undefined;
      if (!sec) sec = doc.schoolSection as StudentSection | undefined;
    }
    if (tenantType === "SCHOOL") {
      if (!cls || !sec) {
        throw new Error("Class and section are required for school enrolment");
      }
    }

    const created = await createStudent(tenantId, {
      studentName: doc.name,
      parentName: doc.parentName,
      parentPhoneNumber: doc.phone,
      parentEmail: doc.email,
      gender: doc.gender,
      age: doc.age,
      address: doc.address,
      branchId: doc.branchId,
      courseId: tenantType === "ACADEMY" ? courseId : undefined,
      class: tenantType === "SCHOOL" ? cls : undefined,
      section: tenantType === "SCHOOL" ? sec : undefined,
      feeTemplateId: doc.feeTemplateId,
      feeTemplateDiscountPercent: doc.discountPercent,
      assignmentAnchorDate: new Date(),
      status: "ACTIVE",
    });

    const feeFromTemplate =
      "feeFromTemplate" in created ? created.feeFromTemplate : undefined;
    if (!feeFromTemplate?.id) {
      throw new Error("Fee could not be created from the quotation template");
    }

    const claim = await Quotation.findOneAndUpdate(
      {
        _id: doc._id,
        $or: [
          { conversionStudentId: { $exists: false } },
          { conversionStudentId: null },
          { conversionStudentId: "" },
        ],
      },
      {
        $set: {
          conversionStudentId: created.id,
          conversionFeeId: feeFromTemplate.id,
          status: "PENDING_PAYMENT",
        },
      },
      { new: true },
    ).exec();

    if (claim) {
      studentId = created.id;
      feeId = feeFromTemplate.id;
    } else {
      const again = await Quotation.findById(doc._id).exec();
      studentId = again?.conversionStudentId?.trim();
      feeId = again?.conversionFeeId?.trim();
      if (!studentId || !feeId) {
        throw new Error("Could not reserve enrolment; please try again");
      }
    }
  } else {
    if (liveStatus === "SENT") {
      await Quotation.updateOne(
        { _id: doc._id, status: "SENT" },
        { $set: { status: "PENDING_PAYMENT" } },
      ).exec();
    }
  }

  if (!studentId || !feeId) {
    throw new Error("Enrolment state is inconsistent; contact support");
  }

  const installmentKey = await resolveInstallmentKeyForFirstPayment(feeId);
  const ttl = checkoutPayTokenTtlMs();
  const tokenResult = await ensurePayTokenForTarget({
    installmentId: installmentKey,
    feeId,
    studentId,
    tenantId,
    ttlMs: ttl,
  });

  await Quotation.updateOne(
    { _id: doc._id },
    {
      $set: {
        checkoutPayToken: tokenResult.token,
        checkoutPayTokenExpiresAt: tokenResult.expiresAt,
        status: "PENDING_PAYMENT",
      },
    },
  ).exec();

  const base = env.publicAppUrl?.trim();
  if (!base) {
    throw new Error("PUBLIC_APP_URL is not configured");
  }

  const payUrl = `${base}/pay/${encodeURIComponent(tokenResult.token)}`;

  logger.info(SCOPE, "quotation accept prepared", {
    quotationId: doc._id.toString(),
    studentId,
    feeId,
    staff: Boolean(staff),
  });

  return { payUrl, quotationRef: doc.quotationRef };
}

/**
 * After Razorpay capture: mark quotation ACCEPTED when payment was opened from quotation checkout.
 */
export async function markQuotationAcceptedAfterPayment(paymentDoc: {
  quotationId?: string;
  studentId: string;
  feeId: string;
  status: PaymentStatusLike;
}): Promise<void> {
  if (paymentDoc.status !== "SUCCESS") {
    return;
  }
  const qid = paymentDoc.quotationId?.trim();
  if (!qid || !mongoose.isValidObjectId(qid)) {
    return;
  }
  const q = await Quotation.findById(qid).exec();
  if (!q || q.status !== "PENDING_PAYMENT") {
    return;
  }
  if (q.conversionStudentId !== paymentDoc.studentId) {
    logger.warn(SCOPE, "quotation student mismatch on payment", {
      quotationId: qid,
    });
    return;
  }
  if (q.conversionFeeId !== paymentDoc.feeId) {
    logger.warn(SCOPE, "quotation fee mismatch on payment", { quotationId: qid });
    return;
  }
  q.status = "ACCEPTED";
  await q.save();
  logger.info(SCOPE, "quotation marked ACCEPTED after payment", {
    quotationId: qid,
  });
}

type PaymentStatusLike = "INITIATED" | "SUCCESS" | "FAILED";
