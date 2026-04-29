export { apiClient } from "./client";
export {
  createRazorpayLinkedAccount,
  createRazorpayRouteSettlements,
  getAuthMe,
  login,
  patchTenant,
  requestPasswordResetOtp,
  resetPasswordAfterOtp,
  TENANT_LOGO_MAX_BYTES,
  uploadTenantLogoAndGetUrl,
  verifyPasswordResetOtp,
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
  createBranch,
  deleteBranch,
  getBranch,
  listBranches,
  updateBranch,
} from "./branch.api";
export {
  assignFeeTemplate,
  createFeeTemplate,
  deleteFeeTemplate,
  getFeeTemplate,
  listFeeTemplates,
  updateFeeTemplate,
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
export {
  createQuotation,
  downloadQuotationPdfBlob,
  getQuotation,
  listQuotations,
  sendQuotationPdfSms,
  updateQuotation,
} from "./quotation.api";
export type { ListQuotationsParams } from "./quotation.api";
