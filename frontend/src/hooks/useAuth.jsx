// src/hooks/useAuth.js
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { login as apiLogin, logout as apiLogout, check } from "../api/auth";
import { getAccessToken, setAccessToken } from "../api/client";

const AuthCtx = createContext(null);

// CSV/array -> array of group codes
function normaliseGroups(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map(s => s.trim()).filter(Boolean);
  return String(v)
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // On first load: try /check (your interceptor may auto-refresh on 401)
  useEffect(() => {
    (async () => {
      try {
        const me = await check(); // should resolve to null if unauthorised
        setUser(me || null);
      } catch {
        setUser(null);
        setAccessToken(null);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const value = useMemo(() => {
    const token = getAccessToken();
    const groups = normaliseGroups(user?.usergroup);
    // Adjust "AD" if your admin code differs
    const isAdmin = groups.includes("AD");
    const isActive = user?.active !== 0 && user?.active !== false;
    const isAuthenticated = !!user && !!token && isActive;

    return {
      user,
      ready,

      // booleans
      isAuthenticated,
      isAuthed: isAuthenticated, // alias for older code
      isAdmin,

      // optional roles helper
      roles: {
        isAdmin,
        isPL: groups.includes("PL"),
        isPM: groups.includes("PM"),
        isDEV: groups.includes("DEV"),
        groups,
      },

      // actions
      async login(username, password) {
        const me = await apiLogin(username, password);
        setUser(me);
        return me;
      },
      async logout() {
        await apiLogout();
        setUser(null);
        setAccessToken(null);
      },
    };
  }, [user, ready]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
