// src/api/auth.js
//  * Authentication helpers: login, session check, logout; refresh via HttpOnly cookie.
//  * Endpoints: POST /auth/login, GET /auth/session, POST /auth/logout, POST /auth/refresh.
//  * Stores access token in memory (not localStorage).

import http, { setAccessToken } from "./client";

// POST /api/auth  -> { accessToken, user }
export async function login(username, password) {
  const { data } = await http.post("/auth/login", { username, password });
  setAccessToken(data?.accessToken || null);
  return data?.user || null;
}

// GET /api/check -> profile | 401
export async function check() {
  try {
    // IMPORTANT: use `http`, and don't prefix with /api because baseURL already has it
    const { data } = await http.get("/auth/check");
    return data?.user ?? data ?? null;
  } catch (e) {
    if (e?.response?.status === 401) return null; // unauthenticated is not an exception
    throw e;
  }
}

// POST /api/auth/logout (adjust if your backend route is different)
export async function logout() {
  try {
    // clear refresh cookie server-side
    await http.post("/auth/logout", null, { withCredentials: true });
  } finally {
    // always drop access token locally
    setAccessToken(null);
  }
}