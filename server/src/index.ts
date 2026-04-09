import cron from "node-cron";
import app from "./app";
import { connectDB, disconnectDB } from "./db/connect";
import { env } from "./config/env";
import { BUSINESS_TIMEZONE } from "./config/timezone";
import { runInstallmentReminders } from "./modules/reminder/reminder.service";
import { runSettlementSyncJob } from "./modules/settlement/settlement.service";
import { logger } from "./utils/logger";

async function bootstrap(): Promise<void> {
  await connectDB();

  // Daily 08:00 IST — fee SMS reminders (installments + lump-sum due within 3 days or overdue)
  cron.schedule(
    "0 8 * * *",
    () => {
      void runInstallmentReminders().catch((err: unknown) => {
        logger.error(
          "reminder.cron",
          "scheduled reminder run failed",
          { error: err instanceof Error ? err.message : String(err) },
        );
      });
    },
    { timezone: BUSINESS_TIMEZONE },
  );

  // Every 6 hours — Razorpay settlement list + link payments to settlement ids
  cron.schedule(
    "0 */6 * * *",
    () => {
      void runSettlementSyncJob().catch((err: unknown) => {
        logger.error(
          "settlement.cron",
          "settlement sync failed",
          { error: err instanceof Error ? err.message : String(err) },
        );
      });
    },
    { timezone: "UTC" },
  );

  const host = "0.0.0.0";
  const server = app.listen(env.port, host, () => {
    console.log(`Server running on http://${host}:${env.port}`);
    console.log(`Environment: ${env.nodeEnv}`);
    if (!env.razorpayWebhookSecret.trim()) {
      console.warn(
        "[config] RAZORPAY_WEBHOOK_SECRET is empty — POST /payments/webhook will reject all requests (signature verification).",
      );
    }
    if (!env.publicAppUrl) {
      console.warn(
        "[config] PUBLIC_APP_URL is empty — installment SMS reminders will skip until set.",
      );
    }
  });

  // Graceful shutdown
  const shutdown = async () => {
    server.close(() => console.log('HTTP server closed'));
    await disconnectDB();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
