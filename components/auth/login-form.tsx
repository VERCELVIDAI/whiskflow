"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api, errorMessage } from "@/lib/client-api";
import { loginSchema } from "@/lib/validation";
import type { z } from "zod";

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm({ demoEnabled }: { demoEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = React.useMemo(() => {
    const next = searchParams.get("next");
    return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  }, [searchParams]);
  const [showPassword, setShowPassword] = React.useState(false);
  const [demoLoading, setDemoLoading] = React.useState(false);
  const authError = searchParams.get("error");
  const resetSuccess = searchParams.get("reset") === "1";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success("Welcome back to the studio.");
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function enterDemo() {
    setDemoLoading(true);
    try {
      await api("/api/auth/demo", { method: "POST" });
      toast.success("Demo studio ready. Everything is editable.");
      router.replace("/");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      setDemoLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {resetSuccess ? (
        <p
          role="status"
          className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200"
        >
          Password updated. Sign in with your new password.
        </p>
      ) : null}
      {authError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {authError}
        </p>
      ) : null}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@studio.com"
              className="pl-9"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
          </div>
          {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-[11px] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Your password"
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

        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          Sign in
        </Button>
      </form>

      {demoEnabled ? (
        <>
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              or explore
            </span>
            <Separator className="flex-1" />
          </div>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            loading={demoLoading}
            onClick={enterDemo}
          >
            <Sparkles />
            Enter the demo studio
          </Button>
          <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
            The demo uses local mode with example projects and 1,200 credits.
          </p>
        </>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        New to Whisk Flow?{" "}
        <Link href="/register" className="font-semibold text-foreground underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
