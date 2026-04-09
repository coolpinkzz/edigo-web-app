import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, CardDescription, CardTitle } from "../components/ui";
import {
  fetchInvoiceWithRetry,
  getInvoiceDownloadUrl,
} from "../api/invoice.api";
import type { InvoiceDto } from "../types";
import { cn, getErrorMessage } from "../utils";

function formatMoneyPaise(paise: number, currency: string): string {
  const rupees = Math.round(paise) / 100;
  const sym = currency.toUpperCase() === "INR" ? "Rs " : `${currency} `;
  return `${sym}${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatIssued(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function PaymentSuccessPage() {
  const navigate = useNavigate();
  const { paymentId } = useParams<{ paymentId: string }>();
  const [invoice, setInvoice] = useState<InvoiceDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) {
      setLoading(false);
      setError("Missing payment reference.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const data = await fetchInvoiceWithRetry(paymentId);
        if (!cancelled) {
          setInvoice(data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(getErrorMessage(e));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  if (!paymentId) {
    return (
      <div className="flex min-h-full items-center justify-center bg-muted/40 px-4 py-16">
        <Card className="w-full max-w-lg p-8">
          <CardTitle>Invalid link</CardTitle>
          <CardDescription className="mt-2">
            This page needs a valid payment id in the URL.
          </CardDescription>
          <Button
            type="button"
            className="mt-6"
            onClick={() => {
              void navigate("/");
            }}
          >
            Go home
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-background via-muted/50 to-secondary/30 px-4 py-16">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-primary-foreground dark:bg-primary-950 dark:text-primary-300">
            ✓
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Payment successful
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Thank you. Your fee payment was received.
          </p>
        </div>

        <Card className="p-6 shadow-md">
          {loading && (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-4 w-1/2 rounded bg-muted" />
              <div className="h-10 w-full rounded bg-muted" />
            </div>
          )}

          {!loading && error && (
            <div className="space-y-4">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              <Button
                variant="secondary"
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  void fetchInvoiceWithRetry(paymentId)
                    .then(setInvoice)
                    .catch((e) => setError(getErrorMessage(e)))
                    .finally(() => setLoading(false));
                }}
              >
                Try again
              </Button>
            </div>
          )}

          {!loading && !error && invoice && (
            <div className="space-y-5">
              <div>
                {/* <CardDescription className="text-primary-foreground">School</CardDescription> */}
                <p className="text-lg font-medium text-foreground">
                  {invoice.schoolName}
                </p>
              </div>

              <div className="grid gap-3 border-t border-border pt-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Invoice</span>
                  <span className="font-mono text-foreground">
                    {invoice.invoiceNumber}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Student</span>
                  <span className="text-right text-foreground">
                    {invoice.studentName}
                    <span className="text-muted-foreground">
                      {" "}
                      · {invoice.studentClass} {invoice.studentSection}
                    </span>
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Fee</span>
                  <span className="text-right text-foreground">
                    {invoice.feeTitle}
                  </span>
                </div>
                {invoice.installmentLabel && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Installment</span>
                    <span className="text-right text-foreground">
                      {invoice.installmentLabel}
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Paid on</span>
                  <span className="text-foreground">
                    {formatIssued(invoice.issuedAt)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Method</span>
                  <span className="text-foreground">
                    {invoice.paymentMethod}
                  </span>
                </div>
                {invoice.razorpayPaymentId && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Reference</span>
                    <span className="break-all text-right font-mono text-xs text-foreground">
                      {invoice.razorpayPaymentId}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg bg-muted/60 px-4 py-3">
                <span className="font-medium text-foreground">Amount paid</span>
                <span className="text-xl font-semibold tabular-nums text-foreground">
                  {formatMoneyPaise(invoice.amount, invoice.currency)}
                </span>
              </div>

              <a
                href={getInvoiceDownloadUrl(paymentId)}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm",
                )}
              >
                Download invoice (PDF)
              </a>
            </div>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Keep this receipt for your records. Questions? Contact the school
          office.
        </p>
      </div>
    </div>
  );
}
