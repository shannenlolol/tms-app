// Simple fetch helpers for Users CRUD
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000/api";

async function http(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

export function getUsers() {
  return http("/users");
}

export function createUser(payload) {
  return http("/users", { method: "POST", body: JSON.stringify(payload) });
}

export function updateUser(id, payload) {
  return http(`/users/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}

export function toggleActive(id, active) {
  return http(`/users/${id}/active`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
}
    