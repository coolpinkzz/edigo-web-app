import nodemailer from "nodemailer";
import { env, isDemoEmailConfigured } from "../../config/env";
import { logger } from "../../utils/logger";

export type DemoRequestPayload = {
  name: string;
  phone: string;
  email: string;
};

function buildTransporter() {
  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });
}

const fromAddress = (): string =>
  env.smtpFrom.trim() || env.smtpUser;

/**
 * Runs at server bootstrap: logs whether demo email SMTP is configured and
 * whether nodemailer can connect (verify).
 */
export async function verifyDemoEmailOnStartup(): Promise<void> {
  if (!isDemoEmailConfigured()) {
    logger.warn(
      "demo.email",
      "SMTP not configured — demo booking emails disabled (set SMTP_HOST, SMTP_USER, SMTP_PASS)",
    );
    return;
  }

  const transporter = buildTransporter();
  try {
    await transporter.verify();
    logger.info("demo.email", "SMTP connected and verified", {
      host: env.smtpHost,
      port: env.smtpPort,
      notifyTo: env.demoNotificationEmail,
    });
  } catch (err: unknown) {
    logger.error(
      "demo.email",
      "SMTP verify failed — check host, port, SMTP_SECURE, and credentials",
      {
        host: env.smtpHost,
        port: env.smtpPort,
        message: err instanceof Error ? err.message : String(err),
      },
    );
  }
}

export async function sendDemoRequestEmail(
  payload: DemoRequestPayload,
): Promise<void> {
  if (!isDemoEmailConfigured()) {
    throw new Error("SMTP is not configured");
  }

  const { name, phone, email } = payload;
  const submittedAt = new Date().toISOString();
  const subject = `Edigo demo request — ${name}`;
  const text = [
    "Someone requested a demo from the Edigo landing page.",
    "",
    `Name: ${name}`,
    `Phone: ${phone}`,
    `Email: ${email}`,
    "",
    `Submitted at (UTC): ${submittedAt}`,
  ].join("\n");

  const html = `
    <p>Someone requested a demo from the Edigo landing page.</p>
    <ul>
      <li><strong>Name:</strong> ${escapeHtml(name)}</li>
      <li><strong>Phone:</strong> ${escapeHtml(phone)}</li>
      <li><strong>Email:</strong> ${escapeHtml(email)}</li>
    </ul>
    <p style="color:#666;font-size:12px;">Submitted at (UTC): ${escapeHtml(submittedAt)}</p>
  `;

  const transporter = buildTransporter();
  await transporter.sendMail({
    from: fromAddress(),
    to: env.demoNotificationEmail,
    replyTo: email,
    subject,
    text,
    html,
  });

  logger.info("demo.public", "demo request email sent", {
    to: env.demoNotificationEmail,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
