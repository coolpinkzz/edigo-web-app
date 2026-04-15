import express, { Application, Request, Response } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import authRoutes from "./routes/auth.routes";
import studentRoutes from "./routes/student.routes";
import feeRoutes from "./routes/fee.routes";
import feeTemplateRoutes from "./routes/fee-template.routes";
import courseRoutes from "./routes/course.routes";
import paymentRoutes from "./routes/payment.routes";
import payRoutes from "./routes/pay.routes";
import reminderRoutes from "./routes/reminder.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import attendanceRoutes from "./routes/attendance.routes";
import invoiceRoutes from "./routes/invoice.routes";
import publicRoutes from "./routes/public.routes";
import { swaggerSpec } from "./config/swagger";
import { env } from "./config/env";
import { runInstallmentReminders } from "./modules/reminder/reminder.service";

const app: Application = express();

// Respect proxy headers (needed for accurate client IP behind load balancers).
app.set("trust proxy", 1);

// Middleware
app.use(cors());
const captureRawJsonBody: NonNullable<
  Parameters<typeof express.json>[0]
>["verify"] = (req, _res, buf) => {
  (req as Request).rawBody = buf;
};

app.use(express.json({ verify: captureRawJsonBody }));
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Public landing (no auth)
app.use("/public", publicRoutes);

// API root
app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Fee Management API" });
});

// Swagger UI — interactive API docs (spec built from JSDoc in src/routes)
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, { explorer: true }),
);

// Raw OpenAPI JSON (optional, useful for tooling)
app.get("/docs.json", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// Auth routes (signup, login, invite, me)
app.use("/auth", authRoutes);

// Student routes (documented under /api/students in Swagger)
app.use("/students", studentRoutes);

// Fee & installment routes
app.use("/fees", feeRoutes);

// Fee templates (blueprints + bulk assign to students)
app.use("/fee-templates", feeTemplateRoutes);

// Course catalog (tenant-specific; student.courseId references Course id)
app.use("/courses", courseRoutes);

// Razorpay payments (create-order + webhook)
app.use("/payments", paymentRoutes);

// Public pay page from SMS reminder (opaque token → Razorpay Checkout)
app.use("/pay", payRoutes);

// Invoices (public read by payment id — issued after successful gateway capture)
app.use("/invoices", invoiceRoutes);

// Staff: run installment reminders on demand (JWT)
app.use("/reminders", reminderRoutes);

// Dashboard analytics (JWT)
app.use("/dashboard", dashboardRoutes);

// Class attendance (JWT)
app.use("/attendance", attendanceRoutes);

// Manual / secured reminder trigger (set CRON_SECRET and send header X-Cron-Secret)
app.post("/internal/reminders/run", async (req, res) => {
  const secret = req.header("x-cron-secret") ?? "";
  if (!env.cronSecret || secret !== env.cronSecret) {
    res.status(401).json({ ok: false, message: "unauthorized" });
    return;
  }
  try {
    const summary = await runInstallmentReminders();
    res.json({ ok: true, summary });
  } catch (err: unknown) {
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});

export default app;
