import { Link, useParams } from "react-router-dom";
import { FeeTemplateAssignPanel } from "../components/fees/FeeTemplateAssignPanel";
import { useFeeTemplate } from "../hooks/useFeeTemplate";

/**
 * Assign a fee structure by class/section or by explicit student selection (POST …/assign).
 */
export function AssignTemplatePage() {
  const { templateId } = useParams<{ templateId: string }>();
  const templateQuery = useFeeTemplate(templateId);

  if (!templateId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-red-600" role="alert">
          Missing fee structure.
        </p>
        <Link
          to="/fee-templates"
          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
        >
          Back to fee structures
        </Link>
      </div>
    );
  }

  if (templateQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Loading fee structure…</p>
      </div>
    );
  }

  if (templateQuery.isError || !templateQuery.data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-red-600" role="alert">
          {templateQuery.error instanceof Error
            ? templateQuery.error.message
            : "Fee structure not found."}
        </p>
        <Link
          to="/fee-templates"
          className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
        >
          Back to fee structures
        </Link>
      </div>
    );
  }

  const template = templateQuery.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div>
        <Link
          to="/fee-templates"
          className="text-sm font-medium text-primary hover:underline"
        >
          ← Fee structures
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">
          Assign fee structure
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose who should receive fees from this fee structure.
        </p>
      </div>

      <FeeTemplateAssignPanel
        templateId={templateId}
        templateSummary={{
          title: template.title,
          feeType: template.feeType,
          totalAmount: template.totalAmount,
          isInstallment: template.isInstallment,
          installmentAnchorDate: template.installmentAnchorDate,
          defaultInstallments: template.defaultInstallments,
        }}
      />
    </div>
  );
}
