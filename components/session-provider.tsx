"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { api } from "@/lib/client-api";
import type { AppUser, ProviderCatalog } from "@/lib/types";

interface SessionResponse {
  user: AppUser | null;
  authMode: "local" | "supabase";
  catalog: ProviderCatalog | null;
}

interface SessionContextValue {
  user: AppUser;
  catalog: ProviderCatalog;
  refresh: () => Promise<AppUser | null>;
  updateUser: (patch: Partial<AppUser>) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  initialUser,
  initialCatalog,
  children,
}: {
  initialUser: AppUser;
  initialCatalog: ProviderCatalog;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState(initialUser);
  const [catalog, setCatalog] = useState(initialCatalog);

  const refresh = useCallback(async () => {
    try {
      const data = await api<SessionResponse>("/api/auth/session");
      if (data.user) setUser(data.user);
      if (data.catalog) setCatalog(data.catalog);
      return data.user;
    } catch {
      return null;
    }
  }, []);

  const updateUser = useCallback((patch: Partial<AppUser>) => {
    setUser((current) => ({ ...current, ...patch }));
  }, []);

  const value = useMemo(
    () => ({ user, catalog, refresh, updateUser }),
    [user, catalog, refresh, updateUser],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
