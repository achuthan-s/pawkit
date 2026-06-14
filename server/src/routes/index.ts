import { Router } from "express";
import authRoutes from "./auth";
import customerRoutes from "./customers";
import productRoutes from "./products";
import orderRoutes from "./orders";
import campaignRoutes from "./campaigns";
import communicationRoutes from "./communications";
import analyticsRoutes from "./analytics";
import jobsRoutes from "./jobs";
import segmentsRoutes from "./segments";
import aiRoutes from "./ai";

const router = Router();

router.use("/auth", authRoutes);
router.use("/customers", customerRoutes);
router.use("/products", productRoutes);
router.use("/orders", orderRoutes);
router.use("/campaigns", campaignRoutes);
router.use("/communications", communicationRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/jobs", jobsRoutes);
router.use("/segments", segmentsRoutes);
router.use("/ai", aiRoutes);

export default router;
