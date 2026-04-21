export { apiClient } from "./client";
export {
  createRazorpayLinkedAccount,
  createRazorpayRouteSettlements,
  getAuthMe,
  login,
  patchTenant,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPasswordAfterOtp,
} from "./auth.api";
export {
  createCourse,
  deleteCourse,
  getCourse,
  listCourses,
  updateCourse,
} from "./course.api";
export type { ListCoursesParams } from "./course.api";
export {
  assignFeeTemplate,
  createFeeTemplate,
  deleteFeeTemplate,
  getFeeTemplate,
  listFeeTemplates,
} from "./template.api";
export type { ListFeeTemplatesParams } from "./template.api";
export {
  createStudent,
  deleteStudent,
  getStudent,
  getStudentFeeOverview,
  listStudents,
  studentToFormValues,
  updateStudent,
} from "./student.api";
export type {
  ListStudentsParams,
  StudentFeeOverviewParams,
} from "./student.api";
export {
  addInstallmentsToFee,
  assignTemplateToFees,
  buildFeeLumpSumPaymentPayload,
  buildInstallmentPaymentPayload,
  getFee,
  listFees,
  patchFee,
  updateFeePayment,
  updateInstallment,
} from "./fee.api";
export type { ListFeesParams } from "./fee.api";
export { getDashboardOverview } from "./dashboard.api";
export type { DashboardOverviewParams } from "./dashboard.api";
export { getAttendance, markAttendance } from "./attendance.api";
export {
  getAttendanceDashboardSummary,
  getAttendanceDashboardTrend,
} from "./attendance-dashboard.api";
export type {
  AttendanceDashboardSummaryParams,
  AttendanceDashboardTrendParams,
} from "./attendance-dashboard.api";
export {
  inviteTeamMember,
  listTeamMembers,
  patchTeamMember,
} from "./team.api";
export { bookDemoRequest } from "./demo.api";
export type { BookDemoPayload } from "./demo.api";
