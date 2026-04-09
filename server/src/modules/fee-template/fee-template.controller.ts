import { Request, Response } from "express";
import * as feeTemplateService from "./fee-template.service";
import {
  AssignFeeTemplateBody,
  CreateFeeTemplateBody,
  ListFeeTemplatesQuery,
  UpdateFeeTemplateBody,
} from "./fee-template.validation";

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as CreateFeeTemplateBody;
    const tenantId = req.user!.tenantId;

    const created = await feeTemplateService.createFeeTemplate(tenantId, {
      title: body.title,
      description: body.description,
      feeType: body.feeType,
      category: body.category,
      totalAmount: body.totalAmount,
      isInstallment: body.isInstallment,
      defaultInstallments: body.isInstallment ? body.defaultInstallments : [],
      installmentAnchorDate: body.isInstallment
        ? body.installmentAnchorDate
        : undefined,
      defaultEndDate: !body.isInstallment ? body.defaultEndDate : undefined,
      metadata: body.metadata,
      tags: body.tags,
    });

    res.status(201).json(created);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create fee template";
    res.status(400).json({ error: message });
  }
}

export async function list(req: Request, res: Response): Promise<void> {
  const q = req.query as unknown as ListFeeTemplatesQuery;
  const tenantId = req.user!.tenantId;

  const result = await feeTemplateService.listFeeTemplates(tenantId, {
    page: q.page,
    limit: q.limit,
    feeType: q.feeType,
  });

  res.json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const { templateId } = req.params as { templateId: string };

  const result = await feeTemplateService.getFeeTemplateById(
    tenantId,
    templateId,
  );
  if (!result) {
    res.status(404).json({ error: "Fee template not found" });
    return;
  }
  res.json(result);
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as UpdateFeeTemplateBody;
    const tenantId = req.user!.tenantId;
    const { templateId } = req.params as { templateId: string };

    const updated = await feeTemplateService.updateFeeTemplate(
      tenantId,
      templateId,
      {
        title: body.title,
        description: body.description,
        feeType: body.feeType,
        category: body.category,
        totalAmount: body.totalAmount,
        isInstallment: body.isInstallment,
        defaultInstallments: body.isInstallment ? body.defaultInstallments : [],
        installmentAnchorDate: body.isInstallment
          ? body.installmentAnchorDate
          : undefined,
        defaultEndDate: !body.isInstallment ? body.defaultEndDate : undefined,
        metadata: body.metadata,
        tags: body.tags,
      },
    );

    if (!updated) {
      res.status(404).json({ error: "Fee template not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update fee template";
    res.status(400).json({ error: message });
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const { templateId } = req.params as { templateId: string };

    const result = await feeTemplateService.deleteFeeTemplate(
      tenantId,
      templateId,
    );
    if (!result) {
      res.status(404).json({ error: "Fee template not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete fee template";
    res.status(400).json({ error: message });
  }
}

export async function assign(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as AssignFeeTemplateBody;
    const tenantId = req.user!.tenantId;
    const { id } = req.params as { id: string };

    const result = await feeTemplateService.assignFeeTemplateToStudents(
      tenantId,
      id,
      {
        studentIds: body.studentIds,
        class: body.class,
        section: body.section,
        assignmentAnchorDate: body.assignmentAnchorDate,
        feeOverrides: body.feeOverrides,
        perStudentOverrides: body.perStudentOverrides,
      },
    );

    res.status(200).json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to assign fee template";
    const status = message === "Fee template not found" ? 404 : 400;
    res.status(status).json({ error: message });
  }
}
