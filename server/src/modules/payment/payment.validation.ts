import Joi from "joi";

const mongoId24 = Joi.string()
  .hex()
  .length(24)
  .required()
  .messages({ "string.length": "id must be a valid 24-character hex id" });

/** POST /payments/create-order — amount in paise (smallest currency unit), optional; defaults to remaining balance. */
export const createOrderBodySchema = Joi.object({
  studentId: mongoId24,
  feeId: mongoId24,
  installmentId: Joi.string()
    .hex()
    .length(24)
    .optional()
    .messages({ "string.length": "installmentId must be a valid 24-character hex id" }),
  /** Amount in paise (integer). Omit to pay up to remaining balance. */
  amount: Joi.number().integer().positive().optional(),
  currency: Joi.string().trim().uppercase().default("INR"),
});

export type CreateOrderBody = {
  studentId: string;
  feeId: string;
  installmentId?: string;
  amount?: number;
  currency: string;
};
