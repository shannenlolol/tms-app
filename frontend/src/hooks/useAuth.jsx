// src/hooks/useAuth.js
//  * React auth context/provider: refreshes access token from cookie,
//    hydrates current user, and exposes flags (isAuthenticated, isAdmin)
//    plus actions (login, logout, reloadUser).
//
//  * On mount: calls /auth/refresh, then check() and GET /users/current;
//    sets a `ready` gate so routing doesn’t hinge on token presence.
//
//  * Exports: <AuthProvider>, useAuth().

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { login as apiLogin, logout as apiLogout, check } from "../api/auth";
import { getAccessToken, setAccessToken } from "../api/client";
import { getCurrentUser } from "../api/users";

const AuthCtx = createContext(null);

// ---- helpers ----
function toArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") return v.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}
function normaliseGroupSet(user) {
  const groupsRaw = user?.groups ?? user?.usergroups ?? user?.usergroup ?? [];
  const arr = toArray(groupsRaw);
  return new Set(arr.map(g => String(g ?? "").trim().toLowerCase()).filter(Boolean));
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // Initial session hydration on mount
  useEffect(() => {
    (async () => {
      try {
        // 1) Refresh access token from HttpOnly refresh cookie (if present)
        const { data } = await axios.get("https://localhost:3000/api/auth/refresh", {
          withCredentials: true,
        });
        if (data?.accessToken) setAccessToken(data.accessToken);
      } catch {
        // ignore; not signed in or refresh failed
      }

      try {
        // 2) Check session (lightweight)
        const me = await check();

        // 3) Hydrate full profile regardless of shape of `me`
        let fullUser = null;
        if (me) {
          fullUser = await getCurrentUser(); // GET /api/users/current
        }
        setUser(fullUser);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Derived flags
  const value = useMemo(() => {
    const groupsSet = normaliseGroupSet(user);
    // Active unless explicitly 0/false
    const isActive = user?.active !== 0 && user?.active !== false;
    const isAdmin =
      user == null
        ? null // unknown until ready
        : Boolean(user?.isAdmin ?? groupsSet.has("admin"));
    const isAuthenticated = !!user && isActive;

    return {
      user,
      ready,

      // flags
      isAuthenticated,
      isAuthed: isAuthenticated, // backwards alias
      isAdmin,

      // actions
      async login(username, password) {
        // Perform login (server sets refresh cookie; may return access token)
        const res = await apiLogin(username, password);

        // If your login API returns an accessToken, store it
        const token = res?.accessToken ?? res?.data?.accessToken;
        if (token) setAccessToken(token);

        // Immediately hydrate full user (with groups) BEFORE returning
        setReady(false);
        try {
          try {
            const { data } = await axios.get("https://localhost:3000/api/auth/refresh", {
              withCredentials: true,
            });
            if (data?.accessToken) setAccessToken(data.accessToken);
          } catch { }

          const fullUser = await getCurrentUser();
          setUser(fullUser);
          return fullUser;
        } finally {
          setReady(true);
        }
      },

      async logout() {
        await apiLogout();
        setUser(null);
        setAccessToken(null);
        setReady(true);
      },

      async reloadUser({ silent = true } = {}) {
        if (!silent) setReady(false);
        try {
          const fullUser = await getCurrentUser();
          setUser(fullUser);
          return fullUser;
        } finally {
          if (!silent) setReady(true);
        }
      }

    };
  }, [user, ready]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
