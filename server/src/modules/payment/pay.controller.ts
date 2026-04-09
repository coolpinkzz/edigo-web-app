import { Request, Response } from "express";
import { env } from "../../config/env";
import { createOrderForPayToken } from "./payment.service";
import { recordPayLinkAccess } from "../reminder/reminder.service";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderErrorHtml(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 0 1rem; color: #1a1a1a; }
    h1 { font-size: 1.25rem; }
    p { line-height: 1.5; color: #444; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(message)}</p>
</body>
</html>`;
}

function renderCheckoutHtml(input: {
  key: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  paymentId: string;
  studentName: string;
  feeTitle: string;
}): string {
  const name = escapeHtml(input.studentName);
  const desc = escapeHtml(input.feeTitle);
  const successUrl =
    env.clientAppUrl !== ""
      ? `${env.clientAppUrl}/payment-success/${encodeURIComponent(input.paymentId)}`
      : "";
  const successUrlJson = JSON.stringify(successUrl);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pay fee</title>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
</head>
<body>
  <p>Opening secure checkout for <strong>${name}</strong> — ${desc}…</p>
  <script>
    (function () {
      var successUrl = ${successUrlJson};
      var options = {
        key: ${JSON.stringify(input.key)},
        amount: ${String(input.amountPaise)},
        currency: ${JSON.stringify(input.currency)},
        order_id: ${JSON.stringify(input.orderId)},
        name: "Fee payment",
        description: ${JSON.stringify(input.feeTitle)},
        handler: function () {
          if (successUrl) {
            window.location.href = successUrl;
          } else {
            window.location.reload();
          }
        },
        modal: { ondismiss: function () { document.body.innerHTML = "<p>Payment window closed. You can reopen this link to try again.</p>"; } }
      };
      var rzp = new Razorpay(options);
      rzp.open();
    })();
  </script>
</body>
</html>`;
}

/**
 * GET /pay/:token — public; creates/refreshes Razorpay order and opens Checkout.
 */
export async function getPayPage(req: Request, res: Response): Promise<void> {
  const token = typeof req.params.token === "string" ? req.params.token : "";
  await recordPayLinkAccess(token);
  const checkout = await createOrderForPayToken(token);

  if (!checkout.ok) {
    if (checkout.code === "expired") {
      res
        .status(410)
        .send(
          renderErrorHtml("Link expired", checkout.message),
        );
      return;
    }
    if (checkout.code === "already_paid") {
      if (env.clientAppUrl !== "") {
        res.redirect(
          302,
          `${env.clientAppUrl}/payment-already-paid`,
        );
        return;
      }
      res
        .status(200)
        .send(
          renderErrorHtml("Already paid", checkout.message),
        );
      return;
    }
    if (checkout.code === "invalid") {
      res
        .status(404)
        .send(
          renderErrorHtml("Invalid link", checkout.message),
        );
      return;
    }
    res
      .status(500)
      .send(
        renderErrorHtml("Payment unavailable", checkout.message),
      );
    return;
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(renderCheckoutHtml(checkout));
}
