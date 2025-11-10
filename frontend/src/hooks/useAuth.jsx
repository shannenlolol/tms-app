// src/hooks/useAuth.js
/**
 * Auth context/provider (cookie-based).
 * - No bearer tokens are stored client-side; browser sends HttpOnly cookies.
 * - Boot: on non-/login routes, call /auth/refresh (to mint access cookie), then load user.
 * - ready gate: only redirect when ready === true and !isAuthenticated.
 * - Global interceptor: if backend returns { code: "ACCOUNT_DISABLED" } with 403, force logout.
 */

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import http from "../api/client";                  // axios instance with baseURL + withCredentials
import { login as apiLogin, logout as apiLogout } from "../api/auth";
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
      setUser(null);
      // Route guards should handle redirect when they see !isAuthenticated
    }
  }

  // Intercept responses on the API client (not the global axios) to catch disabled accounts
  useEffect(() => {
    if (interceptorIdRef.current != null) return;
    const id = http.interceptors.response.use(
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
        http.interceptors.response.eject(interceptorIdRef.current);
        interceptorIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (bootOnce.current) return;
    bootOnce.current = true;

    const isLoginRoute =
      typeof window !== "undefined" && window.location.pathname.startsWith("/login");

    if (isLoginRoute) {
      setReady(true);
      return;
    }

    (async () => {
      try {
        // 1) Try to mint/refresh access cookie from refresh cookie.
        const refreshRes = await http.get("/auth/refresh", {
          // allow 401 without throwing; we'll treat it as anonymous
          validateStatus: (s) => (s >= 200 && s < 300) || s === 401 || s === 403,
        });

        if (refreshRes.status === 403 && refreshRes.data?.code === "ACCOUNT_DISABLED") {
          await forceLogout();
          return;
        }
        if (refreshRes.status === 401) {
          // no refresh available -> anonymous session
          setUser(null);
          return;
        }

        // 2) Load the current user (protected; will include access cookie automatically)
        try {
          const fullUser = await getCurrentUser();
          // If your /users/current returns an 'active' flag and it's 0, treat as disabled
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
          // Any other failure -> anonymous
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
        // 1) Perform login — server sets rt + at cookies
        await apiLogin(username, password).catch(async (e) => {
          if (isDisabledError(e)) {
            await forceLogout();
            throw new Error("Your account is disabled. Please contact an administrator.");
          }
          throw e;
        });

        // 2) Optionally renew access cookie (defensive; usually already set by login)
        setReady(false);
        try {
          const r = await http.get("/auth/refresh", {
            validateStatus: (s) => (s >= 200 && s < 300) || s === 401 || s === 403,
          });
          if (r.status === 403 && r.data?.code === "ACCOUNT_DISABLED") {
            await forceLogout();
            throw new Error("Your account is disabled. Please contact an administrator.");
          }

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
        } catch {
          setUser(null);
          return null;
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
