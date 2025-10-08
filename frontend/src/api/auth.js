// src/api/auth.js
import http, { setAccessToken } from "./client";

export async function login(username, password) {
  const { data } = await http.post("/auth", { username, password });
  setAccessToken(data?.accessToken || null);
  return data?.user || null;
}

// GET /api/check -> profile | 401
export async function check() {
  try {
    const { data } = await client.get("/api/check");
    return data ?? null;
  } catch (e) {
    if (e?.response?.status === 401) return null; // treat as signed-out
    throw e;
  }
}
export async function logout() {
  setAccessToken(null);
  await http.post("/logout");
}
