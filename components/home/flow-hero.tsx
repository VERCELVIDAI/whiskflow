"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Pause, Play, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const SLIDES = [
  {
    id: "studio",
    image: "/samples/anime-neon.jpg",
    eyebrow: "The AI creative studio",
    title: "Meet the new Whisk Flow",
    description:
      "Generate cinematic video, key art and scene-by-scene storyboards in one fluid home. Your prompts, references and frames stay together.",
    href: "/create",
    cta: "Start creating",
    secondaryHref: "/pricing",
    secondary: "Explore plans",
  },
  {
    id: "story",
    image: "/samples/cinematic-diner.jpg",
    eyebrow: "From idea to final cut",
    title: "Direct every frame",
    description:
      "Move from a sentence to a shot list, build a visual language with references, then generate each scene without losing the thread.",
    href: "/create?mode=storyboard",
    cta: "Build a storyboard",
    secondaryHref: "/templates",
    secondary: "Browse templates",
  },
  {
    id: "campaign",
    image: "/samples/fashion-editorial.jpg",
    eyebrow: "Images that hold a room",
    title: "Your next campaign starts here",
    description:
      "Editorial stills, product hero frames and motion studies with model-aware controls, honest credit estimates and a private media library.",
    href: "/create?mode=image",
    cta: "Create an image",
    secondaryHref: "/projects",
    secondary: "See projects",
  },
];

export function FlowHero() {
  const [active, setActive] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [autoPlay, setAutoPlay] = React.useState(true);

  React.useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) setAutoPlay(false);
  }, []);

  React.useEffect(() => {
    if (!autoPlay || paused) return;
    const timer = window.setTimeout(() => {
      setActive((current) => (current + 1) % SLIDES.length);
    }, 9000);
    return () => window.clearTimeout(timer);
  }, [active, autoPlay, paused]);

  const slide = SLIDES[active];

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured Whisk Flow stories"
      className="relative overflow-hidden rounded-[1.8rem] bg-[#0b0b0c] text-white sm:rounded-[2.2rem]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="relative h-[540px] sm:h-[500px] lg:h-[520px]">
        {SLIDES.map((item, index) => (
          <div
            key={item.id}
            className={cn(
              "absolute inset-0 transition-opacity duration-700",
              index === active ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            aria-hidden={index !== active}
          >
            <Image
              src={item.image}
              alt=""
              fill
              priority={index === 0}
              sizes="(max-width: 1024px) 100vw, 75vw"
              className={cn(
                "object-cover transition-transform duration-[9000ms] ease-out",
                index === active ? "scale-[1.04]" : "scale-100",
              )}
            />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-[#08080a] via-[#08080a]/55 to-[#08080a]/5" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#08080a]/85 via-[#08080a]/30 to-transparent" />

        <div className="relative flex h-full flex-col justify-between p-5 sm:p-8 lg:p-11">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/75 backdrop-blur-md">
              <Sparkles className="size-3" />
              {slide.eyebrow}
            </span>
            <button
              type="button"
              onClick={() => setAutoPlay((value) => !value)}
              className="flex size-9 items-center justify-center rounded-full border border-white/15 bg-black/25 text-white/75 backdrop-blur-md transition-colors hover:bg-white/15 hover:text-white"
              aria-label={autoPlay ? "Pause slideshow" : "Play slideshow"}
            >
              {autoPlay ? <Pause className="size-3.5" /> : <Play className="ml-0.5 size-3.5" />}
            </button>
          </div>

          <div className="max-w-[660px]">
            <h2 className="text-balance text-[36px] font-semibold leading-[0.98] tracking-[-0.055em] sm:text-[52px] lg:text-[60px]">
              {slide.title}
            </h2>
            <p className="mt-4 max-w-[520px] text-[13px] leading-relaxed text-white/65 sm:text-sm">
              {slide.description}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Link
                href={slide.href}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[13px] font-semibold text-[#0a0a0b] transition-transform hover:scale-[1.02]"
              >
                {slide.cta} <ArrowRight className="size-4" />
              </Link>
              <Link
                href={slide.secondaryHref}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-5 text-[13px] font-medium text-white/85 backdrop-blur-md transition-colors hover:bg-white/15 hover:text-white"
              >
                {slide.secondary}
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5" role="tablist" aria-label="Choose a featured story">
              {SLIDES.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={index === active}
                  aria-label={`Show ${item.title}`}
                  onClick={() => setActive(index)}
                  className={cn(
                    "h-1 rounded-full transition-all duration-500",
                    index === active ? "w-9 bg-white" : "w-5 bg-white/30 hover:bg-white/55",
                  )}
                />
              ))}
            </div>
            <span className="hidden text-[9px] font-medium uppercase tracking-[0.18em] text-white/35 sm:block">
              {String(active + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
