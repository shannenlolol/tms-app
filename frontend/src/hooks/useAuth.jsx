// src/hooks/useAuth.js
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { login as apiLogin, logout as apiLogout, check } from "../api/auth";
import { getAccessToken, setAccessToken } from "../api/client";
import { getCurrentUser } from "../api/users";

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
      // refresh access token from cookie
      const { data } = await axios.get("https://localhost:3000/api/auth/refresh", {
        withCredentials: true,
      });
      if (data?.accessToken) setAccessToken(data.accessToken);
    } catch {}
    try {
      // minimal check (may return {id:1} or null)
      const me = await check();           // me could be null or {id:1} or full user

      let fullUser = null;
      if (me) {
        // hydrate to full profile regardless of me shape
        fullUser = await getCurrentUser();  // GET /users/current returns username, groups, active, etc.
      }
      setUser(fullUser);
    } finally {
      setReady(true);
    }
  })();
}, []);

  const value = useMemo(() => {
    // Derive groups/roles safely
    console.log("ADAD", user)
    const groups = normaliseGroupsLoose(user);
    const isActive = user?.active !== 0 && user?.active !== false;

    // Accept either server-provided `isAdmin` or infer from groups/codes/labels
    const inferredAdmin = groups.includes("AD") || groups.includes("ADMIN");

    const isAdmin = user == null ? null : Boolean(user?.isAdmin ?? inferredAdmin);


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
