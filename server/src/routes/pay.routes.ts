import { Router } from "express";
import { getPayPage } from "../modules/payment/pay.controller";
import { payLinkRateLimit } from "../middleware/rate-limit.middleware";

const router = Router();

router.get("/:token", payLinkRateLimit, (req, res) => {
  void getPayPage(req, res);
});

export default router;
