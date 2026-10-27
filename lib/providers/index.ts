import "server-only";
import type { ProviderAdapter } from "@/lib/providers/types";
import type { ProviderName } from "@/lib/providers/models";
import { googleAdapter } from "@/lib/providers/google";
import { openaiAdapter } from "@/lib/providers/openai";
import { json2videoAdapter } from "@/lib/providers/json2video";

export function getProviderAdapter(provider: ProviderName): ProviderAdapter {
  switch (provider) {
    case "google":
      return googleAdapter;
    case "openai":
      return openaiAdapter;
    case "json2video":
      return json2videoAdapter;
  }
}
