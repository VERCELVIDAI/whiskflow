import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create an account" };
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <AuthShell
      eyebrow="Start creating"
      title="Build your studio."
      description="A workspace for cinematic images, video and storyboards — with your references in reach."
    >
      <RegisterForm />
    </AuthShell>
  );
}
