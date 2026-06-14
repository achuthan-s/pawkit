import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import {
  previewSegment,
  listSavedSegments,
  createSavedSegment,
  deleteSavedSegment,
} from "../controllers/segmentController";

const router = Router();

router.use(authenticate, authorize("marketer", "operator"));

// preview must be declared before /:id so "preview" isn't treated as an ObjectId
router.get("/preview", previewSegment);

router.get("/",      listSavedSegments);
router.post("/",     createSavedSegment);
router.delete("/:id", deleteSavedSegment);

export default router;
