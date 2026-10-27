export type AuthMode = "local" | "supabase";

export type ProjectMode = "video" | "image" | "storyboard";

export type ProjectStatus = "draft" | "in_progress" | "complete";

export type SceneStatus = "draft" | "queued" | "generating" | "ready" | "failed";

export type AssetKind = "image" | "video" | "audio";

export type GenerationStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface AppUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  plan: string;
  credits: number;
  reservedCredits: number;
  createdAt: string;
  authMode: AuthMode;
}

export interface ProjectSettings {
  model?: string;
  provider?: string;
  resolution?: string;
  generateAudio?: boolean;
  negativePrompt?: string;
  seed?: number | null;
  stylePreset?: string;
  [key: string]: unknown;
}

export interface Project {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  mode: ProjectMode;
  status: ProjectStatus;
  aspectRatio: string;
  provider: string | null;
  model: string | null;
  settings: ProjectSettings;
  promptHistory: string[];
  exportHistory: ExportRecord[];
  coverAssetId: string | null;
  templateSlug: string | null;
  isExample: boolean;
  favorite: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Scene {
  id: string;
  projectId: string;
  ownerId: string;
  title: string;
  prompt: string;
  negativePrompt: string;
  durationSeconds: number;
  orderIndex: number;
  status: SceneStatus;
  referenceAssetIds: string[];
  firstFrameAssetId: string | null;
  lastFrameAssetId: string | null;
  transition: "cut" | "fade" | "dissolve";
  thumbnailUrl: string | null;
  videoAssetId: string | null;
  generationJobId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  ownerId: string;
  projectId: string | null;
  sceneId: string | null;
  kind: AssetKind;
  title: string;
  url: string | null;
  thumbnailUrl: string | null;
  storageProvider: "local" | "supabase";
  storagePath: string | null;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  prompt: string | null;
  negativePrompt: string | null;
  provider: string | null;
  model: string | null;
  aspectRatio: string | null;
  source: "upload" | "generation" | "example";
  folder: string;
  tags: string[];
  favorite: boolean;
  metadata: Record<string, unknown>;
  isExample: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationSettings {
  aspectRatio: string;
  resolution?: string;
  durationSeconds?: number;
  generateAudio?: boolean;
  seed?: number | null;
  quality?: "low" | "medium" | "high";
  stylePreset?: string;
  negativePrompt?: string;
  referenceAssetIds?: string[];
  firstFrameAssetId?: string | null;
  lastFrameAssetId?: string | null;
  [key: string]: unknown;
}

export interface GenerationJob {
  id: string;
  ownerId: string;
  projectId: string | null;
  sceneId: string | null;
  kind: "image" | "video";
  provider: string;
  model: string;
  status: GenerationStatus;
  prompt: string;
  negativePrompt: string;
  settings: GenerationSettings;
  outputCount: number;
  creditsReserved: number;
  providerJobId: string | null;
  resultAssetId: string | null;
  assetIds: string[];
  assets?: Asset[];
  error: string | null;
  attempts: number;
  idempotencyKey: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreditTransaction {
  id: string;
  ownerId: string;
  generationId: string | null;
  type: "grant" | "reservation" | "charge" | "release" | "adjustment";
  amount: number;
  reservedDelta: number;
  balanceAfter: number;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ExportRecord {
  id: string;
  format: string;
  createdAt: string;
  assetCount?: number;
}

export interface ProjectSummary extends Project {
  sceneCount: number;
  coverUrl: string | null;
}

export interface ProjectDetail extends Project {
  scenes: Scene[];
  assets: Asset[];
}

export interface UsageSummary {
  balance: number;
  reserved: number;
  spentThisMonth: number;
  grantedThisMonth: number;
  generationsThisMonth: number;
  byKind: Array<{ kind: string; count: number; credits: number }>;
  transactions: CreditTransaction[];
  jobs: GenerationJob[];
}

export interface ProviderSetup {
  provider: "google" | "openai" | "json2video";
  label: string;
  configured: boolean;
  envVariables: string[];
  note: string;
}

export interface PublicModel {
  id: string;
  label: string;
  provider: "google" | "openai" | "json2video";
  providerLabel: string;
  kind: "image" | "video";
  available: boolean;
  description: string;
  aspectRatios: string[];
  resolutions: string[];
  durations: number[];
  supportsNegativePrompt: boolean;
  supportsReferences: boolean;
  supportsFirstFrame: boolean;
  supportsLastFrame: boolean;
  supportsAudio: boolean;
  maxOutputs: number;
  creditCost: number;
  creditUnit: "image" | "second";
  badge?: string;
}

export interface ProviderCatalog {
  models: PublicModel[];
  setups: ProviderSetup[];
  textAvailable: boolean;
  textProvider: "google" | "openai" | null;
  authMode: AuthMode;
  storageMode: "local" | "supabase";
}

export interface TemplateScene {
  title: string;
  prompt: string;
  durationSeconds: number;
}

export interface Template {
  slug: string;
  title: string;
  description: string;
  category: string;
  mode: ProjectMode;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: string;
  durationSeconds?: number;
  stylePreset?: string;
  poster: string;
  video?: string;
  featured?: boolean;
  tags: string[];
  scenes?: TemplateScene[];
}

export type BillingMode = "stripe" | "demo" | "unconfigured";

export type BillingOrderKind = "subscription" | "credits";

export type BillingOrderStatus = "pending" | "paid" | "failed" | "cancelled";

export type BillingSubscriptionStatus = "active" | "past_due" | "cancelled" | "incomplete";

export interface BillingOrder {
  id: string;
  kind: BillingOrderKind;
  planId: string;
  credits: number;
  amountCents: number;
  currency: string;
  interval: "month" | "year" | null;
  status: BillingOrderStatus;
  provider: "stripe" | "demo";
  createdAt: string;
  completedAt: string | null;
}

export interface BillingSubscription {
  id: string;
  planId: string;
  interval: "month" | "year";
  status: BillingSubscriptionStatus;
  provider: "stripe" | "demo";
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BillingSummary {
  mode: BillingMode;
  planId: string;
  planName: string;
  subscription: BillingSubscription | null;
  orders: BillingOrder[];
  hasBillingCustomer: boolean;
  portalAvailable: boolean;
  demo: boolean;
  configured: boolean;
}

export interface BillingCheckoutResult {
  mode: BillingMode;
  url: string;
  orderId: string;
  demo: boolean;
}
