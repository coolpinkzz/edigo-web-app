import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, Card } from "../components/ui";
import { useQuotation } from "../hooks/useQuotation";
import { useSendQuotationSms } from "../hooks/useSendQuotationSms";
import { downloadQuotationPdfBlob } from "../api/quotation.api";
import { getErrorMessage } from "../utils";

export function QuotationDetailPage() {
  const { quotationId } = useParams<{ quotationId: string }>();
  const q = useQuotation(quotationId);
  const sendSms = useSendQuotationSms();
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function handleDownloadPdf(): Promise<void> {
    if (!quotationId) return;
    setDownloadError(null);
    try {
      const blob = await downloadQuotationPdfBlob(quotationId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Quotation-${q.data?.quotationRef ?? quotationId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDownloadError(
        e instanceof Error ? e.message : "Could not download PDF",
      );
    }
  }

  if (q.isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading quotation…</p>
    );
  }
  if (q.isError || !q.data) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {getErrorMessage(q.error)}
      </p>
    );
  }

  const row = q.data;
  const canEdit =
    row.status !== "ACCEPTED" && row.status !== "REJECTED";
  const canSend =
    canEdit && row.status !== "EXPIRED";
  const hasStoredPdf = Boolean(
    row.pdfGeneratedAt ?? sendSms.data?.pdfGeneratedAt,
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-sm text-muted-foreground">
            {row.quotationRef}
          </p>
          <h1 className="text-2xl font-semibold text-foreground">{row.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/quotations">
            <Button type="button" variant="secondary">
              Back to list
            </Button>
          </Link>
          {canEdit && (
            <Link to={`/quotations/${row.id}/edit`}>
              <Button type="button" variant="secondary">
                Edit
              </Button>
            </Link>
          )}
        </div>
      </div>

      {downloadError && (
        <p className="text-sm text-red-600" role="alert">
          {downloadError}
        </p>
      )}

      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap gap-2">
          {hasStoredPdf && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleDownloadPdf()}
            >
              Download PDF
            </Button>
          )}
          {canSend && (
            <Button
              type="button"
              onClick={() => quotationId && sendSms.mutate(quotationId)}
              disabled={sendSms.isPending}
            >
              {sendSms.isPending ? "Sending…" : "Generate PDF & send SMS"}
            </Button>
          )}
        </div>
        {sendSms.isError && (
          <p className="text-sm text-red-600" role="alert">
            {getErrorMessage(sendSms.error)}
          </p>
        )}
        {sendSms.isSuccess && sendSms.data?.smsError && (
          <div
            className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
            role="status"
          >
            <p>
              PDF is ready, but SMS could not be sent:{" "}
              <span className="font-medium">{sendSms.data.smsError}</span>
            </p>
            <p>
              Use <strong>Download PDF</strong> (above) to share the quotation
              manually (e.g. WhatsApp or in person). The accept-and-pay link in
              the PDF still works for parents. You can try{" "}
              <strong>Generate PDF &amp; send SMS</strong> again to retry the
              message.
            </p>
          </div>
        )}
        {sendSms.isSuccess && !sendSms.data?.smsError && (
          <p className="text-sm text-emerald-700" role="status">
            SMS sent with PDF and accept-and-pay links. Parents use the secure
            links in the message or the PDF, not the staff app.
          </p>
        )}
      </Card>

      <Card className="space-y-3 p-6 text-sm">
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium">{row.status}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Branch</dt>
            <dd>{row.branchName ?? row.branchId}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Parent</dt>
            <dd>{row.parentName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Phone</dt>
            <dd>{row.phone}</dd>
          </div>
          {row.schoolClass && row.schoolSection ? (
            <>
              <div>
                <dt className="text-muted-foreground">Class</dt>
                <dd>{row.schoolClass}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Section</dt>
                <dd>{row.schoolSection}</dd>
              </div>
            </>
          ) : (
            <div>
              <dt className="text-muted-foreground">Course</dt>
              <dd>{row.courseDisplayName}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground">Fee structure</dt>
            <dd>{row.feeStructureTitle}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Base total</dt>
            <dd>
              Rs{" "}
              {row.feeStructureTotalAmount.toLocaleString("en-IN", {
                maximumFractionDigits: 2,
              })}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Discount</dt>
            <dd>
              {row.discountPercent}% (− Rs{" "}
              {row.discountAmount.toLocaleString("en-IN", {
                maximumFractionDigits: 2,
              })}
              )
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Quoted total</dt>
            <dd className="font-semibold text-foreground">
              Rs{" "}
              {row.quotedTotal.toLocaleString("en-IN", {
                maximumFractionDigits: 2,
              })}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Valid until</dt>
            <dd>{new Date(row.validUntil).toLocaleDateString("en-IN")}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Preferred time</dt>
            <dd>{row.preferredTimeSlot}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Address</dt>
            <dd className="whitespace-pre-wrap">{row.address}</dd>
          </div>
          {row.quotationOverview && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">PDF intro / overview</dt>
              <dd className="whitespace-pre-wrap">{row.quotationOverview}</dd>
            </div>
          )}
          {row.notes && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Notes</dt>
              <dd className="whitespace-pre-wrap">{row.notes}</dd>
            </div>
          )}
          {row.conversionStudentId && (
            <div>
              <dt className="text-muted-foreground">Enrolment student id</dt>
              <dd className="font-mono text-xs">{row.conversionStudentId}</dd>
            </div>
          )}
          {row.conversionFeeId && (
            <div>
              <dt className="text-muted-foreground">Fee id</dt>
              <dd className="font-mono text-xs">{row.conversionFeeId}</dd>
            </div>
          )}
        </dl>
      </Card>
    </div>
  );
}
