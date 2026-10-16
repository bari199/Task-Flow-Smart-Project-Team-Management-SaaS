import { Router } from "express";

import { authenticate } from "../middlewares/authenticate.middleware.js";

import {
  getPreferences,
  updatePreferences,
} from "../controller/notification.preference.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", getPreferences);
router.patch("/", updatePreferences);

export default router;
