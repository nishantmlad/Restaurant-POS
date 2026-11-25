import { toNestErrors } from "@hookform/resolvers";
import type { FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";

/**
 * Zod v4 compatible resolver for React Hook Form.
 * Standard @hookform/resolvers/zod checks `Array.isArray(error.errors)`,
 * but Zod v4 stores issues in `error.issues` and removes `error.errors`,
 * causing @hookform/resolvers/zod to rethrow ZodError uncaught.
 */
export function zodResolver<TFieldValues extends FieldValues = FieldValues>(
  schema: z.ZodType<TFieldValues, any, any>,
): Resolver<TFieldValues> {
  return async (values, _context, options) => {
    const result = await schema.safeParseAsync(values);

    if (result.success) {
      return {
        values: result.data,
        errors: {},
      };
    }

    const flatErrors: Record<string, { type: string; message: string }> = {};

    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (!flatErrors[path]) {
        flatErrors[path] = {
          type: issue.code,
          message: issue.message,
        };
      }
    }

    return {
      values: {},
      errors: toNestErrors(flatErrors, options),
    };
  };
}
