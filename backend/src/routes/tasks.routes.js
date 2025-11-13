// backend/src/routes/tasks.routes.js
import express from "express";
import { ensureAuth } from "../middleware/jwt.js";
import { listTasks, createTask, appendTaskNote, updateTask, getTasksByState, promoteTaskToDone, } from "../controllers/tasks.controller.js";

const router = express.Router();

router.get("/", ensureAuth, listTasks);

// Assignment 3-----------------------------
router.post("/CreateTask", ensureAuth, createTask);
router.get("/GetTaskByState/:state", ensureAuth, getTasksByState);
router.post("/:taskID/PromoteTask2Done", ensureAuth, promoteTaskToDone);
// -----------------------------------------

router.post("/:taskID/notes", ensureAuth, appendTaskNote);
router.patch("/:taskID", ensureAuth, updateTask);

export default router;
