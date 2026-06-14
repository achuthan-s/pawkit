import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import {
  getMyOrders,
  getOrderById,
  getAllOrders,
  createOrder,
  updateOrderStatus,
} from "../controllers/orderController";

const router = Router();

router.use(authenticate);

router.get("/my", getMyOrders);
router.get("/my/:id", getOrderById);
router.post("/", authorize("customer"), createOrder);

// Operator
router.get("/", authorize("operator"), getAllOrders);
router.patch("/:id/status", authorize("operator"), updateOrderStatus);

export default router;
