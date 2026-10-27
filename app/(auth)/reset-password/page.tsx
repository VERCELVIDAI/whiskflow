import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { authMode } from "@/lib/auth";

export const metadata: Metadata = { title: "Choose a new password" };
export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="Secure reset"
      title="Choose a new password."
      description="Use at least eight characters with a letter and a number. Choose something you have not used before."
    >
      <Suspense fallback={<div className="h-64 rounded-2xl shimmer" />}>
        <ResetPasswordForm mode={authMode()} />
      </Suspense>
    </AuthShell>
  );
}
