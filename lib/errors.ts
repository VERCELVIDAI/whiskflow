import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    // Preserve the concrete subclass name for logs and error assertions.
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Sign in to continue.") {
    super(401, "unauthorized", message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this resource.") {
    super(403, "forbidden", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found.") {
    super(404, "not_found", message);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Please check the submitted values.", details?: unknown) {
    super(422, "validation_error", message, details);
  }
}

export class InsufficientCreditsError extends AppError {
  constructor(required: number, available: number) {
    super(
      402,
      "insufficient_credits",
      `This generation needs ${required.toLocaleString()} credits, but only ${available.toLocaleString()} are available.`,
      { required, available },
    );
  }
}

export class ProviderError extends AppError {
  provider: string;

  constructor(provider: string, message: string, status = 502, details?: unknown) {
    super(status, "provider_error", message, details);
    this.provider = provider;
  }
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "Please check the submitted values.",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 422 },
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status },
    );
  }

  // Keep database setup failures actionable instead of turning them into a
  // generic 500. The class lives in lib/db to avoid a circular import.
  if (error instanceof Error && error.name === "DatabaseUnavailableError") {
    return NextResponse.json(
      {
        error: {
          code: "database_unavailable",
          message: error.message,
        },
      },
      { status: 503 },
    );
  }

  console.error("[whisk-flow] Unhandled route error", {
    name: error instanceof Error ? error.name : "Unknown",
    message: error instanceof Error ? error.message : String(error),
  });

  return NextResponse.json(
    {
      error: {
        code: "internal_error",
        message: "Something went wrong on our side. Please try again.",
      },
    },
    { status: 500 },
  );
}

export function logWarning(message: string, meta?: Record<string, unknown>) {
  console.warn(`[whisk-flow] ${message}`, meta ?? {});
}

export function logInfo(message: string, meta?: Record<string, unknown>) {
  console.info(`[whisk-flow] ${message}`, meta ?? {});
}
