// src/api/auth.js (cookie-based)
import axios from "./client";

// POST /api/auth/login  -> { ok, user }
export async function login(username, password) {
  const { data } = await axios.post("/auth/login", { username, password });
  return data?.user || null; // cookies carry auth
}

// GET /api/auth/check -> user | null
export async function check() {
  try {
    const { data } = await axios.get("/auth/check");
    return data?.user ?? data ?? null;
  } catch (e) {
    if (e?.response?.status === 401) return null;
    throw e;
  }
}

// POST /api/auth/logout -> 204
export async function logout() {
  await axios.post("/auth/logout", null);
}
