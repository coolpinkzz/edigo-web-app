import { Request, Response } from "express";
import {
  getInvoiceDtoByPaymentId,
  getInvoicePdfBufferByPaymentId,
} from "./invoice.service";

export async function getInvoice(req: Request, res: Response): Promise<void> {
  const paymentId =
    typeof req.params.paymentId === "string" ? req.params.paymentId : "";
  const dto = await getInvoiceDtoByPaymentId(paymentId);
  if (!dto) {
    res.status(404).json({ message: "Invoice not found" });
    return;
  }
  res.json(dto);
}

export async function downloadInvoice(
  req: Request,
  res: Response,
): Promise<void> {
  const paymentId =
    typeof req.params.paymentId === "string" ? req.params.paymentId : "";
  const result = await getInvoicePdfBufferByPaymentId(paymentId);
  if (!result) {
    res.status(404).json({ message: "Invoice not found" });
    return;
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${result.filename}"`,
  );
  res.send(result.buffer);
}
