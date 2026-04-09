import { env } from "../../config/env";
import { logger } from "../../utils/logger";
import { normalizePhone } from "../../utils/phone.util";

const SCOPE = "sms.service";

export type SendSmsResult = { ok: true } | { ok: false; error: string };

/**
 * Sends SMS. In development or when SMS_PROVIDER=console, logs the body instead of calling Twilio.
 * `to` may be E.164 or a local number (parsed with PHONE_DEFAULT_REGION).
 */
export async function sendSms(
  to: string,
  body: string,
): Promise<SendSmsResult> {
  const toE164 = normalizePhone(to);
  if (!toE164) {
    return { ok: false, error: "invalid phone" };
  }

  if (
    env.smsProvider !== "twilio" ||
    !env.twilioAccountSid ||
    !env.twilioAuthToken
  ) {
    logger.info(SCOPE, "SMS (console)", {
      to: maskPhone(toE164),
      bodyLength: body.length,
      body,
    });
    return { ok: true };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.twilioAccountSid)}/Messages.json`;
  const auth = Buffer.from(
    `${env.twilioAccountSid}:${env.twilioAuthToken}`,
    "utf8",
  ).toString("base64");

  const form = new URLSearchParams();
  form.set("To", toE164);
  form.set("From", env.twilioFromNumber);
  form.set("Body", body);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    if (!res.ok) {
      const t = await res.text();
      logger.error(SCOPE, "Twilio SMS failed", { status: res.status, body: t });
      return { ok: false, error: `twilio ${res.status}` };
    }
    logger.info(SCOPE, "SMS sent", {
      to: maskPhone(toE164),
      bodyLength: body.length,
    });
    return { ok: true };
  } catch (err) {
    logger.error(SCOPE, "Twilio SMS request error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "network" };
  }
}

function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length <= 4) return "****";
  return `***${d.slice(-4)}`;
}
