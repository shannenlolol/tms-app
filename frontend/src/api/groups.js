// src/api/groups.js
//  * Groups API helpers: list groups and create a new group.
//  * Uses the shared Axios client; endpoints: GET /groups, POST /groups.
//  * Exports: getGroups(), createGroup(name).

import http from "./client";

// GET ["Admin","Dev Team","Project Lead","Project Manager"]
export const getUserGroups = async () => (await http.get("/groups")).data;

// POST { name } -> { name }
export const createUserGroup = async (name) =>
  (await http.post("/groups", { name })).data.name;
