import Joi from "joi";

const mongoId24 = Joi.string()
  .hex()
  .length(24)
  .required()
  .messages({ "string.length": "courseId must be a valid 24-character hex id" });

const createCourseBodySchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  shortCode: Joi.string().trim().max(50).optional().allow("", null).empty([null, ""]),
  description: Joi.string().trim().max(2000).optional().allow("", null).empty([null, ""]),
  sortOrder: Joi.number().integer().min(0).optional(),
  isActive: Joi.boolean().optional(),
});

const updateCourseBodySchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  shortCode: Joi.string().trim().max(50).optional().allow("", null).empty([null, ""]),
  description: Joi.string().trim().max(2000).optional().allow("", null).empty([null, ""]),
  sortOrder: Joi.number().integer().min(0).optional(),
  isActive: Joi.boolean().optional(),
})
  .min(1)
  .messages({
    "object.min": "Request body must contain at least one field to update",
  });

const listCoursesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  includeInactive: Joi.boolean().optional(),
}).unknown(false);

const courseIdParamsSchema = Joi.object({
  courseId: mongoId24,
});

export const createCourseSchema = {
  body: createCourseBodySchema,
};

export const updateCourseSchema = {
  params: courseIdParamsSchema,
  body: updateCourseBodySchema,
};

export const listCoursesSchema = {
  query: listCoursesQuerySchema,
};

export const getCourseSchema = {
  params: courseIdParamsSchema,
};

export const deleteCourseSchema = {
  params: courseIdParamsSchema,
};

export interface CreateCourseBody {
  name: string;
  shortCode?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export type UpdateCourseBody = Partial<CreateCourseBody>;

export interface ListCoursesQuery {
  page: number;
  limit: number;
  includeInactive?: boolean;
}
