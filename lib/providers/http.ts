import { ProviderError } from "@/lib/errors";

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
}

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

export async function fetchWithPolicy(
  provider: string,
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  const { timeoutMs = 90_000, retries = 0, ...init } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      if (!response.ok && RETRYABLE_STATUS.has(response.status) && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
        continue;
      }
    }
  }

  if (lastError instanceof Error && lastError.name === "TimeoutError") {
    throw new ProviderError(provider, "The generation provider timed out. Please try again.");
  }
  throw new ProviderError(
    provider,
    "Could not reach the generation provider. Check your connection and try again.",
  );
}

export async function providerErrorFromResponse(
  provider: string,
  response: Response,
): Promise<ProviderError> {
  let message = `The provider rejected the request (HTTP ${response.status}).`;
  try {
    const payload = (await response.json()) as {
      error?: { message?: string; status?: string; code?: string | number };
      message?: string;
    };
    const upstream = payload.error?.message || payload.message;
    if (upstream && upstream.length < 500) {
      message = upstream;
    }
  } catch {
    // The response was not JSON. Keep the safe status message.
  }

  if (response.status === 401 || response.status === 403) {
    message = "The provider API key was rejected. Update it in the server environment.";
  } else if (response.status === 429) {
    message = "The provider rate limit was reached. Wait a moment, then try again.";
  }

  return new ProviderError(provider, message, response.status === 429 ? 429 : 502);
}

export async function readJsonResponse<T>(
  provider: string,
  response: Response,
): Promise<T> {
  if (!response.ok) {
    throw await providerErrorFromResponse(provider, response);
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new ProviderError(provider, "The provider returned an unreadable response.");
  }
}

export function extractJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}
