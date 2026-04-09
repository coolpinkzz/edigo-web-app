import type {
  AttendanceDto,
  MarkAttendancePayload,
} from "../types/attendance.types";
import type { StudentClass, StudentSection } from "../types/student.types";
import { apiClient } from "./client";

export async function getAttendance(params: {
  dateKey: string;
  class: StudentClass;
  section: StudentSection;
}): Promise<AttendanceDto | null> {
  const { data } = await apiClient.get<{ attendance: AttendanceDto | null }>(
    "/attendance",
    { params },
  );
  return data.attendance;
}

export async function markAttendance(
  payload: MarkAttendancePayload,
): Promise<AttendanceDto> {
  const { data } = await apiClient.post<{ attendance: AttendanceDto }>(
    "/attendance/mark",
    payload,
  );
  return data.attendance;
}
