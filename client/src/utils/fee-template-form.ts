import type { CreateFeeTemplateFormValues, FeeTemplateDto } from "../types";
import { defaultInstallmentsToFormRows } from "./installments";

/** Maps GET /fee-templates/:id into the create/edit form shape. */
export function feeTemplateDtoToFormValues(
  dto: FeeTemplateDto,
): CreateFeeTemplateFormValues {
  return {
    title: dto.title,
    feeType: dto.feeType,
    totalAmount: dto.totalAmount,
    isInstallment: dto.isInstallment,
    installments: dto.isInstallment
      ? defaultInstallmentsToFormRows(
          dto.defaultInstallments,
          dto.installmentAnchorDate,
        )
      : [],
    defaultEndDate: dto.defaultEndDate?.trim() ?? "",
  };
}
