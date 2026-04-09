import Joi from "joi";

const mongoId24 = Joi.string()
  .hex()
  .length(24)
  .required()
  .messages({ "string.length": "id must be a valid 24-character hex id" });

export const installmentReminderParamsSchema = {
  params: Joi.object({
    installmentId: mongoId24,
  }),
};

export const feeReminderParamsSchema = {
  params: Joi.object({
    feeId: mongoId24,
  }),
};
