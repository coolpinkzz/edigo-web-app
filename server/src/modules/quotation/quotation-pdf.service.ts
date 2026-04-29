import PDFDocument from "pdfkit";
import type { FeeType } from "../fee/fee.model";

type PdfDoc = InstanceType<typeof PDFDocument>;

const PDF_BORDER = "#cbd5e1";
const PDF_HEADER_BG = "#0d9488";
const PDF_ROW_A = "#f0fdfa";
const PDF_ROW_B = "#ffffff";
const PDF_LABEL = "#475569";
const PDF_VALUE = "#134e4a";
const PDF_META_BG = "#f0fdfa";
const PDF_TOTAL_BG = "#ccfbf1";
const PDF_TOTAL_BORDER = "#2dd4bf";
const PDF_TOTAL_TEXT = "#115e59";
const PDF_ORG_NAME = "#0f172a";
const PDF_ORG_TAGLINE = "#b91c1c";
const PDF_HEADER_RULE = "#64748b";

async function fetchLogoBufferForPdf(logoUrl: string): Promise<Buffer | null> {
  const u = logoUrl.trim();
  if (!u.startsWith("http://") && !u.startsWith("https://")) {
    return null;
  }
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 15_000);
  try {
    const res = await fetch(u, { signal: ac.signal });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!ct.startsWith("image/")) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Left: optional logo + organization name (and optional tagline). Right: phone, email, address when set.
 * Bottom border rule. Returns Y position below the rule.
 */
function drawQuotationDocumentHeader(
  doc: PdfDoc,
  margin: number,
  tableW: number,
  y: number,
  p: {
    orgName: string;
    orgTagline?: string;
    orgLogoBuffer: Buffer | null;
    orgAddress?: string;
    orgPhone?: string;
    orgEmail?: string;
  },
): number {
  const top = y;
  const rightW = Math.min(240, Math.floor(tableW * 0.44));
  const gap = 12;
  const logoSize = 52;
  const hasLogo = Boolean(p.orgLogoBuffer);
  const textX = margin + (hasLogo ? logoSize + gap : 0);
  const leftTextW = tableW - rightW - gap - (hasLogo ? logoSize + gap : 0);

  if (hasLogo && p.orgLogoBuffer) {
    try {
      doc.image(p.orgLogoBuffer, margin, top, {
        width: logoSize,
        height: logoSize,
      });
    } catch {
      // invalid image buffer — continue with text only
    }
  }

  const nameLine = p.orgName.trim().toUpperCase();
  const textW = Math.max(120, leftTextW);
  /** Measure name + tagline so we can vertically center the block with the logo. */
  doc.fillColor(PDF_ORG_NAME).font("Helvetica-Bold").fontSize(15);
  const hName = doc.heightOfString(nameLine, { width: textW, lineGap: 1 });
  let leftBlockH = hName;
  if (p.orgTagline?.trim()) {
    doc.font("Helvetica").fontSize(7.5);
    const hTag = doc.heightOfString(p.orgTagline.trim().toUpperCase(), {
      width: textW,
    });
    leftBlockH = hName + 2 + hTag;
  }
  const nameStartY = hasLogo
    ? leftBlockH <= logoSize
      ? top + (logoSize - leftBlockH) / 2
      : top
    : top;

  doc.fillColor(PDF_ORG_NAME).font("Helvetica-Bold").fontSize(15);
  doc.text(nameLine, textX, nameStartY, { width: textW, lineGap: 1 });
  let leftBottom = doc.y;

  if (p.orgTagline?.trim()) {
    doc
      .fillColor(PDF_ORG_TAGLINE)
      .font("Helvetica")
      .fontSize(7.5)
      .text(p.orgTagline.trim().toUpperCase(), textX, leftBottom + 2, {
        width: textW,
      });
    leftBottom = doc.y;
  }

  const leftVisualBottom = hasLogo
    ? Math.max(top + logoSize, leftBottom)
    : leftBottom;

  const rightX = margin + tableW - rightW;
  const rightLines: string[] = [];
  if (p.orgPhone?.trim()) {
    rightLines.push(`Phone: ${p.orgPhone.trim()}`);
  }
  if (p.orgEmail?.trim()) {
    rightLines.push(`Email: ${p.orgEmail.trim()}`);
  }
  if (p.orgAddress?.trim()) {
    const addrLines = p.orgAddress
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (addrLines.length) {
      rightLines.push(addrLines[0]);
      for (let i = 1; i < addrLines.length; i++) {
        rightLines.push(addrLines[i]!);
      }
    }
  }

  let rightBottom = top;
  if (rightLines.length) {
    const rightJoined = rightLines.join("\n");
    doc.fillColor(PDF_VALUE).font("Helvetica").fontSize(8.5);
    const hRight = doc.heightOfString(rightJoined, {
      width: rightW,
      lineGap: 2,
    });
    const rightStartY = hasLogo
      ? hRight <= logoSize
        ? top + (logoSize - hRight) / 2
        : top
      : top;
    doc.text(rightJoined, rightX, rightStartY, {
      width: rightW,
      align: "right",
      lineGap: 2,
    });
    rightBottom = doc.y;
  }

  const blockBottom = Math.max(leftVisualBottom, rightBottom);
  const ruleY = blockBottom + 10;
  doc
    .strokeColor(PDF_HEADER_RULE)
    .lineWidth(0.9)
    .moveTo(margin, ruleY)
    .lineTo(margin + tableW, ruleY)
    .stroke();
  doc.fillColor("#000000");
  return ruleY + 8;
}

function drawSectionBar(
  doc: PdfDoc,
  x: number,
  y: number,
  w: number,
  title: string,
): number {
  const h = 26;
  doc.rect(x, y, w, h).fill(PDF_HEADER_BG);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(11);
  doc.text(title, x + 14, y + 8, { width: w - 28 });
  doc.fillColor("#000000");
  return y + h;
}

function drawMetaTable(
  doc: PdfDoc,
  x: number,
  y: number,
  w: number,
  ref: string,
  dateStr: string,
  validStr: string,
): number {
  const h = 52;
  doc.rect(x, y, w, h).fill(PDF_META_BG);
  doc.strokeColor(PDF_BORDER).lineWidth(0.75);
  doc.rect(x, y, w, h).stroke();
  const colW = w / 3;
  doc
    .moveTo(x + colW, y)
    .lineTo(x + colW, y + h)
    .stroke();
  doc
    .moveTo(x + 2 * colW, y)
    .lineTo(x + 2 * colW, y + h)
    .stroke();
  doc.fillColor(PDF_LABEL).font("Helvetica-Bold").fontSize(9);
  doc.text("Quotation ref", x + 10, y + 8, { width: colW - 16 });
  doc.text("Date", x + colW + 10, y + 8, { width: colW - 16 });
  doc.text("Valid until", x + 2 * colW + 10, y + 8, { width: colW - 16 });
  doc.fillColor(PDF_VALUE).font("Helvetica").fontSize(10);
  doc.text(ref, x + 10, y + 26, { width: colW - 16 });
  doc.text(dateStr, x + colW + 10, y + 26, { width: colW - 16 });
  doc.text(validStr, x + 2 * colW + 10, y + 26, { width: colW - 16 });
  return y + h;
}

function drawKeyValueTable(
  doc: PdfDoc,
  x: number,
  y: number,
  w: number,
  rows: { label: string; value: string }[],
): number {
  const labelColW = 132;
  const padH = 10;
  const padV = 6;
  const minRowH = 22;
  const valueW = w - labelColW - 20;

  doc.font("Helvetica").fontSize(9);
  const heights = rows.map((row) => {
    doc.font("Helvetica-Bold");
    const hL = doc.heightOfString(row.label, { width: labelColW - 8 });
    doc.font("Helvetica");
    const hV = doc.heightOfString(row.value, { width: valueW });
    return Math.max(minRowH, hL + padV * 2, hV + padV * 2);
  });
  const totalH = heights.reduce((sum, h) => sum + h, 0);

  let rowTop = y;
  rows.forEach((row, i) => {
    const rh = heights[i];
    const bg = i % 2 === 0 ? PDF_ROW_A : PDF_ROW_B;
    doc.rect(x, rowTop, w, rh).fill(bg);
    rowTop += rh;
  });

  doc.strokeColor(PDF_BORDER).lineWidth(0.75);
  doc
    .moveTo(x, y)
    .lineTo(x + w, y)
    .stroke();
  doc
    .moveTo(x, y + totalH)
    .lineTo(x + w, y + totalH)
    .stroke();
  doc
    .moveTo(x, y)
    .lineTo(x, y + totalH)
    .stroke();
  doc
    .moveTo(x + w, y)
    .lineTo(x + w, y + totalH)
    .stroke();
  doc
    .moveTo(x + labelColW, y)
    .lineTo(x + labelColW, y + totalH)
    .stroke();

  rowTop = y;
  rows.forEach((row, i) => {
    const rh = heights[i];
    if (i > 0) {
      doc
        .moveTo(x, rowTop)
        .lineTo(x + w, rowTop)
        .stroke();
    }
    doc.fillColor(PDF_LABEL).font("Helvetica-Bold").fontSize(9);
    doc.text(row.label, x + padH, rowTop + padV, { width: labelColW - 8 });
    doc.fillColor(PDF_VALUE).font("Helvetica").fontSize(9);
    doc.text(row.value, x + labelColW + padH, rowTop + padV, { width: valueW });
    rowTop += rh;
  });

  return y + totalH;
}

/** Two-column table: label | URL (clickable, wrapped), with header row. */
function drawLabelLinkTable(
  doc: PdfDoc,
  x: number,
  y: number,
  w: number,
  rows: { label: string; url: string }[],
): number {
  const labelColW = 100;
  const padH = 10;
  const padV = 6;
  const minRowH = 24;
  const urlW = w - labelColW - 20;
  const headerH = 24;
  const tableTop = y;

  doc.rect(x, y, w, headerH).fill(PDF_META_BG);
  doc.strokeColor(PDF_BORDER).lineWidth(0.75);
  doc
    .moveTo(x, y)
    .lineTo(x + w, y)
    .stroke();
  doc
    .moveTo(x, y + headerH)
    .lineTo(x + w, y + headerH)
    .stroke();
  doc
    .moveTo(x, y)
    .lineTo(x, y + headerH)
    .stroke();
  doc
    .moveTo(x + w, y)
    .lineTo(x + w, y + headerH)
    .stroke();
  doc
    .moveTo(x + labelColW, y)
    .lineTo(x + labelColW, y + headerH)
    .stroke();
  doc.fillColor(PDF_LABEL).font("Helvetica-Bold").fontSize(9);
  doc.text("Channel", x + padH, y + 7, { width: labelColW - 8 });
  doc.text("URL", x + labelColW + padH, y + 7, { width: urlW });
  y += headerH;

  const heights = rows.map((row) => {
    doc.font("Helvetica-Bold").fontSize(9);
    const hL = doc.heightOfString(row.label, { width: labelColW - 8 });
    doc.font("Helvetica").fontSize(9);
    const hU = doc.heightOfString(row.url, { width: urlW });
    return Math.max(minRowH, hL + padV * 2, hU + padV * 2);
  });
  const dataBodyH = heights.reduce((sum, h) => sum + h, 0);
  const totalH = headerH + dataBodyH;

  let rowTop = y;
  rows.forEach((row, i) => {
    const rh = heights[i]!;
    const bg = i % 2 === 0 ? PDF_ROW_A : PDF_ROW_B;
    doc.rect(x, rowTop, w, rh).fill(bg);
    rowTop += rh;
  });

  doc.strokeColor(PDF_BORDER).lineWidth(0.75);
  doc
    .moveTo(x, y)
    .lineTo(x + w, y)
    .stroke();
  doc
    .moveTo(x, y + dataBodyH)
    .lineTo(x + w, y + dataBodyH)
    .stroke();
  doc
    .moveTo(x, y)
    .lineTo(x, y + dataBodyH)
    .stroke();
  doc
    .moveTo(x + w, y)
    .lineTo(x + w, y + dataBodyH)
    .stroke();
  doc
    .moveTo(x + labelColW, y)
    .lineTo(x + labelColW, y + dataBodyH)
    .stroke();

  rowTop = y;
  rows.forEach((row, i) => {
    const rh = heights[i]!;
    if (i > 0) {
      doc
        .moveTo(x, rowTop)
        .lineTo(x + w, rowTop)
        .stroke();
    }
    doc.fillColor(PDF_LABEL).font("Helvetica-Bold").fontSize(9);
    doc.text(row.label, x + padH, rowTop + padV, { width: labelColW - 8 });
    doc.fillColor("#0d9488").font("Helvetica").fontSize(9);
    doc.text(row.url, x + labelColW + padH, rowTop + padV, {
      width: urlW,
      link: row.url,
      underline: true,
    });
    rowTop += rh;
  });
  doc.fillColor("#000000");
  return tableTop + totalH;
}

function drawTotalBar(
  doc: PdfDoc,
  x: number,
  y: number,
  w: number,
  lines: { label: string; value: string }[],
): number {
  const rowH = 20;
  const padTop = 12;
  const h = padTop + lines.length * rowH + 8;
  doc.rect(x, y, w, h).fill(PDF_TOTAL_BG);
  doc.strokeColor(PDF_TOTAL_BORDER).lineWidth(0.75);
  doc.rect(x, y, w, h).stroke();
  let ty = y + padTop;
  lines.forEach((line, i) => {
    const fs = i === lines.length - 1 ? 11 : 9;
    doc.fillColor(PDF_TOTAL_TEXT).font("Helvetica-Bold").fontSize(fs);
    doc.text(line.label, x + 16, ty, { width: w * 0.55 - 16 });
    doc.text(line.value, x + w * 0.45, ty, {
      width: w * 0.55 - 24,
      align: "right",
    });
    ty += rowH + (i === lines.length - 2 ? 2 : 0);
  });
  doc.fillColor("#000000");
  return y + h;
}

function formatRupees(amount: number): string {
  return `Rs ${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export type QuotationPdfInput = {
  orgName: string;
  /** Branch or mailing address (right column of document header). */
  orgAddress?: string;
  /** HTTPS URL of tenant logo (fetched server-side when generating PDF). */
  orgLogoUrl?: string;
  /** Optional slogan under the organization name (e.g. tagline). */
  orgTagline?: string;
  /** Optional — shown in header when set (e.g. from tenant settings later). */
  orgPhone?: string;
  orgEmail?: string;
  quotationRef: string;
  issuedAt: Date;
  validUntil: Date;
  courseDisplayName: string;
  /** When set, fee table shows Class + Section instead of a single Course row. */
  schoolClass?: string;
  schoolSection?: string;
  /** Teal bar title above the fee details table. */
  courseFeeBarTitle: string;
  /** SCHOOL: append sentence about choosing class/section on next step (legacy quotes only). */
  includeClassSectionNextPageHint: boolean;
  branchName: string;
  feeStructureTitle: string;
  feeType: FeeType;
  feeBaseTotal: number;
  isInstallment: boolean;
  discountPercent: number;
  discountAmount: number;
  quotedTotal: number;
  preferredTimeSlot: string;
  websiteUrl?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  /** Public checkout URL (set when PDF access token is valid). */
  acceptAndPayUrl?: string;
  /** If true, token exists but the access window has passed. */
  acceptAndPayExpired?: boolean;
  /** Shown after meta, before course & fee, when set. */
  quotationOverview?: string;
  notes?: string;
};

export async function buildQuotationPdfBuffer(
  input: QuotationPdfInput,
): Promise<Buffer> {
  const logoBuffer =
    input.orgLogoUrl && input.orgLogoUrl.trim() !== ""
      ? await fetchLogoBufferForPdf(input.orgLogoUrl)
      : null;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const margin = 50;
    const pageW = doc.page.width;
    const tableW = pageW - margin * 2;
    let y = margin;

    const dateStr = input.issuedAt.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const validStr = input.validUntil.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    try {
      y = drawQuotationDocumentHeader(doc, margin, tableW, y, {
        orgName: input.orgName,
        orgTagline: input.orgTagline,
        orgLogoBuffer: logoBuffer,
        orgAddress: input.orgAddress,
        orgPhone: input.orgPhone,
        orgEmail: input.orgEmail,
      });
      y += 4;
      doc.font("Helvetica").fontSize(10).fillColor("#0f766e");
      doc.text("Quotation", margin, y, { align: "center", width: tableW });
      y = doc.y + 16;
      doc.fillColor("#000000");
    } catch (err) {
      reject(err);
      return;
    }

    y = drawMetaTable(
      doc,
      margin,
      y,
      tableW,
      input.quotationRef,
      dateStr,
      validStr,
    );
    y += 12;

    if (input.quotationOverview?.trim()) {
      y = drawSectionBar(doc, margin, y, tableW, "Overview");
      doc.fillColor(PDF_VALUE).font("Helvetica").fontSize(9);
      doc.text(input.quotationOverview.trim(), margin, y + 8, {
        width: tableW,
      });
      y = doc.y + 8;
      y += 4;
    }

    y = drawSectionBar(doc, margin, y, tableW, input.courseFeeBarTitle);
    const hasSchoolPlacement = Boolean(
      input.schoolClass?.trim() && input.schoolSection?.trim(),
    );
    const feeRows: { label: string; value: string }[] = [];
    if (hasSchoolPlacement) {
      feeRows.push(
        { label: "Class", value: input.schoolClass!.trim() },
        { label: "Section", value: input.schoolSection!.trim() },
      );
    } else {
      feeRows.push({ label: "Course", value: input.courseDisplayName });
    }
    feeRows.push(
      { label: "Branch", value: input.branchName },
      { label: "Fee structure", value: input.feeStructureTitle },
      { label: "Fee category", value: input.feeType },
      {
        label: "Plan",
        value: input.isInstallment ? "Installment plan" : "Lump sum",
      },
      {
        label: "Preferred time",
        value: input.preferredTimeSlot,
      },
    );
    y = drawKeyValueTable(doc, margin, y, tableW, feeRows);
    y += 12;

    const linkRows: { label: string; url: string }[] = [];
    if (input.websiteUrl?.trim()) {
      linkRows.push({ label: "Website", url: input.websiteUrl.trim() });
    }
    if (input.youtubeUrl?.trim()) {
      linkRows.push({ label: "YouTube", url: input.youtubeUrl.trim() });
    }
    if (input.instagramUrl?.trim()) {
      linkRows.push({ label: "Instagram", url: input.instagramUrl.trim() });
    }
    if (linkRows.length) {
      y = drawSectionBar(doc, margin, y, tableW, "Links");
      y = drawLabelLinkTable(doc, margin, y, tableW, linkRows);
      y += 8;
    }

    y += 8;
    y = drawTotalBar(doc, margin, y, tableW, [
      {
        label: "Fee structure total",
        value: formatRupees(input.feeBaseTotal),
      },
      {
        label: `Discount (${input.discountPercent}%)`,
        value: `- ${formatRupees(input.discountAmount)}`,
      },
      {
        label: "Quoted total",
        value: formatRupees(input.quotedTotal),
      },
    ]);
    y += 14;

    y = drawSectionBar(doc, margin, y, tableW, "Accept quotation & pay");
    doc.fillColor(PDF_VALUE).font("Helvetica").fontSize(9);
    if (input.acceptAndPayUrl?.trim()) {
      const payIntroBase =
        "Use the secure link to confirm this quotation and pay online. You do not need to log in to the institute app.";
      const payIntroExtra = input.includeClassSectionNextPageHint
        ? " For school admission, you will select class and section on the next page."
        : "";
      doc.text(payIntroBase + payIntroExtra, margin, y + 8, {
        width: tableW,
        align: "left",
      });
      y = doc.y + 8;
      doc
        .fillColor("#0d9488")
        .font("Helvetica-Bold")
        .fontSize(10)
        .text("Accept and pay (secure link)", margin, y, {
          link: input.acceptAndPayUrl.trim(),
          underline: true,
          width: tableW,
        });
      y = doc.y + 6;
    } else if (input.acceptAndPayExpired) {
      doc.text(
        "The online accept-and-pay link for this quotation has expired. Please contact the institute for a new quotation or payment instructions.",
        margin,
        y + 8,
        { width: tableW, align: "left" },
      );
      y = doc.y + 6;
    } else {
      doc.text(
        "When the institute sends this quotation by SMS, a secure link will be included. Open that link or this PDF to accept and pay online.",
        margin,
        y + 8,
        { width: tableW, align: "left" },
      );
      y = doc.y + 6;
    }

    y += 8;
    if (input.notes?.trim()) {
      y = drawSectionBar(doc, margin, y, tableW, "Remarks");
      doc.fillColor(PDF_VALUE).font("Helvetica").fontSize(9);
      doc.text(input.notes.trim(), margin, y + 8, { width: tableW });
      y = doc.y + 8;
    }

    doc.fontSize(8).fillColor("#64748b");
    doc.text(
      "This quotation is valid until the date shown above unless withdrawn earlier. Fees are indicative and subject to institute policies.",
      margin,
      doc.page.height - 72,
      { align: "center", width: tableW },
    );

    doc.end();
  });
}
