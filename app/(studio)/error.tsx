"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Studio route error", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[70dvh] w-full max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" />
      </span>
      <h1 className="mt-5 text-xl font-semibold tracking-tight">This view could not be loaded</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        The studio hit an unexpected error. Your saved work is safe. Try again, or return home and reopen the
        project.
      </p>
      {error.digest ? (
        <p className="mt-3 rounded-lg bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">
          Reference {error.digest}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw /> Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">
            <Home /> Back home
          </Link>
        </Button>
      </div>
    </div>
  );
}
