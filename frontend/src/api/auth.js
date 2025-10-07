import { api } from "./client";

/** POST /auth — form-encoded login */
export async function login(username, password) {
  const body = new URLSearchParams({ username, password });
  const res = await api("/auth", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.message || "Login failed");
  return data; // { ok:true, username }
}

/** GET /adminhome — verify session */
export async function getHome() {
  const res = await api("/adminhome");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Not authorised");
  return data; // { ok:true, username, message }
}

/** POST /logout — end session */
export async function logout() {
  const res = await api("/logout", { method: "POST" });
  // backend returns { ok:true } on success
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.message || "Logout failed");
  return true;
}
