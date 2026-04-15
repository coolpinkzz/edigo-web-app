import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: parseInt(process.env.PORT ?? "3000", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  /** Razorpay API key id (public) */
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
  /** Razorpay API key secret (server-side only) */
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
  /** Webhook signing secret from Razorpay dashboard */
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  /** Optional redirect after Payment Link checkout (must match Razorpay allowed URLs) */
  paymentLinkCallbackUrl: process.env.PAYMENT_LINK_CALLBACK_URL ?? "",
  /** Public base URL for SMS links, e.g. https://api.example.com (no trailing slash) */
  publicAppUrl: (process.env.PUBLIC_APP_URL ?? "").replace(/\/+$/, ""),
  /** Web app origin for redirects after Razorpay (e.g. http://localhost:5173), no trailing slash */
  clientAppUrl: (process.env.CLIENT_APP_URL ?? "").replace(/\/+$/, ""),
  /** Optional: POST /internal/reminders/run and manual cron trigger */
  cronSecret: process.env.CRON_SECRET ?? "",
  /** `console` | `twilio` — console logs SMS in dev when not twilio */
  smsProvider: (process.env.SMS_PROVIDER ?? "console").toLowerCase(),
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER ?? "",
  /** ISO 3166-1 alpha-2 for parsing local phone numbers without a + prefix (e.g. IN, US) */
  phoneDefaultRegion: process.env.PHONE_DEFAULT_REGION ?? "IN",
  /**
   * When true (default), forgot-password OTP request returns the same message whether
   * the phone is registered. Set to "false" only for debugging.
   */
  authObfuscatePhoneExists: process.env.AUTH_OBFUSCATE_PHONE_EXISTS !== "false",
  /**
   * Receives "Book a free demo" submissions from the public landing page.
   * Override via DEMO_NOTIFICATION_EMAIL.
   */
  demoNotificationEmail:
    process.env.DEMO_NOTIFICATION_EMAIL ?? "pratik.edigo@gmail.com",
  /** SMTP for outbound demo notifications (e.g. Gmail app password or provider SMTP). */
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: parseInt(process.env.SMTP_PORT ?? "587", 10),
  /** Use true for port 465; false for 587 STARTTLS. */
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  /** From header; defaults to SMTP_USER if unset. */
  smtpFrom: process.env.SMTP_FROM ?? "",
} as const;

export function isDemoEmailConfigured(): boolean {
  return (
    Boolean(env.smtpHost.trim()) &&
    Boolean(env.smtpUser.trim()) &&
    Boolean(env.smtpPass.trim())
  );
}
