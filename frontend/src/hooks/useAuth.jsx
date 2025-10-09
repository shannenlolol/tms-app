// src/hooks/useAuth.js
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { login as apiLogin, logout as apiLogout, check } from "../api/auth";
import { getAccessToken, setAccessToken } from "../api/client";

const AuthCtx = createContext(null);

// Normalize groups: accept `groups`, `usergroup`, CSV or array, labels or codes
function normaliseGroupsLoose(u) {
  const raw = u?.groups ?? u?.usergroup ?? [];
  const arr = Array.isArray(raw) ? raw : String(raw).split(",");
  return arr
    .map(String)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.toUpperCase()); // compare in upper-case
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // 1) Try to mint a fresh access token using the refresh cookie
        //    (needs SameSite=None; Secure; CORS credentials on the server)
        const { data } = await axios.get("https://localhost:3000/api/auth/refresh", {
          withCredentials: true,
        });
        if (data?.accessToken) setAccessToken(data.accessToken);
      } catch {
        // no cookie or refresh failed — fine, proceed as signed-out
      } finally {
        try {
          // 2) Ask who I am (check() should return null on 401)
          const me = await check();
          setUser(me || null);
        } finally {
          // 3) Unblock route guards only after refresh+check
          setReady(true);
        }
      }
    })();
  }, []);

  const value = useMemo(() => {
    // Derive groups/roles safely
    const groups = normaliseGroupsLoose(user);
    const isActive = user?.active !== 0 && user?.active !== false;

    // Accept either server-provided `isAdmin` or infer from groups/codes/labels
    const inferredAdmin = groups.includes("AD") || groups.includes("Admin");
    const isAdmin = Boolean(user?.isAdmin ?? inferredAdmin);

    console.log(isAdmin,"dadasdas")
    // IMPORTANT: don’t hinge routing on token presence
    const isAuthenticated = !!user && isActive;

    return {
      user,
      ready,

      // flags
      isAuthenticated,
      isAuthed: isAuthenticated, // alias for older code
      isAdmin,

      // role helpers (map your labels if you use them)
      roles: {
        isAdmin,
        isPL: groups.includes("Project Lead") || groups.includes("PL"),
        isPM: groups.includes("Project Manager") || groups.includes("PM"),
        isDEV: groups.includes("Dev Team") || groups.includes("DEV"),
        groups,
      },

      // actions
      async login(username, password) {
        const me = await apiLogin(username, password); // should also set access token
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
