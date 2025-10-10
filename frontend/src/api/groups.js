// src/api/groups.js
import http from "./client";

// GET ["Admin","Dev Team","Project Lead","Project Manager"]
export const getUserGroups = async () => (await http.get("/groups")).data;

// POST { name } -> { name }
export const createUserGroup = async (name) =>
  (await http.post("/groups", { name })).data.name;
