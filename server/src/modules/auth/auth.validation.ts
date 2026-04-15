import Joi from "joi";

const phoneField = Joi.string().trim().required().messages({
  "string.empty": "phone is required",
});

const tenantSlugField = Joi.string().trim().required().messages({
  "string.empty": "tenantSlug is required",
});

/** 6-digit OTP (matches server generator). */
const otpField = Joi.string()
  .pattern(/^\d{6}$/)
  .required()
  .messages({
    "string.pattern.base": "otp must be exactly 6 digits",
  });

const strongPassword = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/)
  .required()
  .messages({
    "string.pattern.base":
      "newPassword must include uppercase, lowercase, a number, and a special character",
  });

export const requestPasswordResetOtpBody = Joi.object({
  phone: phoneField,
  tenantSlug: tenantSlugField,
});

export const verifyPasswordResetOtpBody = Joi.object({
  phone: phoneField,
  tenantSlug: tenantSlugField,
  otp: otpField,
});

export const resetPasswordAfterOtpBody = Joi.object({
  phone: phoneField,
  tenantSlug: tenantSlugField,
  newPassword: strongPassword,
});

export const patchTenantBody = Joi.object({
  name: Joi.string().trim().min(1).max(200).required().messages({
    "string.empty": "name is required",
  }),
});
