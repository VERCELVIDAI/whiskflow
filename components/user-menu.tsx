"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, Settings, Sparkles, UserRound, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, errorMessage } from "@/lib/client-api";
import { planLabel } from "@/lib/billing/plans";
import { formatCredits } from "@/lib/utils";
import { useSession } from "@/components/session-provider";

export function UserMenu({ align = "end", compact = false }: { align?: "start" | "end"; compact?: boolean }) {
  const { user, refresh } = useSession();
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      setSigningOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={
            compact
              ? "flex shrink-0 items-center rounded-full p-0.5 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              : "flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          }
          aria-label={compact ? `Account menu for ${user.fullName}` : "Account menu"}
        >
          <Avatar name={user.fullName} email={user.email} src={user.avatarUrl} className="size-8" />
          {!compact ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold">{user.fullName}</span>
              <span className="block truncate text-[10px] text-muted-foreground">{user.email}</span>
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-60">
        <DropdownMenuLabel className="normal-case tracking-normal">
          <span className="block text-xs font-semibold text-foreground">{user.fullName}</span>
          <span className="mt-0.5 block truncate text-[11px] font-normal text-muted-foreground">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/settings")}>
          <UserRound /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/settings")}>
          <Settings /> Studio settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/pricing")}>
          <Wallet /> Plans & credits
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/usage")}>
          <Wallet /> Usage ledger
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            void refresh();
            router.push("/create");
          }}
        >
          <Sparkles /> New creation
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          disabled={signingOut}
          onSelect={(event) => {
            event.preventDefault();
            void signOut();
          }}
        >
          <LogOut /> {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-2.5 py-1.5 text-[10px] text-muted-foreground">
          <span>{planLabel(user.plan)} plan</span>
          <span>{formatCredits(user.credits - user.reservedCredits)} available</span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
