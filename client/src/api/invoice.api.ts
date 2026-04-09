import { env } from "../constants";
import type { InvoiceDto } from "../types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Loads invoice JSON for a successful payment. May 404 briefly until the webhook creates the row.
 */
export async function fetchInvoiceWithRetry(
  paymentId: string,
  options?: { maxAttempts?: number; delayMs?: number },
): Promise<InvoiceDto> {
  const maxAttempts = options?.maxAttempts ?? 10;
  const delayMs = options?.delayMs ?? 800;
  let lastStatus = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(
      `${env.apiBaseUrl}/invoices/${encodeURIComponent(paymentId)}`,
    );
    lastStatus = res.status;
    if (res.ok) {
      return (await res.json()) as InvoiceDto;
    }
    if (res.status !== 404) {
      const text = await res.text();
      throw new Error(text || `Request failed (${res.status})`);
    }
    if (attempt < maxAttempts - 1) {
      await sleep(delayMs);
    }
  }

  throw new Error(
    lastStatus === 404
      ? "Invoice is not ready yet. If you completed payment, try again in a moment."
      : "Could not load invoice.",
  );
}

export function getInvoiceDownloadUrl(paymentId: string): string {
  return `${env.apiBaseUrl}/invoices/${encodeURIComponent(paymentId)}/download`;
}
