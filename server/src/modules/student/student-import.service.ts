import * as XLSX from "xlsx";
import { Tenant } from "../auth/tenant.model";
import {
  Student,
  StudentClass,
  StudentSection,
  STUDENT_CLASSES,
  STUDENT_SECTIONS,
} from "./student.model";
import type { CreateStudentInput } from "./student.service";

const PHONE_RE = /^\d{10}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/** Normalized row after parsing Excel (before business validation). */
export interface ParsedImportRow {
  rowIndex: number;
  studentName: string;
  scholarId: string;
  parentName: string;
  parentPhoneNumber: string;
  panNumber: string;
  class: string;
  section: string;
}

export interface ImportValidRow extends ParsedImportRow {
  class: StudentClass;
  section: StudentSection;
}

export interface ImportInvalidRow {
  rowIndex: number;
  row: Record<string, string>;
  errors: string[];
}

export interface ValidateImportResult {
  validRows: ImportValidRow[];
  invalidRows: ImportInvalidRow[];
}

const HEADER_ALIASES: Record<string, keyof Omit<ParsedImportRow, "rowIndex">> = {
  studentname: "studentName",
  scholarid: "scholarId",
  parentname: "parentName",
  parentphonenumber: "parentPhoneNumber",
  parentphone: "parentPhoneNumber",
  phone: "parentPhoneNumber",
  mobile: "parentPhoneNumber",
  pan: "panNumber",
  pannumber: "panNumber",
  pan_number: "panNumber",
  class: "class",
  section: "section",
};

function normalizeHeaderKey(raw: string): string {
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function cellToTrimmedString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" && Number.isFinite(v)) {
    if (Number.isInteger(v)) return String(v);
    return String(v).replace(/\.0+$/, "").replace(/\.\d+$/, "");
  }
  return String(v).trim();
}

function normalizePhone(raw: unknown): string {
  const s = cellToTrimmedString(raw).replace(/\D/g, "");
  if (s.length >= 10) return s.slice(-10);
  return s;
}

function normalizeScholarId(raw: unknown): string {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (Number.isInteger(raw)) return String(raw);
    return String(Math.trunc(raw));
  }
  return cellToTrimmedString(raw);
}

function mapRow(
  rowIndex: number,
  raw: Record<string, unknown>,
): ParsedImportRow {
  const mapped: Partial<Omit<ParsedImportRow, "rowIndex">> = {
    studentName: "",
    scholarId: "",
    parentName: "",
    parentPhoneNumber: "",
    panNumber: "",
    class: "",
    section: "",
  };

  for (const [key, val] of Object.entries(raw)) {
    const nk = normalizeHeaderKey(key);
    const field = HEADER_ALIASES[nk];
    if (!field) continue;
    if (field === "parentPhoneNumber") {
      mapped.parentPhoneNumber = normalizePhone(val);
    } else if (field === "scholarId") {
      mapped.scholarId = normalizeScholarId(val);
    } else if (field === "panNumber") {
      mapped.panNumber = cellToTrimmedString(val).toUpperCase();
    } else {
      mapped[field] = cellToTrimmedString(val);
    }
  }

  return {
    rowIndex,
    studentName: mapped.studentName ?? "",
    scholarId: mapped.scholarId ?? "",
    parentName: mapped.parentName ?? "",
    parentPhoneNumber: mapped.parentPhoneNumber ?? "",
    panNumber: mapped.panNumber ?? "",
    class: mapped.class ?? "",
    section: mapped.section ?? "",
  };
}

function rowToDisplayRecord(r: ParsedImportRow): Record<string, string> {
  return {
    studentName: r.studentName,
    scholarId: r.scholarId,
    parentName: r.parentName,
    parentPhoneNumber: r.parentPhoneNumber,
    panNumber: r.panNumber,
    class: r.class,
    section: r.section,
  };
}

function isRowEmpty(r: ParsedImportRow): boolean {
  return (
    !r.studentName.trim() &&
    !r.scholarId.trim() &&
    !r.parentName.trim() &&
    !r.parentPhoneNumber &&
    !r.panNumber.trim() &&
    !r.class.trim() &&
    !r.section.trim()
  );
}

function validateFields(r: ParsedImportRow): string[] {
  const errors: string[] = [];
  if (!r.studentName) errors.push("studentName is required");
  if (!r.scholarId) errors.push("scholarId is required");
  if (!r.parentName) errors.push("parentName is required");
  if (!PHONE_RE.test(r.parentPhoneNumber)) {
    errors.push("parentPhoneNumber must be exactly 10 digits");
  }
  if (!r.panNumber) {
    errors.push("PAN is required");
  } else if (!PAN_RE.test(r.panNumber)) {
    errors.push("PAN must be valid (e.g. ABCDE1234F)");
  }
  const cls = r.class.trim();
  if (!cls) {
    errors.push("class is required");
  } else if (!STUDENT_CLASSES.includes(cls as StudentClass)) {
    errors.push(
      `class must be one of: ${STUDENT_CLASSES.join(", ")}`,
    );
  }
  let sec = r.section.trim().toUpperCase();
  if (!sec) {
    errors.push("section is required");
  } else if (!STUDENT_SECTIONS.includes(sec as StudentSection)) {
    errors.push(`section must be one of: ${STUDENT_SECTIONS.join(", ")}`);
  }
  return errors;
}

export function parseImportExcel(buffer: Buffer): ParsedImportRow[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  const out: ParsedImportRow[] = [];
  json.forEach((raw, i) => {
    const rowIndex = i + 2;
    const row = mapRow(rowIndex, raw);
    if (!isRowEmpty(row)) out.push(row);
  });
  return out;
}

export async function validateImportRows(
  tenantId: string,
  parsed: ParsedImportRow[],
): Promise<ValidateImportResult> {
  const tenant = await Tenant.findById(tenantId).select("tenantType").lean();
  if (tenant?.tenantType === "ACADEMY") {
    return {
      validRows: [],
      invalidRows: parsed.map((r) => ({
        rowIndex: r.rowIndex,
        row: rowToDisplayRecord(r),
        errors: ["Excel import is only supported for school tenants"],
      })),
    };
  }

  const validRows: ImportValidRow[] = [];
  const invalidRows: ImportInvalidRow[] = [];

  const scholarCounts = new Map<string, number>();
  for (const r of parsed) {
    const sid = r.scholarId.trim();
    if (sid) scholarCounts.set(sid, (scholarCounts.get(sid) ?? 0) + 1);
  }

  const scholarIds = [...new Set(parsed.map((r) => r.scholarId.trim()).filter(Boolean))];
  const existing = await Student.find({
    tenantId,
    scholarId: { $in: scholarIds },
  })
    .select({ scholarId: 1 })
    .lean()
    .exec();
  const existingSet = new Set(
    existing.map((d) => d.scholarId).filter(Boolean) as string[],
  );

  for (const r of parsed) {
    const errors = validateFields(r);
    const sid = r.scholarId.trim();

    if (sid && (scholarCounts.get(sid) ?? 0) > 1) {
      errors.push("Duplicate scholarId in file");
    }
    if (sid && existingSet.has(sid)) {
      errors.push("scholarId already exists in database");
    }

    const cls = r.class.trim() as StudentClass;
    const sec = r.section.trim().toUpperCase() as StudentSection;

    if (errors.length > 0) {
      invalidRows.push({
        rowIndex: r.rowIndex,
        row: rowToDisplayRecord(r),
        errors: [...new Set(errors)],
      });
      continue;
    }

    validRows.push({
      ...r,
      scholarId: sid,
      class: cls,
      section: sec,
    });
  }

  return { validRows, invalidRows };
}

function importRowToCreateInput(row: ImportValidRow): CreateStudentInput {
  return {
    studentName: row.studentName.trim(),
    scholarId: row.scholarId.trim(),
    parentName: row.parentName.trim(),
    parentPhoneNumber: row.parentPhoneNumber,
    panNumber: row.panNumber,
    class: row.class,
    section: row.section,
    status: "ACTIVE",
  };
}

export async function confirmImport(
  tenantId: string,
  validRows: ImportValidRow[],
): Promise<{ inserted: number }> {
  if (validRows.length === 0) {
    throw new Error("No rows to import");
  }

  const tenant = await Tenant.findById(tenantId).select("tenantType").lean();
  if (tenant?.tenantType === "ACADEMY") {
    throw new Error("Excel import is only supported for school tenants");
  }

  const revalidated = await validateImportRows(tenantId, validRows);
  if (revalidated.invalidRows.length > 0) {
    const first = revalidated.invalidRows[0];
    throw new Error(
      first.errors.join("; ") + ` (row ${first.rowIndex})`,
    );
  }

  const inputs = validRows.map(importRowToCreateInput);
  const docs = inputs.map((input) => ({
    tenantId,
    ...input,
  }));

  try {
    await Student.insertMany(docs, { ordered: true });
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? (err as { code?: number }).code : undefined;
    if (code === 11000) {
      throw new Error("Duplicate scholarId: one or more records already exist");
    }
    throw err;
  }

  return { inserted: docs.length };
}
