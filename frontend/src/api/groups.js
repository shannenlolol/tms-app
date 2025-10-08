// src/api/groups.js
import http from "./client";

// GET ["Admin","Dev Team","Project Lead","Project Manager"]
export const getUserGroups = async () => (await http.get("/user-groups")).data;

// POST { name } -> { name }
export const createUserGroup = async (name) =>
  (await http.post("/user-groups", { name })).data.name;
