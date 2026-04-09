import { Role } from './roles';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: Role;
  phone: string;
  /** Display name; omitted on tokens issued before this claim existed. */
  name?: string;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      /** Raw JSON body buffer (set when using express.json verify) for webhook signature verification. */
      rawBody?: Buffer;
    }
  }
}
