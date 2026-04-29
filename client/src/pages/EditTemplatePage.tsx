import { useParams } from "react-router-dom";
import { CreateTemplatePage } from "./CreateTemplatePage";

/** `/fee-templates/:templateId/edit` — reuses the create form in edit mode. */
export function EditTemplatePage() {
  const { templateId } = useParams<{ templateId: string }>();
  return <CreateTemplatePage mode="edit" templateId={templateId} />;
}
