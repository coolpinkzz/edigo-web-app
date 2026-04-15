import { Router } from "express";
import * as authController from "../modules/auth/auth.controller";
import * as teamController from "../modules/auth/team.controller";
import { patchTeamMemberSchema } from "../modules/auth/team.validation";
import { authenticate } from "../middleware/auth.middleware";
import {
  inviteRateLimit,
  loginRateLimit,
  signupRateLimit,
  passwordResetOtpRequestRateLimit,
  passwordResetOtpVerifyRateLimit,
  passwordResetSubmitRateLimit,
} from "../middleware/rate-limit.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  patchTenantBody,
  requestPasswordResetOtpBody,
  verifyPasswordResetOtpBody,
  resetPasswordAfterOtpBody,
} from "../modules/auth/auth.validation";
import { requireTenantAdmin } from "../middleware/rbac.middleware";
import * as authService from "../modules/auth/auth.service";
import { ROLES, Role } from "../types/roles";

const VALID_ROLES: Role[] = [ROLES.TENANT_ADMIN, ROLES.STAFF, ROLES.VIEWER];

const router = Router();

/**
 * @openapi
 * /auth/signup:
 *   post:
 *     tags: [Auth]
 *     summary: Register tenant and admin
 *     description: Creates a new tenant (organization) and the first TENANT_ADMIN user.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tenantName, tenantSlug, tenantType, phone, password, name]
 *             properties:
 *               tenantName:
 *                 type: string
 *                 example: Acme School
 *               tenantSlug:
 *                 type: string
 *                 description: URL-safe unique slug (used at login)
 *                 example: acme-school
 *               tenantType:
 *                 type: string
 *                 enum: [SCHOOL, ACADEMY]
 *                 description: SCHOOL uses class/section; ACADEMY uses course-oriented labels
 *               phone:
 *                 type: string
 *                 description: Mobile number (E.164 or local per PHONE_DEFAULT_REGION)
 *               password:
 *                 type: string
 *                 format: password
 *               name:
 *                 type: string
 *                 example: Admin User
 *     responses:
 *       201:
 *         description: Tenant and user created; JWT returned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthSuccess'
 *       400:
 *         description: Validation or signup error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Tenant slug already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login
 *     description: Authenticates a user and returns a JWT scoped to the tenant. Same phone may exist across tenants; tenantSlug selects which org.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, password, tenantSlug]
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Mobile number (E.164 or local per PHONE_DEFAULT_REGION)
 *               password:
 *                 type: string
 *                 format: password
 *               tenantSlug:
 *                 type: string
 *                 example: acme-school
 *     responses:
 *       200:
 *         description: JWT issued
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthSuccess'
 *       400:
 *         description: Missing fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Invalid credentials or tenant
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 * /auth/invite:
 *   post:
 *     tags: [Auth]
 *     summary: Invite user to tenant
 *     description: Creates a user for the current tenant. Requires TENANT_ADMIN or higher.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, name, role]
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Mobile number (E.164 or local per PHONE_DEFAULT_REGION)
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [TENANT_ADMIN, STAFF, VIEWER]
 *     responses:
 *       201:
 *         description: User created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 phone:
 *                   type: string
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Insufficient role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: User already exists in tenant
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Current session
 *     description: Returns JWT claims plus tenant name and tenantType (SCHOOL vs ACADEMY).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     tenantId:
 *                       type: string
 *                     role:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     name:
 *                       type: string
 *                       description: User display name (may be absent on older tokens)
 *                 tenant:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     tenantType:
 *                       type: string
 *                       enum: [SCHOOL, ACADEMY]
 *       401:
 *         description: Missing or invalid token
 */

/**
 * @openapi
 * /auth/request-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset OTP (SMS)
 *     description: Sends a 6-digit code if the phone is registered for the tenant. Same response when obfuscation is enabled (default).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, tenantSlug]
 *             properties:
 *               phone:
 *                 type: string
 *               tenantSlug:
 *                 type: string
 *                 description: Organization slug (same as login)
 *     responses:
 *       200:
 *         description: Generic success message (see description)
 *       400:
 *         description: Invalid phone or tenant (when obfuscation disabled)
 *       503:
 *         description: SMS provider unavailable
 * /auth/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify password reset OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, tenantSlug, otp]
 *             properties:
 *               phone: { type: string }
 *               tenantSlug: { type: string }
 *               otp: { type: string, pattern: '^\\d{6}$' }
 *     responses:
 *       200:
 *         description: OTP verified; proceed to reset password within the time window
 *       400:
 *         description: Invalid or expired code
 *       429:
 *         description: Too many wrong attempts or rate limit
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Set new password after OTP verification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, tenantSlug, newPassword]
 *             properties:
 *               phone: { type: string }
 *               tenantSlug: { type: string }
 *               newPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password updated
 *       400:
 *         description: Weak password or verification expired
 */

/** Public routes */
router.post("/signup", signupRateLimit, authController.signup);
router.post("/login", loginRateLimit, authController.login);

router.post(
  "/request-otp",
  passwordResetOtpRequestRateLimit,
  validate({ body: requestPasswordResetOtpBody }),
  (req, res) => {
    void authController.requestPasswordResetOtp(req, res);
  },
);

router.post(
  "/verify-otp",
  passwordResetOtpVerifyRateLimit,
  validate({ body: verifyPasswordResetOtpBody }),
  (req, res) => {
    void authController.verifyPasswordResetOtp(req, res);
  },
);

router.post(
  "/reset-password",
  passwordResetSubmitRateLimit,
  validate({ body: resetPasswordAfterOtpBody }),
  (req, res) => {
    void authController.resetPassword(req, res);
  },
);

/** Protected: invite user to tenant (tenant admin only) */
router.post(
  "/invite",
  inviteRateLimit,
  authenticate,
  requireTenantAdmin,
  async (req, res) => {
    try {
      const { phone, name, role } = req.body;
      if (!phone || !name || !role) {
        res.status(400).json({ error: "phone, name, role are required" });
        return;
      }
      if (!VALID_ROLES.includes(role)) {
        res.status(400).json({ error: "Invalid role" });
        return;
      }
      const result = await authService.inviteUser({
        phone,
        name,
        role,
        tenantId: req.user!.tenantId,
        inviterUserId: req.user!.userId,
      });
      res.status(201).json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invite failed";
      const code = message.includes("already exists") ? 409 : 400;
      res.status(code).json({ error: message });
    }
  },
);

/** Protected: get current user info and tenant type */
router.get("/me", authenticate, (req, res) => {
  void authController.me(req, res);
});

/** Tenant admin: update organization display name */
router.patch(
  "/tenant",
  authenticate,
  requireTenantAdmin,
  validate({ body: patchTenantBody }),
  (req, res) => {
    void authController.patchTenant(req, res);
  },
);

/** Tenant admin: list team members */
router.get("/team", authenticate, requireTenantAdmin, (req, res) => {
  void teamController.list(req, res);
});

/** Tenant admin: update role / active flag */
router.patch(
  "/team/:userId",
  authenticate,
  requireTenantAdmin,
  validate(patchTeamMemberSchema),
  (req, res) => {
    void teamController.updateMember(req, res);
  },
);

export default router;
