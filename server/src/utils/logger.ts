import { env } from "../config/env";

type LogMeta = Record<string, unknown>;

function format(
  level: string,
  scope: string,
  message: string,
  meta?: LogMeta,
): string {
  const base = `[${new Date().toISOString()}] [${level}] [${scope}] ${message}`;
  if (meta && Object.keys(meta).length > 0) {
    return `${base} ${JSON.stringify(meta)}`;
  }
  return base;
}

export const logger = {
  info(scope: string, message: string, meta?: LogMeta): void {
    console.log(format("INFO", scope, message, meta));
  },
  warn(scope: string, message: string, meta?: LogMeta): void {
    console.warn(format("WARN", scope, message, meta));
  },
  error(scope: string, message: string, meta?: LogMeta): void {
    console.error(format("ERROR", scope, message, meta));
  },
  debug(scope: string, message: string, meta?: LogMeta): void {
    if (env.nodeEnv === "development") {
      console.log(format("DEBUG", scope, message, meta));
    }
  },
};
