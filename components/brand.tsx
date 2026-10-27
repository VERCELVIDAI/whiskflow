import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-8", className)}
      aria-hidden
    >
      <rect
        x="1.25"
        y="1.25"
        width="37.5"
        height="37.5"
        rx="12"
        stroke="currentColor"
        strokeOpacity="0.22"
      />
      <path
        d="M7.5 25.75c5.5 0 7.5-12.5 12.5-12.5s7 12.5 12.5 12.5"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
      />
      <path
        d="M7.5 16.5c5.5 0 7.5 8.5 12.5 8.5s7-8.5 12.5-8.5"
        stroke="currentColor"
        strokeOpacity="0.45"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="20" cy="20" r="1.7" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({
  className,
  markClassName,
  showTagline = false,
}: {
  className?: string;
  markClassName?: string;
  showTagline?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-[-0.03em]">Whisk Flow</span>
        {showTagline ? (
          <span className="mt-1 text-[8px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            AI film studio
          </span>
        ) : null}
      </span>
    </span>
  );
}
