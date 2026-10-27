import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { authMode } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Step back into the studio."
      description="Your projects, references and frames are exactly where you left them."
    >
      <Suspense fallback={<div className="h-80 rounded-2xl shimmer" />}>
        <LoginForm demoEnabled={authMode() === "local"} />
      </Suspense>
    </AuthShell>
  );
}
