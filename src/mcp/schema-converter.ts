/**
 * JSON Schema to TypeBox Converter
 *
 * Converts MCP tool schemas (JSON Schema) to TypeBox schemas
 * for validation in new_indusagi.
 *
 * Reference: mastra uses zod-from-json-schema, we adapt to TypeBox
 */

import { Type, type TSchema, type Static } from "@sinclair/typebox";

/**
 * JSON Schema types we support
 */
interface JSONSchema {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema | JSONSchema[];
  enum?: (string | number | boolean | null)[];
  const?: string | number | boolean | null;
  additionalProperties?: boolean | JSONSchema;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean;
  exclusiveMaximum?: number | boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  minItems?: number;
  maxItems?: number;
  multipleOf?: number;
  default?: unknown;
  oneOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  allOf?: JSONSchema[];
  $ref?: string;
}

/**
 * Convert JSON Schema to TypeBox schema.
 *
 * Handles:
 * - Primitive types (string, number, boolean, null)
 * - Objects with properties
 * - Arrays with items
 * - Optional fields (not in required array)
 * - Enums
 * - Nested structures
 */
export function jsonSchemaToTypeBox(schema: JSONSchema): TSchema {
  // Handle null type
  if (schema.type === "null") {
    return Type.Null({ description: schema.description });
  }

  // Handle enum
  if (schema.enum) {
    if (schema.enum.length === 1) {
      return Type.Literal(schema.enum[0] as string | number | boolean, {
        description: schema.description,
      });
    }
    const literals = schema.enum.map((e) => {
      if (e === null) return Type.Null();
      return Type.Literal(e as string | number | boolean);
    });
    return Type.Union(literals, { description: schema.description });
  }

  // Handle const
  if (schema.const !== undefined) {
    if (schema.const === null) {
      return Type.Null({ description: schema.description });
    }
    return Type.Literal(schema.const as string | number | boolean, {
      description: schema.description,
    });
  }

  // Handle oneOf/anyOf
  if (schema.oneOf || schema.anyOf) {
    const schemas = (schema.oneOf || schema.anyOf)!.map((s) => jsonSchemaToTypeBox(s));
    return Type.Union(schemas, { description: schema.description });
  }

  // Handle allOf
  if (schema.allOf) {
    const schemas = schema.allOf.map((s) => jsonSchemaToTypeBox(s));
    return Type.Intersect(schemas, { description: schema.description });
  }

  // Handle array type
  if (schema.type === "array" || (Array.isArray(schema.type) && schema.type.includes("array"))) {
    return convertArraySchema(schema);
  }

  // Handle object type
  if (schema.type === "object" || (Array.isArray(schema.type) && schema.type.includes("object"))) {
    return convertObjectSchema(schema);
  }

  // Handle primitive types
  switch (schema.type) {
    case "string":
      return convertStringSchema(schema);
    case "number":
    case "integer":
      return convertNumberSchema(schema);
    case "boolean":
      return Type.Boolean({ description: schema.description });
    default:
      // If no type is specified, try to infer from structure
      if (schema.properties) {
        return convertObjectSchema(schema);
      }
      if (schema.items) {
        return convertArraySchema(schema);
      }
      // Fallback to any
      return Type.Any({ description: schema.description });
  }
}

/**
 * Convert string JSON Schema to TypeBox.
 */
function convertStringSchema(schema: JSONSchema): TSchema {
  return Type.String({
    description: schema.description,
    minLength: schema.minLength,
    maxLength: schema.maxLength,
    pattern: schema.pattern,
    format: schema.format as any,
  });
}

/**
 * Convert number/integer JSON Schema to TypeBox.
 */
function convertNumberSchema(schema: JSONSchema): TSchema {
  const options: Record<string, unknown> = {
    description: schema.description,
  };

  if (schema.minimum !== undefined) options.minimum = schema.minimum;
  if (schema.maximum !== undefined) options.maximum = schema.maximum;
  if (typeof schema.exclusiveMinimum === "number") options.exclusiveMinimum = schema.exclusiveMinimum;
  if (typeof schema.exclusiveMaximum === "number") options.exclusiveMaximum = schema.exclusiveMaximum;
  if (schema.multipleOf !== undefined) options.multipleOf = schema.multipleOf;

  return Type.Number(options);
}

/**
 * Convert array JSON Schema to TypeBox.
 */
function convertArraySchema(schema: JSONSchema): TSchema {
  let itemsSchema: TSchema;

  if (schema.items) {
    if (Array.isArray(schema.items)) {
      // Tuple schema
      const items = schema.items.map((item) => jsonSchemaToTypeBox(item));
      itemsSchema = Type.Tuple(items);
    } else {
      // Array schema
      itemsSchema = jsonSchemaToTypeBox(schema.items);
    }
  } else {
    itemsSchema = Type.Any();
  }

  return Type.Array(itemsSchema, {
    description: schema.description,
    minItems: schema.minItems,
    maxItems: schema.maxItems,
  });
}

/**
 * Convert object JSON Schema to TypeBox.
 */
function convertObjectSchema(schema: JSONSchema): TSchema {
  const properties: Record<string, TSchema> = {};
  const required = new Set(schema.required ?? []);

  // Convert properties
  for (const [key, value] of Object.entries(schema.properties ?? {})) {
    let propSchema = jsonSchemaToTypeBox(value);

    // Make optional if not in required
    if (!required.has(key)) {
      propSchema = Type.Optional(propSchema);
    }

    properties[key] = propSchema;
  }

  // Handle additionalProperties
  let additionalProperties: TSchema | boolean | undefined = undefined;
  if (schema.additionalProperties === true) {
    additionalProperties = true;
  } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    additionalProperties = jsonSchemaToTypeBox(schema.additionalProperties);
  } else if (schema.additionalProperties === false) {
    additionalProperties = false;
  }

  return Type.Object(properties, {
    description: schema.description,
    additionalProperties,
  });
}

/**
 * Apply passthrough to allow extra properties.
 *
 * MCP servers may return extra fields not in the schema,
 * so we use passthrough to avoid validation errors.
 */
export function applyPassthrough(schema: TSchema): TSchema {
  // Check if it's an object type
  const kind = (schema as any)[Symbol.for("TypeBox.Kind")];

  if (kind === "Object") {
    const shape = { ...(schema as any).properties };

    // Recursively process nested schemas
    for (const key of Object.keys(shape)) {
      shape[key] = applyPassthrough(shape[key]);
    }

    return Type.Object(shape, {
      description: (schema as any).description,
      additionalProperties: true,
    });
  }

  if (kind === "Array") {
    return Type.Array(applyPassthrough((schema as any).items), {
      description: (schema as any).description,
      minItems: (schema as any).minItems,
      maxItems: (schema as any).maxItems,
    });
  }

  if (kind === "Union") {
    return Type.Union(
      (schema as any).anyOf.map((s: TSchema) => applyPassthrough(s)),
      { description: (schema as any).description }
    );
  }

  if (kind === "Intersect") {
    return Type.Intersect(
      (schema as any).allOf.map((s: TSchema) => applyPassthrough(s)),
      { description: (schema as any).description }
    );
  }

  if (kind === "Optional") {
    return Type.Optional(applyPassthrough((schema as any).schema ?? (schema as any).type));
  }

  return schema;
}

/**
 * Convert MCP tool inputSchema to TypeBox with passthrough.
 * This is the main entry point for converting MCP tool schemas.
 */
export function convertMCPInputSchema(inputSchema: Record<string, unknown>): TSchema {
  const typeboxSchema = jsonSchemaToTypeBox(inputSchema as JSONSchema);
  return applyPassthrough(typeboxSchema);
}

/**
 * Convert MCP tool outputSchema to TypeBox with passthrough.
 */
export function convertMCPOutputSchema(outputSchema: Record<string, unknown> | undefined): TSchema | undefined {
  if (!outputSchema) return undefined;
  const typeboxSchema = jsonSchemaToTypeBox(outputSchema as JSONSchema);
  return applyPassthrough(typeboxSchema);
}
