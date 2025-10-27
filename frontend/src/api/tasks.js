// src/api/tasks.js
//  * Tasks API helpers: list tasks and create a new task.
//  * Uses the shared Axios client; endpoints: GET /tasks, POST /tasks.
//  * Exports: getTasks(params), createTask(payload).

import http from "./client";

export const getTasks = async (params) =>
  (await http.get("/tasks", { params })).data;

export const createTask = async (payload) =>
  (await http.post("/tasks", payload)).data;

export const appendTaskNote = async (taskName, entry) =>
  (await http.post(`/tasks/${encodeURIComponent(taskName)}/notes`, { entry })).data;

export const updateTask = async (taskName, payload) =>
  (await http.patch(`/tasks/${encodeURIComponent(taskName)}`, payload)).data;