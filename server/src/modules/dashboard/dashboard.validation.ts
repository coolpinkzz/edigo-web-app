import Joi from "joi";

/** GET /dashboard/overview — ISO datetimes for `from` / `to` (inclusive range). */
export const dashboardOverviewQuerySchema = Joi.object({
  from: Joi.date().iso().required(),
  to: Joi.date().iso().required(),
  compare: Joi.boolean()
    .truthy("true", "1", "yes")
    .falsy("false", "0", "no")
    .optional()
    .default(false),
}).custom((value, helpers) => {
  if (value.from.getTime() > value.to.getTime()) {
    return helpers.error("any.invalid");
  }
  return value;
});

/** GET /dashboard/revenue-trend */
export const revenueTrendQuerySchema = Joi.object({
  from: Joi.date().iso().required(),
  to: Joi.date().iso().required(),
  granularity: Joi.string()
    .valid("daily", "weekly", "monthly")
    .required(),
}).custom((value, helpers) => {
  if (value.from.getTime() > value.to.getTime()) {
    return helpers.error("any.invalid");
  }
  const maxMs = 2 * 365 * 24 * 60 * 60 * 1000;
  if (value.to.getTime() - value.from.getTime() > maxMs) {
    return helpers.error("any.invalid");
  }
  return value;
});

/** GET /dashboard/settlements */
export const dashboardSettlementsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
});
