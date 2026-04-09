import { Navigate, Route, Routes } from "react-router-dom";
import { AcademyOnlyRoute } from "../components/AcademyOnlyRoute";
import { AdminOnlyRoute } from "../components/AdminOnlyRoute";
import { FeeAdminRoute } from "../components/FeeAdminRoute";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { StaffRedirectRoute } from "../components/StaffRedirectRoute";
import { MainLayout } from "../layouts/MainLayout";
import { AssignTemplatePage } from "../pages/AssignTemplatePage";
import { AttendancePage } from "../pages/AttendancePage";
import { AttendanceDashboardPage } from "../pages/AttendanceDashboardPage";
import { CoursesListPage } from "../pages/CoursesListPage";
import { CreateTemplatePage } from "../pages/CreateTemplatePage";
import { DashboardPage } from "../pages/DashboardPage";
import { FeeOverviewPage } from "../pages/FeeOverviewPage";
import { LoginPage } from "../pages/LoginPage";
import { StudentDetailPage } from "../pages/StudentDetailPage";
import { StudentFormPage } from "../pages/StudentFormPage";
import { StudentImportPage } from "../pages/StudentImportPage";
import { StudentsListPage } from "../pages/StudentsListPage";
import { OverduePage } from "../pages/OverduePage";
import { TeamManagementPage } from "../pages/TeamManagementPage";
import { TemplatesListPage } from "../pages/TemplatesListPage";
import { PaymentAlreadyPaidPage } from "../pages/PaymentAlreadyPaidPage";
import { PaymentSuccessPage } from "../pages/PaymentSuccessPage";
import { ComingSoonPage } from "../pages/ComingSoonPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ComingSoonPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/payment-already-paid"
        element={<PaymentAlreadyPaidPage />}
      />
      <Route
        path="/payment-success/:paymentId"
        element={<PaymentSuccessPage />}
      />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<MainLayout />}>
          <Route
            path="dashboard"
            element={
              <StaffRedirectRoute>
                <DashboardPage />
              </StaffRedirectRoute>
            }
          />
          <Route
            path="fee-overview"
            element={
              <FeeAdminRoute>
                <FeeOverviewPage />
              </FeeAdminRoute>
            }
          />
          <Route
            path="overdue"
            element={
              <FeeAdminRoute>
                <OverduePage />
              </FeeAdminRoute>
            }
          />
          <Route path="attendance" element={<AttendancePage />} />
          <Route
            path="attendance/dashboard"
            element={<AttendanceDashboardPage />}
          />
          <Route
            path="team-management"
            element={
              <AdminOnlyRoute>
                <TeamManagementPage />
              </AdminOnlyRoute>
            }
          />
          <Route
            path="courses"
            element={
              <AdminOnlyRoute>
                <AcademyOnlyRoute>
                  <CoursesListPage />
                </AcademyOnlyRoute>
              </AdminOnlyRoute>
            }
          />
          <Route
            path="students"
            element={
              <StaffRedirectRoute>
                <StudentsListPage />
              </StaffRedirectRoute>
            }
          />
          <Route
            path="students/import"
            element={
              <StaffRedirectRoute>
                <StudentImportPage />
              </StaffRedirectRoute>
            }
          />
          <Route
            path="students/new"
            element={
              <StaffRedirectRoute>
                <StudentFormPage />
              </StaffRedirectRoute>
            }
          />
          <Route
            path="students/:studentId/edit"
            element={
              <StaffRedirectRoute>
                <StudentFormPage />
              </StaffRedirectRoute>
            }
          />
          <Route
            path="students/:studentId"
            element={
              <StaffRedirectRoute>
                <StudentDetailPage />
              </StaffRedirectRoute>
            }
          />
          <Route
            path="fee-templates"
            element={
              <FeeAdminRoute>
                <TemplatesListPage />
              </FeeAdminRoute>
            }
          />
          <Route
            path="fee-templates/new"
            element={
              <FeeAdminRoute>
                <CreateTemplatePage />
              </FeeAdminRoute>
            }
          />
          <Route
            path="fee-templates/:templateId/assign"
            element={
              <FeeAdminRoute>
                <AssignTemplatePage />
              </FeeAdminRoute>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
