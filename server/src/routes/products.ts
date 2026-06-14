import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import {
  getProducts,
  getProduct,
  getRelatedProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController";

const router = Router();

router.get("/", getProducts);
router.get("/:id", getProduct);
router.get("/:id/related", getRelatedProducts);

router.post("/", authenticate, authorize("operator"), createProduct);
router.patch("/:id", authenticate, authorize("operator"), updateProduct);
router.delete("/:id", authenticate, authorize("operator"), deleteProduct);

export default router;
