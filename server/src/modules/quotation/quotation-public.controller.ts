import { Request, Response } from "express";
import mongoose from "mongoose";
import { logger } from "../../utils/logger";
import {
  acceptQuotationPreparePayment,
  assertPublicPdfToken,
} from "./quotation-accept.service";
import type { QuotationAcceptPublicBody } from "./quotation.validation";
import { Quotation } from "./quotation.model";
import {
  persistQuotationExpiredIfNeeded,
  streamStoredPdfPublic,
} from "./quotation.service";
import { getTenantType } from "../student/student.service";
import { STUDENT_CLASSES, STUDENT_SECTIONS } from "../student/student.model";

const SCOPE = "quotation.public";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * GET /public/quotations/:id/pdf?token=
 * Time-limited public PDF (SMS link). Does not log the token.
 */
export async function downloadPdfByToken(
  req: Request,
  res: Response,
): Promise<void> {
  const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
  const result = await streamStoredPdfPublic(
    req.params.id,
    token,
  );
  if (!result) {
    res.status(404).json({ error: "Invalid or expired link" });
    return;
  }
  logger.info(SCOPE, "quotation PDF served (public token)", {
    quotationId: req.params.id,
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${result.filename}"`,
  );
  res.send(result.buffer);
}

/**
 * GET /public/quotations/:id/checkout?token=
 * Minimal page: accept quotation and redirect to Razorpay pay link.
 */
export async function getCheckoutPage(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  const token =
    typeof req.query.token === "string" ? req.query.token.trim() : "";
  if (!mongoose.isValidObjectId(id) || !token) {
    res.status(400).send("Invalid link");
    return;
  }
  const doc = await Quotation.findById(id).exec();
  if (!doc) {
    res.status(404).send("Quotation not found");
    return;
  }
  try {
    assertPublicPdfToken(doc, token);
  } catch {
    res.status(403).send("Invalid or expired link");
    return;
  }
  const st = await persistQuotationExpiredIfNeeded(doc);
  if (st === "ACCEPTED") {
    res.status(200).send("This quotation is already accepted. Thank you.");
    return;
  }
  if (st !== "SENT" && st !== "PENDING_PAYMENT") {
    res.status(403).send("This quotation cannot be accepted online.");
    return;
  }

  const tenantType = await getTenantType(doc.tenantId);
  const needsClassSection =
    tenantType === "SCHOOL" &&
    (!doc.schoolClass?.trim() || !doc.schoolSection?.trim());
  const ref = escapeHtml(doc.quotationRef);
  const name = escapeHtml(doc.name);
  const classOptions = STUDENT_CLASSES.map(
    (c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`,
  ).join("");
  const sectionOptions = STUDENT_SECTIONS.map(
    (s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`,
  ).join("");

  const schoolBlock = needsClassSection
    ? `<p><label>Class<br/><select name="class" id="class" required>${classOptions}</select></label></p>
       <p><label>Section<br/><select name="section" id="section" required>${sectionOptions}</select></label></p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Accept quotation ${ref}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 28rem; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
    button { margin-top: 1rem; padding: 0.5rem 1rem; font-size: 1rem; cursor: pointer; }
    .err { color: #b91c1c; margin-top: 0.5rem; }
    select { width: 100%; padding: 0.35rem; margin-top: 0.25rem; }
  </style>
</head>
<body>
  <h1>Accept quotation</h1>
  <p>Reference <strong>${ref}</strong> — ${name}</p>
  <p>You will create your enrolment record and proceed to secure fee payment (Razorpay).</p>
  ${schoolBlock}
  <button type="button" id="pay">Accept and pay</button>
  <p id="msg" class="err" role="alert"></p>
  <script>
    (function () {
      var id = ${JSON.stringify(id)};
      var token = ${JSON.stringify(token)};
      var btn = document.getElementById("pay");
      var msg = document.getElementById("msg");
      btn.addEventListener("click", function () {
        msg.textContent = "";
        var body = { token: token };
        var cl = document.getElementById("class");
        var se = document.getElementById("section");
        if (cl && se) {
          body.class = cl.value;
          body.section = se.value;
        }
        btn.disabled = true;
        fetch("/public/quotations/" + encodeURIComponent(id) + "/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (x) {
            if (x.ok && x.j.payUrl) {
              window.location.href = x.j.payUrl;
              return;
            }
            msg.textContent = (x.j && x.j.error) ? x.j.error : "Something went wrong.";
            btn.disabled = false;
          })
          .catch(function () {
            msg.textContent = "Network error.";
            btn.disabled = false;
          });
      });
    })();
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(html);
}

/**
 * POST /public/quotations/:id/accept
 */
export async function postAcceptQuotation(
  req: Request,
  res: Response,
): Promise<void> {
  const body = req.body as QuotationAcceptPublicBody;
  try {
    const result = await acceptQuotationPreparePayment({
      quotationId: req.params.id,
      pdfAccessToken: body.token,
      schoolClass: body.class,
      schoolSection: body.section,
    });
    res.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not start payment";
    res.status(400).json({ error: message });
  }
}
