import { Request, Response } from "express";
import { BranchAccessError } from "../../types/branch-scope";
import * as quotationService from "./quotation.service";
import type {
  CreateQuotationBody,
  ListQuotationsQuery,
  QuotationAcceptStaffBody,
  UpdateQuotationBody,
} from "./quotation.validation";
import { acceptQuotationPreparePayment } from "./quotation-accept.service";

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as CreateQuotationBody;
    const q = await quotationService.createQuotation(
      req.user!.tenantId,
      req.user!,
      body,
    );
    res.status(201).json(q);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create quotation";
    res.status(400).json({ error: message });
  }
}

export async function list(req: Request, res: Response): Promise<void> {
  const q = req.query as unknown as ListQuotationsQuery;
  let branchScope;
  try {
    branchScope = quotationService.resolveBranchScopeFromRequest(
      req.user!,
      q.branchId,
    );
  } catch (e) {
    if (e instanceof BranchAccessError) {
      res.status(403).json({ error: (e as Error).message });
      return;
    }
    throw e;
  }
  const result = await quotationService.listQuotations(
    req.user!.tenantId,
    req.user!,
    branchScope,
    {
      status: q.status,
      page: q.page,
      limit: q.limit,
    },
  );
  res.json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  try {
    const q = await quotationService.getQuotationById(
      req.user!.tenantId,
      req.params.id,
      req.user!,
    );
    if (!q) {
      res.status(404).json({ error: "Quotation not found" });
      return;
    }
    res.json(q);
  } catch (e) {
    if (e instanceof BranchAccessError) {
      res.status(403).json({ error: (e as Error).message });
      return;
    }
    throw e;
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as UpdateQuotationBody;
    const q = await quotationService.updateQuotation(
      req.user!.tenantId,
      req.params.id,
      req.user!,
      body,
    );
    if (!q) {
      res.status(404).json({ error: "Quotation not found" });
      return;
    }
    res.json(q);
  } catch (e) {
    if (e instanceof BranchAccessError) {
      res.status(403).json({ error: (e as Error).message });
      return;
    }
    const message =
      e instanceof Error ? e.message : "Failed to update quotation";
    res.status(400).json({ error: message });
  }
}

export async function downloadPdf(req: Request, res: Response): Promise<void> {
  try {
    const result = await quotationService.streamStoredPdfAuthed(
      req.user!.tenantId,
      req.params.id,
      req.user!,
    );
    if (!result) {
      res.status(404).json({
        error:
          "PDF not found. Generate and send the quotation first, or the file was removed.",
      });
      return;
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${result.filename}"`,
    );
    res.send(result.buffer);
  } catch (e) {
    if (e instanceof BranchAccessError) {
      res.status(403).json({ error: (e as Error).message });
      return;
    }
    throw e;
  }
}

/**
 * POST /quotations/:id/accept-checkout — staff; creates student+fee if needed and returns Razorpay pay URL.
 */
export async function acceptCheckout(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as QuotationAcceptStaffBody;
    const result = await acceptQuotationPreparePayment({
      quotationId: req.params.id,
      accessUser: req.user!,
      schoolClass: body.class,
      schoolSection: body.section,
    });
    res.json(result);
  } catch (e) {
    if (e instanceof BranchAccessError) {
      res.status(403).json({ error: (e as Error).message });
      return;
    }
    const message =
      e instanceof Error ? e.message : "Could not start payment";
    res.status(400).json({ error: message });
  }
}

export async function sendPdfSms(req: Request, res: Response): Promise<void> {
  try {
    const q = await quotationService.generateStorePdfAndSendSms(
      req.user!.tenantId,
      req.params.id,
      req.user!,
    );
    if (!q) {
      res.status(404).json({ error: "Quotation not found" });
      return;
    }
    res.json(q);
  } catch (e) {
    if (e instanceof BranchAccessError) {
      res.status(403).json({ error: (e as Error).message });
      return;
    }
    const message =
      e instanceof Error ? e.message : "Failed to send quotation SMS";
    res.status(400).json({ error: message });
  }
}
