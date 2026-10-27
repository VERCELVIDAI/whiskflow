import type { InternalModel } from "@/lib/providers/models";

export interface ProviderInputImage {
  data: Buffer;
  mimeType: string;
  role: "reference" | "first-frame" | "last-frame";
}

export interface ProviderGenerationRequest {
  model: InternalModel;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: string;
  resolution?: string;
  durationSeconds?: number;
  outputCount: number;
  quality?: "low" | "medium" | "high";
  seed?: number | null;
  generateAudio?: boolean;
  images: ProviderInputImage[];
}

export interface ProviderOutputAsset {
  data: Buffer;
  mimeType: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

export type ProviderCreateResult =
  | { status: "succeeded"; assets: ProviderOutputAsset[]; providerJobId?: string }
  | { status: "running"; providerJobId: string }
  | { status: "failed"; error: string };

export type ProviderPollResult =
  | { status: "running" }
  | { status: "succeeded"; assets: ProviderOutputAsset[] }
  | { status: "failed"; error: string }
  | { status: "cancelled" };

export interface ProviderAdapter {
  create(request: ProviderGenerationRequest): Promise<ProviderCreateResult>;
  poll(providerJobId: string): Promise<ProviderPollResult>;
  cancel(providerJobId: string): Promise<void>;
}
