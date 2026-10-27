"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  CreditCard,
  ExternalLink,
  Info,
  Loader2,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { api, errorMessage } from "@/lib/client-api";
import { cn, formatCredits, formatDate, newIdempotencyKey } from "@/lib/utils";
import {
  CREDIT_PACKS,
  PLANS,
  annualSavingsCents,
  formatUsd,
  intervalLabel,
  monthlyEquivalentCents,
  planLabel,
  planPriceCents,
  type BillingInterval,
  type PaidPlanId,
} from "@/lib/billing/plans";
import type {
  BillingCheckoutResult,
  BillingSummary,
} from "@/lib/types";

const FAQS = [
  {
    question: "What is a credit?",
    answer:
      "Credits are the unit used to run generations. Image and video models have different costs, and the studio always shows an estimate before you confirm. Storyboards reserve credits scene by scene.",
  },
  {
    question: "Do unused credits expire?",
    answer:
      "Plan credits stay in your balance while your account is active. Credit-pack purchases never expire. Cancelling a plan does not remove credits you have already received.",
  },
  {
    question: "Can I change plans?",
    answer:
      "Yes. On a live Stripe deployment, open Manage billing to change or cancel your subscription. In the local demo, switching plans takes effect immediately and grants only the difference in monthly credits.",
  },
  {
    question: "How does billing work in this workspace?",
    answer:
      "If Stripe keys are configured, checkout opens a secure Stripe Checkout session and a verified webhook fulfils the order. Without Stripe on a local workspace, checkout is simulated and clearly labelled — no card is charged.",
  },
];

function activeSubscription(summary: BillingSummary) {
  return Boolean(
    summary.subscription &&
      (summary.subscription.status === "active" || summary.subscription.status === "past_due"),
  );
}

export function PricingPlans({
  initialSummary,
  checkout,
}: {
  initialSummary: BillingSummary;
  checkout: "success" | "cancelled" | null;
}) {
  const router = useRouter();
  const { user, refresh } = useSession();
  const [interval, setInterval] = React.useState<BillingInterval>("month");
  const [summary, setSummary] = React.useState(initialSummary);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSummary(initialSummary);
  }, [initialSummary]);

  const available = Math.max(0, user.credits - user.reservedCredits);
  const hasActive = activeSubscription(summary);
  const subscription = summary.subscription;

  async function checkoutPlan(planId: PaidPlanId) {
    setBusy(`plan:${planId}`);
    try {
      const result = await api<BillingCheckoutResult>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({
          kind: "subscription",
          planId,
          interval,
          idempotencyKey: newIdempotencyKey(),
        }),
      });
      if (result.demo) {
        toast.success("Demo checkout complete. No card was charged.");
        await refresh();
        router.push(result.url);
        router.refresh();
        setBusy(null);
        return;
      }
      window.location.assign(result.url);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(null);
    }
  }

  async function checkoutPack(packId: string) {
    setBusy(`pack:${packId}`);
    try {
      const result = await api<BillingCheckoutResult>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({
          kind: "credits",
          packId,
          idempotencyKey: newIdempotencyKey(),
        }),
      });
      if (result.demo) {
        toast.success("Demo checkout complete. No card was charged.");
        await refresh();
        router.push(result.url);
        router.refresh();
        setBusy(null);
        return;
      }
      window.location.assign(result.url);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy("portal");
    try {
      const result = await api<{ url: string }>("/api/billing/portal", { method: "POST" });
      window.location.assign(result.url);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(null);
    }
  }

  async function updateSubscription(action: "cancel" | "resume") {
    setBusy(action);
    try {
      const result = await api<{ summary: BillingSummary }>("/api/billing/cancel", {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      setSummary(result.summary);
      await refresh();
      toast.success(
        action === "cancel"
          ? summary.demo
            ? "Demo plan cancelled. Your credits remain available."
            : "Your plan will end at the close of the billing period."
          : "Your plan will continue.",
      );
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  function planAction(planId: string) {
    const plan = PLANS.find((item) => item.id === planId);
    if (!plan || plan.id === "free") return null;
    const isCurrent = summary.planId === plan.id;
    if (isCurrent && hasActive) {
      return (
        <Button disabled className="w-full">
          Current plan
        </Button>
      );
    }
    if (!summary.configured) {
      return (
        <Button disabled className="w-full" variant="outline">
          Billing unavailable
        </Button>
      );
    }
    if (hasActive && summary.mode === "stripe") {
      return (
        <Button variant="outline" className="w-full" onClick={openPortal} disabled={busy !== null}>
          {busy === "portal" ? <Loader2 className="animate-spin" /> : <ExternalLink />}
          Manage plan
        </Button>
      );
    }
    const loading = busy === `plan:${plan.id}`;
    return (
      <Button
        className={cn("w-full", plan.featured && "bg-background text-foreground hover:bg-background/90")}
        onClick={() => void checkoutPlan(plan.id as PaidPlanId)}
        disabled={busy !== null}
      >
        {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
        {hasActive ? `Switch to ${plan.name}` : plan.cta}
      </Button>
    );
  }

  return (
    <div className="mt-5 space-y-9">
      {checkout === "success" ? (
        <div
          role="status"
          className="flex flex-col gap-1.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <BadgeCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
            <div>
              <p className="text-sm font-semibold">
                {summary.demo ? "Demo checkout complete" : "Payment received"}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                {summary.demo
                  ? "Your plan and credits were updated locally. No card was charged."
                  : "Stripe confirmed the payment. Your plan and credits update as the webhook is processed — refresh if they have not appeared yet."}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <a href="/usage">
              View ledger <ArrowRight />
            </a>
          </Button>
        </div>
      ) : null}

      {checkout === "cancelled" ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3.5"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" />
          <div>
            <p className="text-sm font-semibold">Checkout cancelled</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Nothing was charged. Your current plan and credits are unchanged.
            </p>
          </div>
        </div>
      ) : null}

      {summary.mode === "unconfigured" ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-amber-600 dark:text-amber-300" />
            <p className="text-sm font-semibold">Checkout is not configured</p>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            Add <code className="rounded bg-muted px-1 py-0.5">STRIPE_SECRET_KEY</code> and{" "}
            <code className="rounded bg-muted px-1 py-0.5">STRIPE_WEBHOOK_SECRET</code> to the
            server environment to take payments. On a local workspace with no remote database,
            billing automatically runs in demo mode instead.
          </p>
        </div>
      ) : summary.demo ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-border/70 bg-card/50 px-4 py-3.5">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">Demo billing is active</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              This is a local workspace without Stripe or a remote database. Checkout is
              simulated, credits update instantly, and no card is charged. Recurring renewal is
              not scheduled.
            </p>
          </div>
        </div>
      ) : null}

      <section aria-labelledby="plans-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="plans-heading" className="text-[22px] font-semibold tracking-[-0.04em]">
              Choose your plan
            </h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              A monthly credit allowance, plus a workspace built for film.
            </p>
          </div>
          <div
            role="group"
            aria-label="Billing interval"
            className="inline-flex w-fit items-center rounded-full border border-border/70 bg-card/60 p-1"
          >
            {(["month", "year"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={interval === option}
                onClick={() => setInterval(option)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[11px] font-medium transition-colors",
                  interval === option
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option === "month" ? "Monthly" : "Annual"}
                {option === "year" ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider",
                      interval === "year"
                        ? "bg-background/15 text-background"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
                    )}
                  >
                    2 months free
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => {
            const featured = Boolean(plan.featured);
            const current = summary.planId === plan.id || (plan.id === "free" && summary.planId === "spark");
            const price = monthlyEquivalentCents(plan, interval);
            const billed = planPriceCents(plan, interval);
            const savings = annualSavingsCents(plan);

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col overflow-hidden rounded-[1.8rem] border p-5 sm:p-6",
                  featured
                    ? "border-transparent bg-foreground text-background shadow-[0_24px_70px_-40px_rgba(0,0,0,0.8)]"
                    : "border-border/60 bg-card/50",
                )}
              >
                {featured ? (
                  <div className="pointer-events-none absolute -right-14 -top-16 size-44 rounded-full bg-[radial-gradient(circle,rgba(138,180,248,0.28),transparent_65%)]" />
                ) : null}
                <div className="relative flex items-start justify-between gap-2">
                  <div>
                    <p
                      className={cn(
                        "text-[9px] font-semibold uppercase tracking-[0.2em]",
                        featured ? "text-background/55" : "text-muted-foreground",
                      )}
                    >
                      {plan.tagline}
                    </p>
                    <h3 className="mt-1.5 text-[22px] font-semibold tracking-[-0.04em]">
                      {plan.name}
                    </h3>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {featured && plan.badge ? (
                      <span className="rounded-full bg-background px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-foreground">
                        {plan.badge}
                      </span>
                    ) : null}
                    {current ? (
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider",
                          featured
                            ? "border-background/25 text-background/80"
                            : "border-border text-muted-foreground",
                        )}
                      >
                        Current
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="relative mt-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-[38px] font-semibold leading-none tracking-[-0.06em]">
                      {plan.monthlyPriceCents === 0 ? "$0" : formatUsd(price)}
                    </span>
                    <span
                      className={cn(
                        "text-[11px]",
                        featured ? "text-background/55" : "text-muted-foreground",
                      )}
                    >
                      /mo
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mt-1.5 min-h-4 text-[10px]",
                      featured ? "text-background/55" : "text-muted-foreground",
                    )}
                  >
                    {plan.monthlyPriceCents === 0
                      ? "Free forever"
                      : interval === "year"
                        ? `${formatUsd(billed)} billed yearly${savings > 0 ? ` · save ${formatUsd(savings)}` : ""}`
                        : "Billed monthly. Cancel anytime."}
                  </p>
                </div>

                <p
                  className={cn(
                    "relative mt-4 text-[11px] leading-relaxed",
                    featured ? "text-background/65" : "text-muted-foreground",
                  )}
                >
                  {plan.description}
                </p>

                <div className="relative mt-4 flex-1">
                  <ul className="space-y-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-[11px]">
                        <span
                          className={cn(
                            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full",
                            featured ? "bg-background/10" : "bg-muted",
                          )}
                        >
                          <Check
                            className={cn(
                              "size-2.5",
                              featured ? "text-background" : "text-muted-foreground",
                            )}
                          />
                        </span>
                        <span className={featured ? "text-background/85" : "text-foreground/85"}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="relative mt-5">
                  {plan.id === "free" ? (
                    <Button
                      disabled
                      variant="outline"
                      className={cn(
                        "w-full",
                        featured && "border-background/20 text-background",
                      )}
                    >
                      {current ? "Current plan" : "Included"}
                    </Button>
                  ) : (
                    planAction(plan.id)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Your workspace
              </p>
              <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.04em]">
                {summary.planName} plan
              </h2>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {hasActive && subscription
                  ? subscription.cancelAtPeriodEnd
                    ? "Cancels at the end of the current period."
                    : subscription.provider === "demo"
                      ? "Demo plan · no recurring charge"
                      : `Renews ${intervalLabel(subscription.interval)}ly.`
                  : "No active subscription. Choose a plan when you are ready."}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-right">
              <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                Available credits
              </p>
              <p className="mt-0.5 text-2xl font-semibold tracking-[-0.04em]">
                {formatCredits(available)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            <div className="flex items-center gap-2.5 rounded-2xl border border-border/60 bg-card/40 px-3.5 py-3">
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  {hasActive
                    ? subscription?.cancelAtPeriodEnd
                      ? "Access until"
                      : "Current period"
                    : "Renewal"}
                </p>
                <p className="mt-0.5 truncate text-[11px] font-medium" suppressHydrationWarning>
                  {hasActive && subscription?.currentPeriodEnd
                    ? formatDate(subscription.currentPeriodEnd)
                    : "No renewal date"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl border border-border/60 bg-card/40 px-3.5 py-3">
              <Wallet className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  Billing
                </p>
                <p className="mt-0.5 truncate text-[11px] font-medium">
                  {summary.demo
                    ? "Demo · simulated"
                    : summary.mode === "stripe"
                      ? "Stripe · secure"
                      : "Not configured"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {summary.portalAvailable ? (
              <Button variant="outline" size="sm" onClick={openPortal} disabled={busy !== null}>
                {busy === "portal" ? <Loader2 className="animate-spin" /> : <CreditCard />}
                Manage billing
              </Button>
            ) : null}
            {hasActive && subscription ? (
              subscription.cancelAtPeriodEnd ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void updateSubscription("resume")}
                  disabled={busy !== null}
                >
                  {busy === "resume" ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  Resume plan
                </Button>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" disabled={busy !== null}>
                      Cancel plan
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel your plan?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {summary.demo
                          ? "Demo cancellation takes effect immediately and returns this workspace to Starter. Credits already granted stay in your balance."
                          : "Your plan stays active until the end of the current billing period. You keep the credits already granted, and the plan returns to Starter afterwards."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep plan</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void updateSubscription("cancel")}>
                        Cancel plan
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )
            ) : null}
            <Button asChild variant="ghost" size="sm">
              <a href="/usage">
                Usage ledger <ArrowRight />
              </a>
            </Button>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Recent purchases
              </p>
              <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.04em]">Payment history</h2>
            </div>
            <ReceiptText className="size-4 text-muted-foreground" />
          </div>
          {summary.orders.length > 0 ? (
            <ul className="mt-4 divide-y divide-border/60">
              {summary.orders.slice(0, 4).map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium">
                      {order.kind === "credits"
                        ? `${formatCredits(order.credits)} credit pack`
                        : `${planLabel(order.planId)} plan`}
                    </p>
                    <p className="mt-0.5 text-[9px] text-muted-foreground" suppressHydrationWarning>
                      {formatDate(order.createdAt)} · {order.provider === "demo" ? "Demo" : "Stripe"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[11px] font-medium">{formatUsd(order.amountCents)}</span>
                    <Badge
                      variant={order.status === "paid" ? "success" : "outline"}
                      className="text-[8px] capitalize"
                    >
                      {order.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-border p-5 text-center">
              <ReceiptText className="mx-auto size-4 text-muted-foreground" />
              <p className="mt-2 text-[11px] font-medium">No purchases yet</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Your plan and credit-pack purchases appear here.
              </p>
            </div>
          )}
          <div className="mt-3 flex items-center gap-1.5 text-[9px] text-muted-foreground">
            <ShieldCheck className="size-3" />
            {summary.mode === "stripe"
              ? "Payments are processed by Stripe. Card details never touch this app."
              : summary.demo
                ? "Demo mode records simulated orders only."
                : "Configure Stripe to enable checkout."}
          </div>
        </Card>
      </section>

      <section aria-labelledby="packs-heading">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="packs-heading" className="text-[22px] font-semibold tracking-[-0.04em]">
              Need a one-time top-up?
            </h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Credit packs are added to your balance immediately and never expire.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {CREDIT_PACKS.map((pack) => {
            const loading = busy === `pack:${pack.id}`;
            return (
              <Card key={pack.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {pack.name}
                    </p>
                    <p className="mt-1.5 text-[26px] font-semibold tracking-[-0.05em]">
                      {formatCredits(pack.credits)}
                      <span className="ml-1 text-[11px] font-normal tracking-normal text-muted-foreground">
                        credits
                      </span>
                    </p>
                  </div>
                  {pack.badge ? (
                    <Badge variant="outline" className="text-[8px] uppercase tracking-wider">
                      {pack.badge}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1.5 flex-1 text-[11px] leading-relaxed text-muted-foreground">
                  {pack.description}
                </p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-[15px] font-semibold">{formatUsd(pack.priceCents)}</span>
                  <Button
                    size="sm"
                    variant={pack.badge ? "default" : "outline"}
                    onClick={() => void checkoutPack(pack.id)}
                    disabled={busy !== null || !summary.configured}
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <CreditCard />}
                    {summary.demo ? "Try demo purchase" : "Buy credits"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="faq-heading" className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div>
          <h2 id="faq-heading" className="text-[22px] font-semibold tracking-[-0.04em]">
            Billing questions
          </h2>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            Clear answers about credits, plans and the checkout boundary in this workspace.
          </p>
        </div>
        <div className="divide-y divide-border/60 overflow-hidden rounded-[1.6rem] border border-border/60 bg-card/40">
          {FAQS.map((faq) => (
            <details key={faq.question} className="group px-4 py-3.5 sm:px-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[12px] font-medium">
                {faq.question}
                <span className="text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
