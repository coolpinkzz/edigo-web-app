import type { StudentClass, StudentSection } from "./student.types";

export type AttendanceRecordStatus = "PRESENT" | "ABSENT";

export interface AttendanceRecordDto {
  studentId: string;
  status: AttendanceRecordStatus;
  remark?: string;
}

export interface AttendanceDto {
  id: string;
  tenantId: string;
  dateKey: string;
  class: StudentClass;
  section: StudentSection;
  records: AttendanceRecordDto[];
  markedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarkAttendancePayload {
  dateKey: string;
  class: StudentClass;
  section: StudentSection;
  records: AttendanceRecordDto[];
}
