import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/10 text-primary",
        secondary: "border-transparent bg-muted text-muted-foreground",
        outline: "border-border bg-card/50 text-muted-foreground",
        success: "border-emerald-500/15 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        warning: "border-amber-500/15 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        danger: "border-destructive/15 bg-destructive/10 text-destructive",
        gradient:
          "border-transparent bg-gradient-to-r from-primary/15 to-blue-500/15 text-primary dark:text-[#b7a6ff]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
