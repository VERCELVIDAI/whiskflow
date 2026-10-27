"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, MailCheck, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/client-api";
import { forgotPasswordSchema } from "@/lib/validation";
import type { z } from "zod";

type ForgotValues = z.infer<typeof forgotPasswordSchema>;
type ResetDelivery = "email" | "server-log";

interface SentState {
  message: string;
  delivery: ResetDelivery;
  resetUrl?: string;
}

export function ForgotPasswordForm() {
  const [sent, setSent] = React.useState<SentState | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotValues) {
    setServerError(null);
    try {
      const result = await api<SentState>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setSent(result);
    } catch (error) {
      setServerError(errorMessage(error));
    }
  }

  if (sent) {
    const usesServerLog = sent.delivery === "server-log";
    return (
      <div className="rounded-2xl border border-border bg-card/70 p-6">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {usesServerLog ? <Terminal className="size-5" /> : <MailCheck className="size-5" />}
        </span>
        <h2 className="mt-4 text-base font-semibold">
          {usesServerLog ? "Reset link generated" : "Check your email"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{sent.message}</p>
        {usesServerLog || sent.resetUrl ? (
          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              {sent.resetUrl ? "Local development link" : "Local mode"}
            </p>
            {sent.resetUrl ? (
              <Link
                href={sent.resetUrl}
                className="mt-1 block break-all text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                {sent.resetUrl}
              </Link>
            ) : (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Open the server log where Whisk Flow is running to copy the reset link.
              </p>
            )}
          </div>
        ) : null}
        <Button asChild variant="outline" className="mt-5 w-full">
          <Link href="/login">
            <ArrowLeft /> Back to sign in
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@studio.com"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
      </div>
      {serverError ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{serverError}</p>
      ) : null}
      <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
        Send reset link
      </Button>
      <Button asChild variant="ghost" className="w-full">
        <Link href="/login">
          <ArrowLeft /> Back to sign in
        </Link>
      </Button>
    </form>
  );
}
