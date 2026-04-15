import { Request, Response } from "express";
import * as feeService from "./fee.service";
import * as feeTemplateService from "../fee-template/fee-template.service";
import {
  AddInstallmentsBody,
  AssignTemplateToStudentsBody,
  CreateFeeBody,
  ListFeesQuery,
  ListOverdueFeesQuery,
  parseIdempotencyKeyHeader,
  UpdateFeeBody,
  UpdateInstallmentBody,
} from "./fee.validation";

/**
 * HTTP handlers for fees and installments. Joi validates inputs in routes.
 */

export async function create(req: Request, res: Response): Promise<void> {
  try {
    let idempotencyKey: string | undefined;
    try {
      idempotencyKey = parseIdempotencyKeyHeader(req);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Invalid Idempotency-Key";
      res.status(400).json({ error: message });
      return;
    }

    const body = req.body as CreateFeeBody;
    const tenantId = req.user!.tenantId;

    const result = await feeService.createFee(
      tenantId,
      body,
      idempotencyKey ? { idempotencyKey } : undefined,
    );

    res.status(result.replay ? 200 : 201).json(result.fee);
  } catch (err) {
    if (err instanceof feeService.IdempotencyConflictError) {
      res.status(409).json({ error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : "Failed to create fee";
    const status =
      message === "Idempotency record refers to missing fee" ? 500 : 400;
    res.status(status).json({ error: message });
  }
}

export async function assignTemplate(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as AssignTemplateToStudentsBody;
    const tenantId = req.user!.tenantId;

    const result = await feeTemplateService.assignFeeTemplateToStudents(
      tenantId,
      body.templateId,
      {
        assignmentType: body.assignmentType,
        studentIds: body.studentIds,
        class: body.class as feeTemplateService.AssignTemplateInput["class"],
        section: body.section,
        customInstallments: body.customInstallments,
        perStudentOverrides: body.perStudentDiscounts
          ? Object.fromEntries(
              Object.entries(body.perStudentDiscounts).map(
                ([studentId, discount]) => [studentId, { discount }],
              ),
            )
          : undefined,
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

export async function list(req: Request, res: Response): Promise<void> {
  const q = req.query as unknown as ListFeesQuery;
  const tenantId = req.user!.tenantId;

  const result = await feeService.listFees(tenantId, {
    page: q.page,
    limit: q.limit,
    studentId: q.studentId,
    status: q.status,
    feeType: q.feeType,
  });

  res.json(result);
}

export async function listOverdue(req: Request, res: Response): Promise<void> {
  const q = req.query as unknown as ListOverdueFeesQuery;
  const tenantId = req.user!.tenantId;

  const result = await feeService.listOverdueFees(tenantId, {
    page: q.page,
    limit: q.limit,
    feeType: q.feeType,
    class: q.class as feeService.ListOverdueFeesParams["class"],
    courseId: q.courseId,
    search: q.search,
  });

  res.json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const tenantId = req.user!.tenantId;
  const { feeId } = req.params as { feeId: string };

  const result = await feeService.getFeeById(tenantId, feeId);
  if (!result) {
    res.status(404).json({ error: "Fee not found" });
    return;
  }
  res.json(result);
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as UpdateFeeBody;
    const tenantId = req.user!.tenantId;
    const { feeId } = req.params as { feeId: string };

    const updated = await feeService.updateFee(tenantId, feeId, {
      title: body.title,
      description: body.description,
      feeType: body.feeType,
      category: body.category,
      metadata: body.metadata,
      totalAmount: body.totalAmount,
      paidAmount: body.paidAmount,
      startDate: body.startDate,
      endDate: body.endDate,
      tags: body.tags,
    });

    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update fee";
    const status =
      message === "Fee not found" ? 404 : 400;
    res.status(status).json({ error: message });
  }
}

export async function addInstallments(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as AddInstallmentsBody;
    const tenantId = req.user!.tenantId;
    const { feeId } = req.params as { feeId: string };

    const result = await feeService.addInstallmentsToFee(
      tenantId,
      feeId,
      body.installments,
    );

    res.status(201).json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to add installments";
    const status = message === "Fee not found" ? 404 : 400;
    res.status(status).json({ error: message });
  }
}

export async function recalculateStatus(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const tenantId = req.user!.tenantId;
    const { feeId } = req.params as { feeId: string };

    const fee = await feeService.recalculateFeeStatus(tenantId, feeId);
    res.json(fee);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to recalculate fee status";
    const status = message === "Fee not found" ? 404 : 400;
    res.status(status).json({ error: message });
  }
}

export async function updateInstallment(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const body = req.body as UpdateInstallmentBody;
    const tenantId = req.user!.tenantId;
    const { feeId, installmentId } = req.params as {
      feeId: string;
      installmentId: string;
    };

    const result = await feeService.updateInstallment(
      tenantId,
      feeId,
      installmentId,
      {
        amount: body.amount,
        paidAmount: body.paidAmount,
        dueDate: body.dueDate,
        lateFee: body.lateFee,
        discount: body.discount,
        metadata: body.metadata,
      },
    );

    res.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update installment";
    const status =
      message === "Fee not found" || message === "Installment not found"
        ? 404
        : 400;
    res.status(status).json({ error: message });
  }
}
