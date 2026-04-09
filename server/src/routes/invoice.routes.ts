import { Router } from "express";
import * as invoiceController from "../modules/invoice/invoice.controller";

const router = Router();

/**
 * Public: payment success page loads invoice by internal payment id (Mongo ObjectId).
 * No auth — protect by unguessable id; only SUCCESS payments resolve to an invoice.
 */
router.get("/:paymentId/download", (req, res) => {
  void invoiceController.downloadInvoice(req, res);
});

router.get("/:paymentId", (req, res) => {
  void invoiceController.getInvoice(req, res);
});

export default router;
