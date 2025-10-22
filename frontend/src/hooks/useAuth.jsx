// src/hooks/useAuth.js
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { login as apiLogin, logout as apiLogout, check } from "../api/auth";
import { getAccessToken, setAccessToken } from "../api/client";
import { getCurrentUser } from "../api/users";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const bootOnce = useRef(false);

  useEffect(() => {
    if (bootOnce.current) return;
    bootOnce.current = true;

    const isLoginRoute =
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/login");

    // On the login page, don’t auto-refresh — avoid the console 401 noise.
    if (isLoginRoute) {
      setReady(true);
      return;
    }

    (async () => {
      try {
        const { data, status } = await axios.get(
          "https://localhost:3000/api/auth/refresh",
          {
            withCredentials: true,
            validateStatus: (s) => (s >= 200 && s < 300) || s === 401,
          }
        );
        if (status !== 401 && data?.accessToken) {
          setAccessToken(data.accessToken);
          const me = await check();
          if (me) {
            const fullUser = await getCurrentUser();
            setUser(fullUser);
          }
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const value = useMemo(() => {
    const isActive = user?.active !== 0 && user?.active !== false;
    const isAuthenticated = !!user && isActive;

    return {
      user,
      ready,
      isAuthenticated,
      isAuthed: isAuthenticated,

      async login(username, password) {
        const res = await apiLogin(username, password);
        const token = res?.accessToken ?? res?.data?.accessToken;
        if (token) setAccessToken(token);

        setReady(false);
        try {
          // Refresh after successful login in case login didn’t return access
          const { data } = await axios.get(
            "https://localhost:3000/api/auth/refresh",
            {
              withCredentials: true,
              validateStatus: (s) => (s >= 200 && s < 300) || s === 401,
            }
          );
          if (data?.accessToken) setAccessToken(data.accessToken);

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
          if (!getAccessToken()) {
            setUser(null);
            return null;
          }
          const fullUser = await getCurrentUser();
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
