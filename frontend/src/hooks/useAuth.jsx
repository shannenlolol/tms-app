// src/hooks/useAuth.js
/**
 * Auth context/provider.
 * Keeps session state (`user`, `ready`) and flags (`isAuthenticated`/`isAuthed`).
 * Boot: skip on /login; otherwise call /auth/refresh (withCredentials), store access token,
 * then fetch full user; always set `ready=true` at the end.
 * Tokens: access token kept in memory via setAccessToken; refresh token is HttpOnly cookie.
 * Actions: login (refresh + load user), logout (clear token/user), reloadUser (re-fetch or clear).
 * `bootOnce` prevents double boot in Strict Mode/HMR; inactive users (active=0/false) aren’t authed.
 *
 * Fixes added:
 *  - Handle 403 { code: "ACCOUNT_DISABLED" } on refresh / current / any API via interceptor.
 *  - Clear token + user immediately on disabled so ProtectedRoutes sends to /login.
 */

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { login as apiLogin, logout as apiLogout, check } from "../api/auth";
import { getAccessToken, setAccessToken } from "../api/client";
import { getCurrentUser } from "../api/users";

const AuthCtx = createContext(null);

function isDisabledError(err) {
  const status = err?.response?.status;
  const code = err?.response?.data?.code;
  return status === 403 && code === "ACCOUNT_DISABLED";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const bootOnce = useRef(false);
  const interceptorIdRef = useRef(null);
  const tearingDownRef = useRef(false);

  async function forceLogout() {
    try {
      await apiLogout().catch(() => {});
    } finally {
      setAccessToken(null);
      setUser(null);
      // Do not navigate here; your route guards will redirect to /login when they see !isAuthenticated
    }
  }

  // Global interceptor to catch disabled accounts on ANY request after hydration
  useEffect(() => {
    if (interceptorIdRef.current != null) return;
    const id = axios.interceptors.response.use(
      (res) => res,
      async (error) => {
        if (isDisabledError(error) && !tearingDownRef.current) {
          try {
            tearingDownRef.current = true;
            await forceLogout();
          } finally {
            tearingDownRef.current = false;
          }
        }
        return Promise.reject(error);
      }
    );
    interceptorIdRef.current = id;
    return () => {
      if (interceptorIdRef.current != null) {
        axios.interceptors.response.eject(interceptorIdRef.current);
        interceptorIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (bootOnce.current) return;
    bootOnce.current = true;

    const isLoginRoute =
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/login");

    if (isLoginRoute) {
      setReady(true);
      return;
    }

    (async () => {
      try {
        // Try to refresh; allow non-2xx so we can inspect error body
        let token = null;
        try {
          const { data } = await axios.get(
            "https://localhost:3000/api/auth/refresh",
            {
              withCredentials: true,
              validateStatus: () => true, // we'll handle statuses ourselves
            }
          );
          if (data?.accessToken) {
            token = data.accessToken;
            setAccessToken(token);
          } else if (data?.code === "ACCOUNT_DISABLED") {
            await forceLogout();
            return;
          }
        } catch (e) {
          if (isDisabledError(e)) {
            await forceLogout();
            return;
          }
          // No refresh available -> anonymous
          setAccessToken(null);
          setUser(null);
          return;
        }

        // If no token, stay anonymous
        if (!token) {
          setAccessToken(null);
          setUser(null);
          return;
        }

        // Validate token & load full user
        try {
          await check();
          const fullUser = await getCurrentUser();
          // If backend ever returns an "active" flag and it's false, also logout:
          if (fullUser && fullUser.active === 0) {
            await forceLogout();
            return;
          }
          setUser(fullUser);
        } catch (e) {
          if (isDisabledError(e)) {
            await forceLogout();
            return;
          }
          // Any other failure -> treat as anonymous
          setAccessToken(null);
          setUser(null);
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const value = useMemo(() => {
    const isActive = user?.active !== 0; // treat 0 as disabled
    const isAuthenticated = !!user && isActive;

    return {
      user,
      ready,
      isAuthenticated,
      isAuthed: isAuthenticated,

      async login(username, password) {
        // 1) Login
        const res = await apiLogin(username, password).catch(async (e) => {
          if (isDisabledError(e)) {
            await forceLogout();
            throw new Error("Your account is disabled. Please contact an administrator.");
          }
          throw e;
        });
        const token = res?.accessToken ?? res?.data?.accessToken;
        if (token) setAccessToken(token);

        // 2) Refresh (optional harden)
        setReady(false);
        try {
          const r = await axios.get("https://localhost:3000/api/auth/refresh", {
            withCredentials: true,
            validateStatus: () => true,
          });
          if (r?.data?.code === "ACCOUNT_DISABLED") {
            await forceLogout();
            throw new Error("Your account is disabled. Please contact an administrator.");
          }
          if (r?.data?.accessToken) setAccessToken(r.data.accessToken);

          // 3) Load user
          const fullUser = await getCurrentUser().catch(async (e) => {
            if (isDisabledError(e)) {
              await forceLogout();
              throw new Error("Your account is disabled. Please contact an administrator.");
            }
            throw e;
          });

          if (fullUser && fullUser.active === 0) {
            await forceLogout();
            throw new Error("Your account is disabled. Please contact an administrator.");
          }

          setUser(fullUser);
          return fullUser;
        } finally {
          setReady(true);
        }
      },

      async logout() {
        await forceLogout();
        setReady(true);
      },

      async reloadUser({ silent = true } = {}) {
        if (!silent) setReady(false);
        try {
          if (!getAccessToken()) {
            setUser(null);
            return null;
          }
          const fullUser = await getCurrentUser().catch(async (e) => {
            if (isDisabledError(e)) {
              await forceLogout();
              return null;
            }
            throw e;
          });
          if (fullUser && fullUser.active === 0) {
            await forceLogout();
            return null;
          }
          setUser(fullUser);
          return fullUser;
        } finally {
          if (!silent) setReady(true);
        }
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
