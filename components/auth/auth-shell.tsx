import Image from "next/image";
import Link from "next/link";
import { Sparkles, Wand2 } from "lucide-react";
import { LogoMark, Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthShell({
  children,
  eyebrow,
  title,
  description,
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden lg:block">
        <Image
          src="/samples/cinematic-diner.jpg"
          alt=""
          fill
          priority
          sizes="55vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a10]/95 via-[#0a0a10]/55 to-[#0a0a10]/20" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_20%_0%,rgba(138,180,248,0.22),transparent_65%)]" />
        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <Link href="/" className="inline-flex text-white" aria-label="Whisk Flow home">
            <span className="flex items-center gap-2.5">
              <LogoMark className="size-9" />
              <span className="flex flex-col leading-none">
                <span className="text-[16px] font-semibold tracking-[-0.02em]">Whisk Flow</span>
                <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.2em] text-white/60">
                  Creative studio
                </span>
              </span>
            </span>
          </Link>

          <div className="max-w-lg">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-white/80 backdrop-blur">
              <Sparkles className="size-3 text-[#a8c7fa]" />
              AI filmmaking, directed by you
            </div>
            <h2 className="text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.035em] text-white xl:text-5xl">
              Shape the story.
              <br />
              <span className="bg-gradient-to-r from-white via-[#d7e6ff] to-[#8ab4f8] bg-clip-text text-transparent">
                Direct the frame.
              </span>
            </h2>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-white/65">
              One studio for images, cinematic video and scene-by-scene storyboards. Keep every
              reference, prompt and frame in flow.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {["Cinematic video", "Key art", "Storyboards", "Reference library"].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-[10px] font-medium text-white/70 backdrop-blur"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-white/45">
            <span className="flex items-center gap-1.5">
              <Wand2 className="size-3" />
              Built for directors, designers and storytellers
            </span>
            <span>© {new Date().getFullYear()} Whisk Flow</span>
          </div>
        </div>
      </aside>

      <main className="relative flex min-h-dvh flex-col bg-background">
        <div className="flex items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="lg:invisible" aria-label="Whisk Flow home">
            <Wordmark markClassName="size-8" />
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-16 pt-4 sm:px-8">
          <div className="w-full max-w-[420px] animate-rise-in">
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.045em] sm:text-[38px]">{title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
            <div className="mt-8">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
