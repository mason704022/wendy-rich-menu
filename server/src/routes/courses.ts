import { Router } from "express";
import { loadJson } from "../config.js";

export const coursesRouter = Router();

coursesRouter.get("/", (_req, res) => {
  res.json(loadJson("courses.json"));
});
