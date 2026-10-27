import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getBillingSummary, reconcileCheckoutSession } from "@/lib/billing/service";
import { logWarning } from "@/lib/errors";
import { Badge } from "@/components/ui/badge";
import { PricingPlans } from "@/components/billing/pricing-plans";

export const metadata: Metadata = { title: "Plans & credits" };
export const dynamic = "force-dynamic";

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const checkout =
    params.checkout === "success"
      ? "success"
      : params.checkout === "cancelled"
        ? "cancelled"
        : null;
  const sessionId = typeof params.session_id === "string" ? params.session_id : null;

  if (checkout === "success" && sessionId?.startsWith("cs_")) {
    try {
      await reconcileCheckoutSession(user.id, sessionId);
    } catch (error) {
      logWarning("Could not reconcile the Stripe checkout on return", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const summary = await getBillingSummary(user.id);

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
      <section className="relative overflow-hidden rounded-[1.9rem] border border-border/60 bg-[#0b0b0c] px-5 py-8 text-white sm:px-9 sm:py-11 lg:px-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_340px_at_15%_0%,rgba(138,180,248,0.18),transparent_70%),radial-gradient(700px_360px_at_90%_15%,rgba(255,255,255,0.08),transparent_70%)]" />
        <div className="pointer-events-none absolute inset-0 grid-fade opacity-[0.14]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur-md">
              <Sparkles className="size-3" /> Plans & credits
            </span>
            <h2 className="mt-4 text-balance text-[36px] font-semibold leading-[1.02] tracking-[-0.055em] sm:text-[48px]">
              More room for every idea.
            </h2>
            <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-white/60 sm:text-sm">
              Credits power video, image and storyboard generation. Choose a monthly plan for a
              steady allowance, or top up once when a project needs more. Every estimate is shown
              before you generate.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className="border border-white/10 bg-white/[0.06] text-[9px] uppercase tracking-[0.16em] text-white/70"
            >
              Current · {summary.planName}
            </Badge>
            {summary.demo ? (
              <Badge
                variant="secondary"
                className="border border-amber-300/20 bg-amber-300/10 text-[9px] uppercase tracking-[0.16em] text-amber-100"
              >
                Demo billing
              </Badge>
            ) : summary.mode === "stripe" ? (
              <Badge
                variant="secondary"
                className="border border-emerald-300/20 bg-emerald-300/10 text-[9px] uppercase tracking-[0.16em] text-emerald-100"
              >
                Stripe checkout
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="border border-rose-300/20 bg-rose-300/10 text-[9px] uppercase tracking-[0.16em] text-rose-100"
              >
                Billing not configured
              </Badge>
            )}
          </div>
        </div>
      </section>

      <PricingPlans initialSummary={summary} checkout={checkout} />
    </div>
  );
}
