type LogContext = Record<string, unknown>;

const sensitiveField = /answer|body|token|secret|password|authorization|cookie/i;

function omitSensitiveFields(context: LogContext): LogContext {
  return Object.fromEntries(
    Object.entries(context).flatMap(([key, value]) => {
      if (sensitiveField.test(key)) {
        return [];
      }

      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        return [[key, omitSensitiveFields(value as LogContext)]];
      }

      return [[key, value]];
    }),
  );
}

export function logError(event: string, context: LogContext = {}): void {
  console.error(
    JSON.stringify({
      level: "error",
      event,
      ...omitSensitiveFields(context),
    }),
  );
}
