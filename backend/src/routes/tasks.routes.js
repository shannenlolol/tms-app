// backend/src/routes/tasks.routes.js
import express from "express";
import { ensureAuth } from "../middleware/jwt.js";
import { listTasks, createTask, appendTaskNote, updateTask, getTasksByState, promoteTaskToDone, } from "../controllers/tasks.controller.js";

const router = express.Router();

router.get("/", ensureAuth, listTasks);
router.post("/", ensureAuth, createTask);
router.post("/:taskName/notes", ensureAuth, appendTaskNote);
router.patch("/:taskName", ensureAuth, updateTask);
router.get("/state/:state", ensureAuth, getTasksByState);
router.post("/:taskName/promote-to-done", ensureAuth, promoteTaskToDone);

export default router;
