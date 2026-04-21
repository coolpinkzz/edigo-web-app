import { Fragment, useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { FeeStatusBadge } from "../components/FeeStatusBadge";
import {
  Button,
  Card,
  CardDescription,
  CardTitle,
  ConfirmationModal,
  Input,
  SelectField,
} from "../components/ui";
import {
  buildFeeLumpSumPaymentPayload,
  buildInstallmentPaymentPayload,
} from "../api/fee.api";
import { useAuthSession } from "../hooks/useAuthSession";
import { useFee } from "../hooks/useFee";
import { useFees } from "../hooks/useFees";
import { useStudent } from "../hooks/useStudent";
import { usePatchFee } from "../hooks/usePatchFee";
import { useUpdateFeePayment } from "../hooks/useUpdateFeePayment";
import { useUpdateInstallment } from "../hooks/useUpdateInstallment";
import type {
  FeeDto,
  InstallmentDto,
  ManualPaymentMethod,
  PatchFeePayload,
  StudentGender,
} from "../types";
import { businessDayKey, ymdToBusinessMidnightIso } from "../utils/timezone";
import { cn, getErrorMessage } from "../utils";

const FEE_PAGE_SIZE = 20;

const PAYMENT_METHOD_OPTIONS: { value: ManualPaymentMethod; label: string }[] =
  [
    { value: "CASH", label: "Cash" },
    { value: "CHEQUE", label: "Cheque" },
  ];

function formatMoney(n: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatStudentDateOnly(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function genderLabel(g?: StudentGender): string {
  if (!g) return "—";
  const map: Record<StudentGender, string> = {
    MALE: "Male",
    FEMALE: "Female",
    OTHER: "Other",
  };
  return map[g];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** HTML date input value (YYYY-MM-DD) from an ISO string from the API. */
function isoToDateInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return businessDayKey(d);
}

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

function DetailField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-1.5 text-sm leading-relaxed text-foreground">
        {children}
      </div>
    </div>
  );
}

/**
 * Student profile with fees list; expand a fee to load installments (GET /fees/:feeId).
 */
export function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [feePage, setFeePage] = useState(1);
  const [expandedFeeId, setExpandedFeeId] = useState<string | null>(null);
  const [recordingInstallmentId, setRecordingInstallmentId] = useState<
    string | null
  >(null);
  const [instPaidInput, setInstPaidInput] = useState("");
  const [instMethod, setInstMethod] = useState<ManualPaymentMethod>("CASH");
  const [instReference, setInstReference] = useState("");
  const [showLumpSumForm, setShowLumpSumForm] = useState(false);
  const [lumpPaidInput, setLumpPaidInput] = useState("");
  const [lumpMethod, setLumpMethod] = useState<ManualPaymentMethod>("CASH");
  const [lumpReference, setLumpReference] = useState("");
  const [paymentValidationModal, setPaymentValidationModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    studentPhotoUrl?: string;
  }>({ open: false, title: "", description: "" });
  const [lumpScheduleEnd, setLumpScheduleEnd] = useState("");

  const openPaymentValidationModal = (
    description: string,
    opts?: { title?: string; studentPhotoUrl?: string },
  ) => {
    setPaymentValidationModal({
      open: true,
      title: opts?.title ?? "Cannot save payment",
      description,
      studentPhotoUrl: opts?.studentPhotoUrl,
    });
  };

  const sessionQuery = useAuthSession();
  const isSchool = sessionQuery.data?.tenant?.tenantType === "SCHOOL";

  const studentQuery = useStudent(studentId);
  const feesQuery = useFees({
    studentId: studentId ?? "",
    page: feePage,
    limit: FEE_PAGE_SIZE,
    enabled: Boolean(studentId),
  });
  const feeDetailQuery = useFee(expandedFeeId ?? undefined);
  const updateInstallmentMutation = useUpdateInstallment();
  const updateFeePaymentMutation = useUpdateFeePayment();
  const patchFeeMutation = usePatchFee();

  const toggleFee = (id: string) => {
    setExpandedFeeId((prev) => (prev === id ? null : id));
    setRecordingInstallmentId(null);
    setShowLumpSumForm(false);
  };

  const student = studentQuery.data;

  const handleCopyPhone = async () => {
    if (!student?.parentPhoneNumber) return;
    await copyText(student.parentPhoneNumber);
  };

  const openInstallmentPayment = (inst: InstallmentDto) => {
    setRecordingInstallmentId(inst.id);
    setInstPaidInput(String(inst.amount));
    setInstMethod("CASH");
    setInstReference("");
  };

  const submitInstallmentPayment = async (
    feeId: string,
    inst: InstallmentDto,
  ) => {
    const paid = Number.parseFloat(instPaidInput);
    if (Number.isNaN(paid) || paid < 0) {
      openPaymentValidationModal("Enter a valid paid amount (0 or more).", {
        studentPhotoUrl: student?.photoUrl,
      });
      return;
    }
    if (paid > inst.amount + 1e-9) {
      openPaymentValidationModal(
        `Paid cannot exceed installment amount (${formatMoney(inst.amount)}).`,
        { studentPhotoUrl: student?.photoUrl },
      );
      return;
    }
    const ref = instReference.trim();
    if (!ref) {
      openPaymentValidationModal(
        "Enter a reference (cheque no., receipt, or transaction id).",
        { studentPhotoUrl: student?.photoUrl },
      );
      return;
    }
    try {
      await updateInstallmentMutation.mutateAsync({
        feeId,
        installmentId: inst.id,
        body: buildInstallmentPaymentPayload(inst.metadata, {
          paidAmount: paid,
          paymentMethod: instMethod,
          paymentReference: ref,
        }),
      });
      setRecordingInstallmentId(null);
    } catch {
      /* mutation error surfaced below */
    }
  };

  const submitLumpSumPayment = async (fee: FeeDto) => {
    const paid = Number.parseFloat(lumpPaidInput);
    if (Number.isNaN(paid) || paid < 0) {
      openPaymentValidationModal("Enter a valid paid amount (0 or more).", {
        studentPhotoUrl: student?.photoUrl,
      });
      return;
    }
    if (paid > fee.totalAmount + 1e-9) {
      openPaymentValidationModal(
        `Paid cannot exceed fee total (${formatMoney(fee.totalAmount)}).`,
        { studentPhotoUrl: student?.photoUrl },
      );
      return;
    }
    const ref = lumpReference.trim();
    if (!ref) {
      openPaymentValidationModal(
        "Enter a reference (cheque no., receipt, or transaction id).",
        {
          studentPhotoUrl: student?.photoUrl,
        },
      );
      return;
    }
    try {
      await updateFeePaymentMutation.mutateAsync({
        feeId: fee.id,
        body: buildFeeLumpSumPaymentPayload(fee.metadata, {
          paidAmount: paid,
          paymentMethod: lumpMethod,
          paymentReference: ref,
        }),
      });
      setShowLumpSumForm(false);
    } catch {
      /* surfaced below */
    }
  };

  const openLumpSumForm = (fee: FeeDto) => {
    setShowLumpSumForm(true);
    setLumpPaidInput(String(fee.totalAmount));
    setLumpMethod("CASH");
    setLumpReference("");
  };

  const feeDetailFee = feeDetailQuery.data?.fee;
  useEffect(() => {
    if (!feeDetailFee || feeDetailFee.isInstallment) return;
    setLumpScheduleEnd(isoToDateInput(feeDetailFee.endDate));
  }, [feeDetailFee?.id, feeDetailFee?.isInstallment, feeDetailFee?.endDate]);

  const submitLumpSchedule = async (fee: FeeDto) => {
    const body: PatchFeePayload = {};
    const end = lumpScheduleEnd.trim();
    if (end) body.endDate = ymdToBusinessMidnightIso(end);
    if (Object.keys(body).length === 0) {
      openPaymentValidationModal("Set a due date before saving.", {
        title: "Cannot save schedule",
        studentPhotoUrl: student?.photoUrl,
      });
      return;
    }
    try {
      await patchFeeMutation.mutateAsync({ feeId: fee.id, body });
    } catch {
      /* surfaced below */
    }
  };

  if (!studentId) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-sm text-red-600">Missing student.</p>
        <Link to="/students" className="mt-2 inline-block text-sm text-primary">
          Back to students
        </Link>
      </div>
    );
  }

  if (studentQuery.isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Loading student…</p>
      </div>
    );
  }

  if (studentQuery.isError || !student) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-sm text-red-600" role="alert">
          {studentQuery.error instanceof Error
            ? studentQuery.error.message
            : "Student not found."}
        </p>
        <Link to="/students" className="mt-2 inline-block text-sm text-primary">
          Back to students
        </Link>
      </div>
    );
  }

  const feesData = feesQuery.data;
  const feePages = feesData?.totalPages ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6 lg:max-w-6xl">
      <Link
        to="/students"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <span aria-hidden>←</span>
        Students
      </Link>

      <Card className="overflow-hidden border-border/90 shadow-sm">
        <div className="border-b border-border bg-gradient-to-br from-muted/50 via-muted/30 to-transparent px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-4 sm:gap-5">
              {student.photoUrl ? (
                <img
                  src={student.photoUrl}
                  alt=""
                  className="h-24 w-24 shrink-0 rounded-2xl border border-border/80 object-cover shadow-sm ring-1 ring-black/5 sm:h-[7.25rem] sm:w-[7.25rem]"
                />
              ) : (
                <div
                  className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/70 text-xl font-semibold text-muted-foreground sm:h-[7.25rem] sm:w-[7.25rem]"
                  aria-hidden
                >
                  {student.studentName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    {student.studentName}
                  </h1>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
                      student.status === "ACTIVE" &&
                        "bg-emerald-500/15 text-emerald-800 dark:text-emerald-400",
                      student.status === "INACTIVE" &&
                        "bg-muted text-muted-foreground",
                      student.status === "DROPPED" &&
                        "bg-destructive/12 text-destructive",
                    )}
                  >
                    {student.status.charAt(0)}
                    {student.status.slice(1).toLowerCase()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {isSchool ? (
                    <>
                      Class {student.class ?? "—"} · Section{" "}
                      {student.section ?? "—"}
                      {student.scholarId
                        ? ` · Scholar ${student.scholarId}`
                        : ""}
                    </>
                  ) : (
                    <>
                      {student.course?.name ?? "Course not set"}
                      {student.scholarId
                        ? ` · Scholar ${student.scholarId}`
                        : ""}
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 lg:pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleCopyPhone()}
              >
                Copy parent phone
              </Button>
              <Link to={`/students/${studentId}/edit`}>
                <Button type="button" variant="primary">
                  Edit student
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="px-5 py-6 sm:px-7">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Profile
          </h2>
          <div className="mt-4 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            <DetailField label="Date of birth">
              {formatStudentDateOnly(student.dateOfBirth)}
            </DetailField>
            <DetailField label="Gender">
              {genderLabel(student.gender)}
            </DetailField>
            <DetailField label="Scholar ID">
              {student.scholarId?.trim() ? student.scholarId : "—"}
            </DetailField>
            {isSchool ? (
              <>
                <DetailField label="Class">{student.class ?? "—"}</DetailField>
                <DetailField label="Section">
                  {student.section ?? "—"}
                </DetailField>
              </>
            ) : (
              <>
                <DetailField label="Course">
                  {student.course?.name ?? "—"}
                </DetailField>
                <DetailField label="Course duration">
                  {student.courseDurationMonths != null
                    ? `${student.courseDurationMonths} month${
                        student.courseDurationMonths === 1 ? "" : "s"
                      }`
                    : "—"}
                </DetailField>
              </>
            )}
            <DetailField
              label="Address"
              className="sm:col-span-2 lg:col-span-3"
            >
              {student.address?.trim() ? (
                <span className="whitespace-pre-wrap">{student.address}</span>
              ) : (
                "—"
              )}
            </DetailField>
          </div>
        </div>

        <div className="border-t border-border bg-muted/20 px-5 py-6 sm:px-7">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Parent / guardian
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Contact for fee reminders and follow-ups.
          </p>
          <div className="mt-4 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            <DetailField label="Name">{student.parentName}</DetailField>
            <DetailField label="Phone">
              <span className="font-mono tabular-nums tracking-tight">
                {student.parentPhoneNumber}
              </span>
            </DetailField>
            <DetailField label="Alternate phone">
              <span className="font-mono tabular-nums tracking-tight">
                {student.alternatePhone?.trim() ? student.alternatePhone : "—"}
              </span>
            </DetailField>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border-border/90 shadow-sm">
        <div className="border-b border-border bg-muted/15 px-5 py-5 sm:px-7">
          <CardTitle className="text-lg font-semibold tracking-tight">
            Fees
          </CardTitle>
          <CardDescription className="mt-1 text-muted-foreground">
            Expand a fee to set due dates (lump-sum), record cash/cheque
            payments on installments, or a single lump-sum payment.
          </CardDescription>
        </div>

        {feesQuery.isLoading && (
          <p className="px-5 py-8 text-sm text-muted-foreground sm:px-7">
            Loading fees…
          </p>
        )}

        {feesQuery.isError && (
          <p className="px-5 py-8 text-sm text-red-600 sm:px-7" role="alert">
            Failed to load fees.
          </p>
        )}

        {!feesQuery.isLoading &&
          !feesQuery.isError &&
          feesData &&
          feesData.data.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground sm:px-7">
              No fees recorded for this student yet.
            </p>
          )}

        {!feesQuery.isLoading &&
          !feesQuery.isError &&
          feesData &&
          feesData.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="border-b border-border bg-primary-gradient text-primary-foreground">
                  <tr>
                    <th className="w-10 px-4 py-3" aria-hidden />
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    <th className="px-4 py-3 font-medium text-right">Paid</th>
                    <th className="px-4 py-3 font-medium text-right">
                      Pending
                    </th>
                    <th className="px-4 py-3 font-medium">Due by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {feesData.data.map((fee) => {
                    const isOpen = expandedFeeId === fee.id;
                    const detailFee =
                      isOpen &&
                      feeDetailQuery.data?.fee?.id === fee.id &&
                      feeDetailQuery.data.fee
                        ? feeDetailQuery.data.fee
                        : null;
                    const parentStatus = detailFee?.status ?? fee.status;
                    return (
                      <Fragment key={fee.id}>
                        <tr
                          className={cn(
                            "cursor-pointer bg-card hover:bg-muted/80",
                            isOpen && "bg-primary/10",
                          )}
                          onClick={() => toggleFee(fee.id)}
                        >
                          <td
                            className="px-4 py-3 text-muted-foreground"
                            aria-hidden
                          >
                            <span className="inline-block w-4 text-center">
                              {isOpen ? "▼" : "▶"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            {fee.title}
                            {fee.isInstallment && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                (installment plan)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {fee.feeType}
                          </td>
                          <td className="px-4 py-3">
                            <FeeStatusBadge
                              status={parentStatus}
                              variant="compact"
                              className="text-xs"
                            >
                              {parentStatus}
                            </FeeStatusBadge>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-foreground">
                            {formatMoney(fee.totalAmount)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-foreground/80">
                            {formatMoney(fee.paidAmount)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-foreground/80">
                            {formatMoney(fee.pendingAmount)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {fee.isInstallment
                              ? "—"
                              : fee.endDate
                                ? formatDate(fee.endDate)
                                : "—"}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={8} className="px-4 py-4">
                              {feeDetailQuery.isLoading && (
                                <p className="text-sm text-muted-foreground">
                                  Loading installments…
                                </p>
                              )}
                              {feeDetailQuery.isError && (
                                <p
                                  className="text-sm text-red-600"
                                  role="alert"
                                >
                                  Could not load fee details.
                                </p>
                              )}
                              {feeDetailQuery.data && (
                                <div className="space-y-4">
                                  {!feeDetailQuery.data.fee.isInstallment && (
                                    <div className="rounded-lg border border-card-border p-4 shadow-md shadow-black/[0.06]">
                                      <p className="text-sm text-muted-foreground">
                                        Single payment — no installment
                                        schedule.
                                      </p>
                                      <p className="mt-2 text-sm text-foreground/80">
                                        Total{" "}
                                        {formatMoney(
                                          feeDetailQuery.data.fee.totalAmount,
                                        )}{" "}
                                        · Paid{" "}
                                        {formatMoney(
                                          feeDetailQuery.data.fee.paidAmount,
                                        )}{" "}
                                        · Pending{" "}
                                        {formatMoney(
                                          feeDetailQuery.data.fee.pendingAmount,
                                        )}
                                      </p>
                                      <div
                                        className="mt-4 space-y-3 border-t border-border/60 pt-4"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <p className="text-xs text-muted-foreground">
                                          <strong className="font-medium text-foreground/90">
                                            Due date (IST)
                                          </strong>
                                          {" — "}
                                          Only applies to lump-sum fees. For
                                          unpaid fees, status becomes overdue
                                          after this date. Installment fees use
                                          installment due dates instead.
                                        </p>
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                          <div className="sm:w-56">
                                            <Input
                                              type="date"
                                              label="Due date (optional)"
                                              value={lumpScheduleEnd}
                                              onChange={(e) =>
                                                setLumpScheduleEnd(
                                                  e.target.value,
                                                )
                                              }
                                            />
                                          </div>
                                          <Button
                                            type="button"
                                            variant="secondary"
                                            className="sm:mb-0 sm:shrink-0"
                                            disabled={
                                              patchFeeMutation.isPending
                                            }
                                            onClick={() =>
                                              void submitLumpSchedule(
                                                feeDetailQuery.data.fee,
                                              )
                                            }
                                          >
                                            {patchFeeMutation.isPending
                                              ? "Saving…"
                                              : "Save schedule"}
                                          </Button>
                                        </div>
                                        {patchFeeMutation.isError &&
                                          patchFeeMutation.error && (
                                            <p
                                              className="text-sm text-red-600"
                                              role="alert"
                                            >
                                              {getErrorMessage(
                                                patchFeeMutation.error,
                                              )}
                                            </p>
                                          )}
                                      </div>
                                      {!showLumpSumForm ? (
                                        <Button
                                          type="button"
                                          variant="primary"
                                          className="mt-3"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openLumpSumForm(
                                              feeDetailQuery.data.fee,
                                            );
                                          }}
                                        >
                                          Record payment
                                        </Button>
                                      ) : (
                                        <div
                                          className="mt-4 space-y-3 border-t border-border/60 pt-4"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Input
                                            label="Total amount recorded as paid"
                                            type="number"
                                            step="0.01"
                                            min={0}
                                            value={lumpPaidInput}
                                            onChange={(e) =>
                                              setLumpPaidInput(e.target.value)
                                            }
                                          />
                                          <SelectField
                                            label="Method"
                                            name="lump-method"
                                            options={PAYMENT_METHOD_OPTIONS.map(
                                              (o) => ({
                                                value: o.value,
                                                label: o.label,
                                              }),
                                            )}
                                            value={lumpMethod}
                                            onValueChange={(v) =>
                                              setLumpMethod(
                                                v as ManualPaymentMethod,
                                              )
                                            }
                                          />
                                          <Input
                                            label="Reference"
                                            placeholder="Cheque no. / receipt"
                                            required
                                            value={lumpReference}
                                            onChange={(e) =>
                                              setLumpReference(e.target.value)
                                            }
                                          />
                                          <div className="flex flex-wrap gap-2">
                                            <Button
                                              type="button"
                                              disabled={
                                                updateFeePaymentMutation.isPending
                                              }
                                              onClick={() =>
                                                void submitLumpSumPayment(
                                                  feeDetailQuery.data!.fee,
                                                )
                                              }
                                            >
                                              {updateFeePaymentMutation.isPending
                                                ? "Saving…"
                                                : "Save payment"}
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              onClick={() =>
                                                setShowLumpSumForm(false)
                                              }
                                            >
                                              Cancel
                                            </Button>
                                          </div>
                                          {updateFeePaymentMutation.isError &&
                                            updateFeePaymentMutation.error && (
                                              <p
                                                className="text-sm text-red-600"
                                                role="alert"
                                              >
                                                {getErrorMessage(
                                                  updateFeePaymentMutation.error,
                                                )}
                                              </p>
                                            )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {feeDetailQuery.data.fee.isInstallment &&
                                    feeDetailQuery.data.installments.length ===
                                      0 && (
                                      <p className="text-sm text-muted-foreground">
                                        No installment rows yet.
                                      </p>
                                    )}
                                  {feeDetailQuery.data.installments.length >
                                    0 && (
                                    <div className="overflow-x-auto rounded-lg border border-card-border bg-card shadow-md shadow-black/[0.06]">
                                      <table className="w-full min-w-[36rem] text-left text-sm">
                                        <thead className="border-b border-border bg-primary-gradient text-primary-foreground">
                                          <tr>
                                            <th className="px-4 py-2 font-medium">
                                              #
                                            </th>
                                            <th className="px-4 py-2 font-medium">
                                              Due
                                            </th>
                                            <th className="px-4 py-2 font-medium text-right">
                                              Amount
                                            </th>
                                            <th className="px-4 py-2 font-medium text-right">
                                              Paid
                                            </th>
                                            <th className="px-4 py-2 font-medium">
                                              Status
                                            </th>
                                            <th className="px-4 py-2 font-medium text-right">
                                              Payment
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/60">
                                          {feeDetailQuery.data.installments.map(
                                            (inst, idx) => (
                                              <Fragment key={inst.id}>
                                                <tr>
                                                  <td className="px-4 py-2 text-muted-foreground">
                                                    {idx + 1}
                                                  </td>
                                                  <td className="px-4 py-2 text-foreground">
                                                    {formatDate(inst.dueDate)}
                                                  </td>
                                                  <td className="px-4 py-2 text-right tabular-nums">
                                                    {formatMoney(inst.amount)}
                                                  </td>
                                                  <td className="px-4 py-2 text-right tabular-nums">
                                                    {formatMoney(
                                                      inst.paidAmount,
                                                    )}
                                                  </td>
                                                  <td className="px-4 py-2">
                                                    <FeeStatusBadge
                                                      status={inst.status}
                                                      variant="compact"
                                                      className="text-xs"
                                                    >
                                                      {inst.status}
                                                    </FeeStatusBadge>
                                                  </td>
                                                  <td className="px-4 py-2 text-right">
                                                    <button
                                                      type="button"
                                                      className="text-sm font-medium text-primary hover:underline"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        openInstallmentPayment(
                                                          inst,
                                                        );
                                                      }}
                                                    >
                                                      Record
                                                    </button>
                                                  </td>
                                                </tr>
                                                {recordingInstallmentId ===
                                                  inst.id && (
                                                  <tr>
                                                    <td
                                                      colSpan={6}
                                                      className="px-4 py-4"
                                                      onClick={(e) =>
                                                        e.stopPropagation()
                                                      }
                                                    >
                                                      <div className="mx-auto max-w-md space-y-3">
                                                        <p className="text-xs text-muted-foreground">
                                                          Enter total collected
                                                          for this installment
                                                          (max{" "}
                                                          {formatMoney(
                                                            inst.amount,
                                                          )}
                                                          ).
                                                        </p>
                                                        <Input
                                                          label="Amount recorded as paid"
                                                          type="number"
                                                          step="0.01"
                                                          min={0}
                                                          value={instPaidInput}
                                                          onChange={(e) =>
                                                            setInstPaidInput(
                                                              e.target.value,
                                                            )
                                                          }
                                                        />
                                                        <SelectField
                                                          label="Method"
                                                          name={`inst-method-${inst.id}`}
                                                          options={PAYMENT_METHOD_OPTIONS.map(
                                                            (o) => ({
                                                              value: o.value,
                                                              label: o.label,
                                                            }),
                                                          )}
                                                          value={instMethod}
                                                          onValueChange={(v) =>
                                                            setInstMethod(
                                                              v as ManualPaymentMethod,
                                                            )
                                                          }
                                                        />
                                                        <Input
                                                          label="Reference"
                                                          placeholder="Cheque no. / receipt"
                                                          required
                                                          value={instReference}
                                                          onChange={(e) =>
                                                            setInstReference(
                                                              e.target.value,
                                                            )
                                                          }
                                                        />
                                                        <div className="flex flex-wrap gap-2">
                                                          <Button
                                                            type="button"
                                                            disabled={
                                                              updateInstallmentMutation.isPending
                                                            }
                                                            onClick={() =>
                                                              void submitInstallmentPayment(
                                                                feeDetailQuery
                                                                  .data!.fee.id,
                                                                inst,
                                                              )
                                                            }
                                                          >
                                                            {updateInstallmentMutation.isPending
                                                              ? "Saving…"
                                                              : "Save"}
                                                          </Button>
                                                          <Button
                                                            type="button"
                                                            variant="ghost"
                                                            onClick={() =>
                                                              setRecordingInstallmentId(
                                                                null,
                                                              )
                                                            }
                                                          >
                                                            Cancel
                                                          </Button>
                                                        </div>
                                                        {updateInstallmentMutation.isError &&
                                                          updateInstallmentMutation.error && (
                                                            <p
                                                              className="text-sm text-red-600"
                                                              role="alert"
                                                            >
                                                              {getErrorMessage(
                                                                updateInstallmentMutation.error,
                                                              )}
                                                            </p>
                                                          )}
                                                      </div>
                                                    </td>
                                                  </tr>
                                                )}
                                              </Fragment>
                                            ),
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        {!feesQuery.isLoading && feesData && feePages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/10 px-5 py-4 sm:px-7">
            <p className="text-sm text-muted-foreground">
              Page {feesData.page} of {feePages} · {feesData.total} fee
              {feesData.total === 1 ? "" : "s"}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={feePage <= 1}
                onClick={() => {
                  setExpandedFeeId(null);
                  setFeePage((p) => Math.max(1, p - 1));
                }}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={feePage >= feePages}
                onClick={() => {
                  setExpandedFeeId(null);
                  setFeePage((p) => (p < feePages ? p + 1 : p));
                }}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ConfirmationModal
        open={paymentValidationModal.open}
        onOpenChange={(open) =>
          setPaymentValidationModal((prev) => ({ ...prev, open }))
        }
        media={
          paymentValidationModal.studentPhotoUrl ? (
            <img
              src={paymentValidationModal.studentPhotoUrl}
              alt=""
              className="h-16 w-16 rounded-full border border-border object-cover"
            />
          ) : undefined
        }
        title={paymentValidationModal.title}
        description={paymentValidationModal.description}
        onConfirm={() =>
          setPaymentValidationModal((prev) => ({ ...prev, open: false }))
        }
        confirmLabel="OK"
        cancelLabel="Close"
      />
    </div>
  );
}
