import Link from "next/link";
import { Compass, Home } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";

export default function RootNotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <Wordmark />
      <p className="mt-8 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">404</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">This frame does not exist</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        The page may have moved or the link may be incomplete. Head back to the studio to keep working.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/">
            <Home /> Back home
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/projects">
            <Compass /> Browse projects
          </Link>
        </Button>
      </div>
    </div>
  );
}
