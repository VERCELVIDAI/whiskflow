"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/client-api";
import { passwordSchema } from "@/lib/validation";
import type { AuthMode } from "@/lib/types";
import { z } from "zod";

const formSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type ResetValues = z.infer<typeof formSchema>;

export function ResetPasswordForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const requiresToken = mode === "local";
  const [showPassword, setShowPassword] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetValues) {
    try {
      const body = requiresToken
        ? { token, password: values.password }
        : { password: values.password };
      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setDone(true);
      toast.success("Password updated.");
      setTimeout(() => router.replace("/login?reset=1"), 2200);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-6 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
          <CheckCircle2 className="size-5" />
        </span>
        <h2 className="mt-4 text-base font-semibold">Password updated</h2>
        <p className="mt-2 text-sm text-muted-foreground">Taking you to sign in…</p>
        <Button asChild className="mt-5">
          <Link href="/login?reset=1">Sign in now</Link>
        </Button>
      </div>
    );
  }

  if (requiresToken && !token) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
          This reset link is missing its token. Request a fresh link from the sign-in page.
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {!requiresToken ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 text-xs leading-relaxed text-emerald-800 dark:text-emerald-200">
          Your email link created a secure recovery session. Set a new password below.
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="pl-9 pr-10"
            aria-invalid={Boolean(errors.password)}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((show) => !show)}
            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        </div>
        {errors.password ? (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Repeat your new password"
          aria-invalid={Boolean(errors.confirmPassword)}
          {...register("confirmPassword")}
        />
        {errors.confirmPassword ? (
          <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
        Update password
      </Button>
    </form>
  );
}
