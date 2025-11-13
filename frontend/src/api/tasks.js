// src/api/tasks.js
//  * Tasks API helpers: list tasks and create a new task.
//  * Uses the shared Axios client; endpoints: GET /tasks, POST /tasks.
//  * Exports: getTasks(params), createTask(payload).

import http from "./client";

export const getTasks = async (params) =>
  (await http.get("/tasks", { params })).data;

export const createTask = async (payload) =>
  (await http.post("/tasks/CreateTask", payload)).data;

export const appendTaskNote = async (taskID, entry, taskState) =>
  (await http.post(`/tasks/${encodeURIComponent(taskID)}/notes`, { entry, taskState })).data;

export const updateTask = async (taskID, payload) =>
  (await http.patch(`/tasks/${encodeURIComponent(taskID)}`, payload)).data;