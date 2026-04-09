import { Schema } from 'mongoose';

/**
 * Adds tenantId to any schema for multi-tenant isolation.
 * Use with Schema.add() or merge into your schema definition.
 */
export const tenantIdField = {
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
};

/**
 * Creates an index definition for tenant-scoped queries.
 */
export function tenantIndex(additionalFields: Record<string, 1 | -1> = {}) {
  return { tenantId: 1 as const, ...additionalFields };
}
