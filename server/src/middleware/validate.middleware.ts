import { NextFunction, Request, RequestHandler, Response } from "express";
import Joi, { ObjectSchema, ValidationError } from "joi";

/**
 * Per-request validation: supply any combination of `body`, `params`, and `query`
 * Joi object schemas. Only keys you pass are validated; others are left untouched.
 *
 * Flow:
 * 1. For each part (body / params / query), run Joi.validate with stripUnknown + convert.
 * 2. On success, replace `req.body` / `req.params` / `req.query` with the validated
 *    values (coerced types, unknown keys stripped).
 * 3. On failure, respond with 400 and a structured error — controllers never run.
 *
 * Controllers should treat input as already valid; keep only domain rules there
 * (e.g. “patch would clear a required field” after merge with existing row).
 */
export interface ValidationSchemas {
  body?: ObjectSchema;
  params?: ObjectSchema;
  query?: ObjectSchema;
}

const defaultJoiOptions: Joi.ValidationOptions = {
  abortEarly: false,
  stripUnknown: true,
  convert: true,
};

function formatValidationError(error: ValidationError): {
  error: string;
  details: { path: string; message: string }[];
} {
  const details = error.details.map((d) => ({
    path: d.path.length ? d.path.join(".") : "(root)",
    message: d.message.replace(/"/g, ""),
  }));
  const errorSummary = details.map((d) => d.message).join("; ");
  return { error: errorSummary, details };
}

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (schemas.body) {
      const { error, value } = schemas.body.validate(req.body, defaultJoiOptions);
      if (error) {
        const payload = formatValidationError(error);
        res.status(400).json(payload);
        return;
      }
      req.body = value;
    }

    if (schemas.params) {
      const { error, value } = schemas.params.validate(
        req.params,
        defaultJoiOptions,
      );
      if (error) {
        const payload = formatValidationError(error);
        res.status(400).json(payload);
        return;
      }
      req.params = value;
    }

    if (schemas.query) {
      const { error, value } = schemas.query.validate(
        req.query,
        defaultJoiOptions,
      );
      if (error) {
        const payload = formatValidationError(error);
        res.status(400).json(payload);
        return;
      }
      req.query = value;
    }

    next();
  };
}
