// backend/src/routes/tasks.routes.js
import express from "express";
import { ensureAuth } from "../middleware/jwt.js";
import { listTasks, createTask, appendTaskNote, updateTask } from "../controllers/tasks.controller.js";

const router = express.Router();

router.get("/", ensureAuth, listTasks);
router.post("/", ensureAuth, createTask);
router.post("/:taskName/notes", ensureAuth, appendTaskNote);
router.patch("/:taskName", ensureAuth, updateTask);

export default router;
