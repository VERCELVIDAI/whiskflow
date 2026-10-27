import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { appUrl } from "@/lib/config";

export function json<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers ?? {}),
    },
  });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError(400, "invalid_json", "The request body must be valid JSON.");
  }
}

export function searchParam(request: Request, key: string): string | undefined {
  const value = new URL(request.url).searchParams.get(key);
  return value === null || value === "" ? undefined : value;
}

export function booleanParam(request: Request, key: string): boolean {
  const value = new URL(request.url).searchParams.get(key);
  return value === "1" || value === "true";
}

export function intParam(request: Request, key: string, fallback: number): number {
  const value = Number(new URL(request.url).searchParams.get(key));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const requestUrl = new URL(request.url);
  const allowed = new Set([requestUrl.origin, appUrl()]);

  // Behind a proxy (or when Next normalizes request.url to localhost), the
  // browser's Origin can be the public host while request.url is internal.
  // Trust the host the request was actually sent to.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost?.split(",")[0]?.trim() || request.headers.get("host");
  if (host) {
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const proto = forwardedProto?.split(",")[0]?.trim() || requestUrl.protocol.replace(":", "");
    allowed.add(`${proto}://${host}`);
  }

  try {
    const originUrl = new URL(origin);
    if (!allowed.has(originUrl.origin)) {
      throw new AppError(403, "invalid_origin", "This request did not come from Whisk Flow.");
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(403, "invalid_origin", "This request did not come from Whisk Flow.");
  }
}
