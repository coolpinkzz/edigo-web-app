import Joi from "joi";

export const bookDemoBodySchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  phone: Joi.string().trim().min(5).max(32).required(),
  email: Joi.string().trim().email().max(254).required(),
});
