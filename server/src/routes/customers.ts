import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import {
  getMyProfile,
  upsertMyProfile,
  getAllCustomers,
  getReorderClockData,
  getCustomerById,
  getCustomerOrders,
  getCustomerCommunications,
  getMyPets,
  addPet,
  updatePet,
  deletePet,
} from "../controllers/customerController";

const router = Router();

router.use(authenticate);

// Customer self-service
router.get("/me", getMyProfile);
router.put("/me", upsertMyProfile);
router.get("/me/pets", getMyPets);
router.post("/me/pets", addPet);
router.patch("/me/pets/:petId", updatePet);
router.delete("/me/pets/:petId", deletePet);

// CRM / Operator — full list + 360 sub-resources
router.get("/", authorize("marketer", "operator"), getAllCustomers);
router.get("/reorder-clock", authorize("marketer", "operator"), getReorderClockData);
router.get("/:id/orders", authorize("marketer", "operator"), getCustomerOrders);
router.get("/:id/communications", authorize("marketer", "operator"), getCustomerCommunications);
router.get("/:id", authorize("marketer", "operator"), getCustomerById);

export default router;
