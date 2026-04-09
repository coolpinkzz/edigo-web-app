import { createHash } from "crypto";
import type { CreateFeeInput } from "./fee.types";

/**
 * Deterministic stringification for hashing (sorted object keys).
 */
function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as object).sort();
    return `{${keys
      .map(
        (k) =>
          `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Fingerprint of the create-fee payload so the same key cannot map to different bodies.
 */
export function hashFeeCreatePayload(input: CreateFeeInput): string {
  if (input.source === "TEMPLATE") {
    const normalized = {
      source: "TEMPLATE" as const,
      studentId: input.studentId,
      templateId: input.templateId,
      assignmentAnchorDate: input.assignmentAnchorDate
        ? input.assignmentAnchorDate.toISOString()
        : null,
      feeOverrides: input.feeOverrides ?? null,
    };
    return createHash("sha256")
      .update(stableStringify(normalized), "utf8")
      .digest("hex");
  }

  const normalized = {
    source: "CUSTOM" as const,
    studentId: input.studentId,
    title: input.title,
    description: input.description ?? null,
    feeType: input.feeType,
    category: input.category ?? null,
    metadata: input.metadata ?? null,
    totalAmount: input.totalAmount,
    paidAmount: input.paidAmount ?? 0,
    startDate: input.startDate ? input.startDate.toISOString() : null,
    endDate: input.endDate ? input.endDate.toISOString() : null,
    tags: input.tags ? [...input.tags].sort() : null,
  };
  return createHash("sha256")
    .update(stableStringify(normalized), "utf8")
    .digest("hex");
}
