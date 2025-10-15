// src/hooks/useAuth.js
//  * React auth context/provider: refreshes access token from cookie, 
//    hydrates current user, and exposes flags (isAuthenticated, isAdmin) 
//    plus actions (login, logout).

//  * On mount: calls /auth/refresh, then check() and GET /users/current; 
//    sets a `ready` gate so routing doesn’t hinge on token presence.

//  * Exports: <AuthProvider>, useAuth().

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { login as apiLogin, logout as apiLogout, check } from "../api/auth";
import { getAccessToken, setAccessToken } from "../api/client";
import { getCurrentUser } from "../api/users";

const AuthCtx = createContext(null);

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
    const groups =  user?.groups ?? user?.usergroup ?? [];
    const isActive = user?.active !== 0 && user?.active !== false;
    const inferredAdmin = groups.includes("Admin");
    const isAdmin = user == null ? null : Boolean(user?.isAdmin ?? inferredAdmin);

    // IMPORTANT: don’t hinge routing on token presence
    const isAuthenticated = !!user && isActive;

    return {
      user,
      ready,

      // flags
      isAuthenticated,
      isAuthed: isAuthenticated, // alias for older code
      isAdmin,

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
