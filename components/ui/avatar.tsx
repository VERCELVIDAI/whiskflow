import { cn, initials } from "@/lib/utils";

interface AvatarProps {
  name: string;
  email?: string;
  src?: string | null;
  className?: string;
}

export function Avatar({ name, email, src, className }: AvatarProps) {
  return (
    <span
      className={cn(
        "relative inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary/90 to-blue-500/90 text-[11px] font-semibold tracking-wide text-white ring-1 ring-inset ring-white/20",
        className,
      )}
      aria-hidden={!name}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        initials(name, email)
      )}
    </span>
  );
}
