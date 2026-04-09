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
} as const;
