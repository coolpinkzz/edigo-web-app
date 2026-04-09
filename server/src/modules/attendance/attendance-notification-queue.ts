import { logger } from "../../utils/logger";
import { sendSms } from "../reminder/sms.service";
import { AttendanceAbsenceNotification } from "./attendance-absence-notification.model";

const SCOPE = "attendance.notification.queue";

export type AttendanceSmsJob = {
  notificationId: string;
  phone: string;
  message: string;
};

const pending: AttendanceSmsJob[] = [];
let draining = false;

/**
 * In-process FIFO queue (async SMS after attendance save).
 */
export function enqueueAttendanceSmsJobs(jobs: AttendanceSmsJob[]): void {
  if (jobs.length === 0) return;
  pending.push(...jobs);
  void drainQueue();
}

async function drainQueue(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (pending.length > 0) {
      const job = pending.shift()!;
      try {
        const sms = await sendSms(job.phone, job.message);
        await AttendanceAbsenceNotification.updateOne(
          { _id: job.notificationId },
          {
            $set: sms.ok
              ? { jobStatus: "sent", sentAt: new Date(), lastError: undefined }
              : { jobStatus: "failed", lastError: sms.error ?? "sms_failed" },
          },
        ).exec();
        if (!sms.ok) {
          logger.error(SCOPE, "attendance absence SMS failed", {
            notificationId: job.notificationId,
            error: sms.error,
          });
        } else {
          logger.info(SCOPE, "attendance absence SMS sent", {
            notificationId: job.notificationId,
          });
        }
      } catch (err) {
        logger.error(SCOPE, "attendance SMS job error", {
          notificationId: job.notificationId,
          error: err instanceof Error ? err.message : String(err),
        });
        await AttendanceAbsenceNotification.updateOne(
          { _id: job.notificationId },
          {
            $set: {
              jobStatus: "failed",
              lastError: err instanceof Error ? err.message : String(err),
            },
          },
        ).exec();
      }
    }
  } finally {
    draining = false;
  }
}
