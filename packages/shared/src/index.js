/**
 * @relay-mcp/shared - Shared types, schemas, and constants
 */
// Export all types
export * from "./types/index.js";
// Export constants
export * from "./constants.js";
// Export JSON schemas (for runtime validation with ajv)
import capsuleSchema from "./schemas/capsule.schema.json" assert { type: "json" };
import relayConfigSchema from "./schemas/relay-config.schema.json" assert { type: "json" };
export const schemas = {
    capsule: capsuleSchema,
    relayConfig: relayConfigSchema,
};
