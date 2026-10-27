import Link from "next/link";
import { Compass, Home, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StudioNotFound() {
  return (
    <div className="mx-auto flex min-h-[70dvh] w-full max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Compass className="size-5" />
      </span>
      <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">404</p>
      <h1 className="mt-1 text-xl font-semibold tracking-tight">That page is off set</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        The project or page you are looking for may have been moved to trash, renamed, or never existed.
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
        <Button asChild variant="ghost">
          <Link href="/create">
            <Plus /> Start something new
          </Link>
        </Button>
      </div>
    </div>
  );
}
