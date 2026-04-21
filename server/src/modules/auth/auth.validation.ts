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

const registeredAddressSchema = Joi.object({
  street1: Joi.string().trim().min(1).max(200).required(),
  street2: Joi.string().trim().max(200).allow("").optional(),
  city: Joi.string().trim().min(1).max(100).required(),
  state: Joi.string().trim().min(1).max(100).required(),
  postalCode: Joi.string().trim().min(1).max(20).required(),
  country: Joi.string().trim().length(2).uppercase().required(),
});

/**
 * Tenant admin: POST /auth/razorpay-linked-account — Razorpay Route linked account payload.
 * PAN format only; entity-type vs `business_type` is enforced by Razorpay.
 */
export const createLinkedAccountBody = Joi.object({
  email: Joi.string().trim().email().required(),
  phone: Joi.string()
    .trim()
    .required()
    .custom((value, helpers) => {
      const digits = String(value).replace(/\D/g, "");
      if (digits.length < 8 || digits.length > 15) {
        return helpers.message({
          custom: "phone must contain 8–15 digits",
        });
      }
      return value;
    }),
  legalBusinessName: Joi.string().trim().min(4).max(200).required(),
  customerFacingBusinessName: Joi.string().trim().min(1).max(255).optional(),
  contactName: Joi.string().trim().min(4).max(255).required(),
  businessType: Joi.string().trim().min(2).max(64).required(),
  profile: Joi.object({
    category: Joi.string().trim().min(1).max(128).required(),
    subcategory: Joi.string().trim().min(1).max(128).required(),
    addresses: Joi.object({
      registered: registeredAddressSchema.required(),
    }).required(),
  }).required(),
  legalInfo: Joi.object({
    pan: Joi.string()
      .trim()
      .pattern(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/)
      .required(),
    gst: Joi.string()
      .trim()
      .pattern(
        /^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}[1-9A-Za-z]{1}Z[0-9A-Za-z]{1}$/,
      )
      .optional()
      .allow(""),
  }).required(),
});

/** Tenant admin: POST /auth/razorpay-route-settlements — bank details sent to Razorpay only (not stored). */
export const razorpayRouteSettlementsBody = Joi.object({
  tncAccepted: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      "any.only": "You must accept Razorpay Route terms and conditions",
    }),
  beneficiaryName: Joi.string().trim().min(4).max(255).required(),
  accountNumber: Joi.string()
    .trim()
    .required()
    .custom((value, helpers) => {
      const digits = String(value).replace(/\s/g, "");
      if (!/^\d{5,20}$/.test(digits)) {
        return helpers.message({
          custom: "account number must be 5–20 digits",
        });
      }
      return value;
    }),
  ifscCode: Joi.string()
    .trim()
    .length(11)
    .pattern(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/)
    .required()
    .messages({
      "string.pattern.base": "enter a valid 11-character IFSC code",
    }),
});
