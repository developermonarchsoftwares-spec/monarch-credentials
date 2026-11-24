import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SessionUser } from "@shared/types";
import { api, setCsrf } from "./api";

type AuthState = { user: SessionUser | null; loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void> };
const Ctx = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ user: SessionUser; csrfToken: string }>("/api/auth/me");
      setCsrf(r.csrfToken);
      setUser(r.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // Public pages never need a session; only probe on admin routes (avoids noisy 401s).
    if (location.pathname.startsWith("/admin")) void refresh();
    else setLoading(false);
  }, [refresh]);

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setCsrf("");
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, refresh, logout }), [user, loading, refresh, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
};
