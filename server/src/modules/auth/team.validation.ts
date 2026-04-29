import Joi from "joi";
import { ROLES } from "../../types/roles";

const mongoUserIdParams = Joi.object({
  userId: Joi.string()
    .hex()
    .length(24)
    .required()
    .messages({ "string.length": "userId must be a valid 24-character hex id" }),
});

const assignableRole = Joi.string()
  .valid(ROLES.TENANT_ADMIN, ROLES.STAFF, ROLES.VIEWER)
  .messages({ "any.only": "role must be TENANT_ADMIN, STAFF, or VIEWER" });

const mongoId24 = Joi.string().hex().length(24);

export const patchTeamMemberSchema = {
  params: mongoUserIdParams,
  body: Joi.object({
    role: assignableRole.optional(),
    isActive: Joi.boolean().optional(),
    branchIds: Joi.array()
      .items(mongoId24)
      .allow(null)
      .optional()
      .description(
        "Restrict member to these branches, or null/[] for full tenant access",
      ),
  })
    .min(1)
    .messages({
      "object.min":
        "Provide at least one of role, isActive, or branchIds",
    })
    .unknown(false),
};
