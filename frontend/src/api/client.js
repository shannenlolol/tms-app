// frontend/src/api/client.js
const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export async function api(path, opts = {}) {
  return fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...opts,
  });
}
