/**
 * Billing catalog.
 *
 * This module is shared by the server and the pricing UI. Amounts here are the
 * only source of truth for checkout: the client sends a plan or pack id, never
 * a price. Keep it free of Node-only imports.
 */

export type PlanId = "free" | "creator" | "studio" | "production";
export type PaidPlanId = Exclude<PlanId, "free">;
export type BillingInterval = "month" | "year";

export interface BillingPlan {
  id: PlanId;
  name: string;
  tagline: string;
  description: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  monthlyCredits: number;
  features: string[];
  cta: string;
  featured?: boolean;
  badge?: string;
}

export interface CreditPack {
  id: string;
  name: string;
  description: string;
  credits: number;
  priceCents: number;
  badge?: string;
}

export const PLANS: BillingPlan[] = [
  {
    id: "free",
    name: "Starter",
    tagline: "Try the studio",
    description: "A real workspace with starter credits. No card required.",
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    monthlyCredits: 1200,
    features: [
      "1,200 starter credits",
      "Video, image and storyboard projects",
      "Private media library",
      "Up to 2 concurrent generations",
      "1080p exports",
    ],
    cta: "Current plan",
  },
  {
    id: "creator",
    name: "Creator",
    tagline: "For independent filmmakers",
    description: "The everyday plan for shorts, campaigns and client work.",
    monthlyPriceCents: 1900,
    annualPriceCents: 19000,
    monthlyCredits: 4000,
    features: [
      "4,000 credits every month",
      "Up to 4 concurrent generations",
      "1080p video and high-resolution images",
      "Storyboards with scene-by-scene generation",
      "Commercial usage rights",
    ],
    cta: "Choose Creator",
    featured: true,
    badge: "Most popular",
  },
  {
    id: "studio",
    name: "Studio",
    tagline: "For small teams and studios",
    description: "More credits and faster queues for ongoing production.",
    monthlyPriceCents: 4900,
    annualPriceCents: 49000,
    monthlyCredits: 12000,
    features: [
      "12,000 credits every month",
      "Up to 8 concurrent generations",
      "Priority generation queue",
      "4K video and high-resolution images",
      "Commercial usage rights",
    ],
    cta: "Choose Studio",
  },
  {
    id: "production",
    name: "Production",
    tagline: "For high-volume work",
    description: "The largest allowance for agencies, series and campaigns.",
    monthlyPriceCents: 14900,
    annualPriceCents: 149000,
    monthlyCredits: 40000,
    features: [
      "40,000 credits every month",
      "Up to 16 concurrent generations",
      "Highest-priority queue",
      "4K video and high-resolution images",
      "Priority support",
    ],
    cta: "Choose Production",
  },
];

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "topup-1000",
    name: "Quick top-up",
    description: "A little extra room for one more idea.",
    credits: 1000,
    priceCents: 1000,
  },
  {
    id: "topup-5000",
    name: "Studio pack",
    description: "For a full day of scenes and revisions.",
    credits: 5000,
    priceCents: 4500,
    badge: "Best value",
  },
  {
    id: "topup-15000",
    name: "Production pack",
    description: "For campaigns, series and long-form projects.",
    credits: 15000,
    priceCents: 12000,
  },
];

export const PAID_PLAN_IDS = ["creator", "studio", "production"] as const;
export const CREDIT_PACK_IDS = CREDIT_PACKS.map((pack) => pack.id);

const PLAN_NAMES: Record<string, string> = {
  free: "Starter",
  spark: "Starter",
  creator: "Creator",
  studio: "Studio",
  production: "Production",
};

export function planLabel(planId: string): string {
  return PLAN_NAMES[planId] ?? planId;
}

export function planById(planId: string): BillingPlan | null {
  return PLANS.find((plan) => plan.id === planId) ?? null;
}

export function paidPlanById(planId: string): BillingPlan | null {
  const plan = planById(planId);
  return plan && plan.id !== "free" ? plan : null;
}

export function creditPackById(packId: string): CreditPack | null {
  return CREDIT_PACKS.find((pack) => pack.id === packId) ?? null;
}

export function isPaidPlanId(value: string): value is PaidPlanId {
  return (PAID_PLAN_IDS as readonly string[]).includes(value);
}

export function isBillingInterval(value: string): value is BillingInterval {
  return value === "month" || value === "year";
}

export function planPriceCents(plan: BillingPlan, interval: BillingInterval): number {
  return interval === "year" ? plan.annualPriceCents : plan.monthlyPriceCents;
}

/** The effective per-month cost of an annual plan, rounded to whole cents. */
export function monthlyEquivalentCents(plan: BillingPlan, interval: BillingInterval): number {
  if (interval === "month") return plan.monthlyPriceCents;
  return Math.round(plan.annualPriceCents / 12);
}

export function annualSavingsCents(plan: BillingPlan): number {
  return plan.monthlyPriceCents * 12 - plan.annualPriceCents;
}

export function formatUsd(cents: number): string {
  const dollars = cents / 100;
  return dollars % 1 === 0
    ? `$${dollars.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function intervalLabel(interval: BillingInterval): string {
  return interval === "year" ? "year" : "month";
}

export function checkoutLabel(plan: BillingPlan, interval: BillingInterval): string {
  if (plan.monthlyPriceCents === 0) return "Current plan";
  return `${formatUsd(planPriceCents(plan, interval))} / ${intervalLabel(interval)}`;
}
