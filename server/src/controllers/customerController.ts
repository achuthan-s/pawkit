import { asyncHandler } from "../utils/asyncHandler";
import type { Response } from "express";
import { Customer } from "../models/Customer";
import { Pet } from "../models/Pet";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { Communication } from "../models/Communication";
import type { AuthRequest } from "../middleware/auth";
import { z } from "zod";


const ProfileSchema = z.object({
  phone: z.string().optional(),
  addresses: z.array(z.any()).optional()
}).passthrough();

const PetSchema = z.object({
  name: z.string().min(1).optional(),
  species: z.string().optional()
}).passthrough();

// ── Customer profile ──────────────────────────────────────────────────

export const getMyProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const customer = await Customer.findOne({ userId: req.user!.id })
    .populate("userId", "name email");
  if (!customer) { res.status(404).json({ error: "Profile not found" }); return; }
  res.json({ data: customer });
});

export const upsertMyProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = ProfileSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const customer = await Customer.findOneAndUpdate(
    { userId: req.user!.id },
    { ...parsed.data, userId: req.user!.id },
    { new: true, upsert: true, runValidators: true }
  ).populate("userId", "name email");
  res.json({ data: customer });
});

// ── CRM / Operator: all customers ─────────────────────────────────────

export const getAllCustomers = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const customers = await Customer.find()
    .populate("userId", "name email")
    .sort({ createdAt: -1 });
  res.json({ data: customers });
});

// ── Reorder Clock: enriched view with pet + product names ─────────────
export const getReorderClockData = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const customers = await Customer.find()
    .populate("userId", "name email")
    .sort({ daysUntilRunout: 1 }) // most urgent first (nulls/undefined last via Mongo)
    .lean();

  // Collect all petIds and productIds referenced by runoutPredictions
  const petIds: import("mongoose").Types.ObjectId[] = [];
  const productIds: import("mongoose").Types.ObjectId[] = [];
  for (const c of customers) {
    for (const p of c.runoutPredictions ?? []) {
      if (p.petId)     petIds.push(p.petId);
      if (p.productId) productIds.push(p.productId);
    }
  }

  const [pets, products] = await Promise.all([
    Pet.find({ _id: { $in: petIds } }).select("name species weight").lean(),
    Product.find({ _id: { $in: productIds } }).select("name").lean(),
  ]);

  const petMap     = new Map(pets.map((p) => [p._id.toString(), p]));
  const productMap = new Map(products.map((p) => [p._id.toString(), p]));

  const data = customers.map((c) => ({
    ...c,
    runoutPredictions: (c.runoutPredictions ?? []).map((pred) => ({
      ...pred,
      petId:     pred.petId?.toString(),
      productId: pred.productId?.toString(),
      pet:     pred.petId     ? (petMap.get(pred.petId.toString())     ?? null) : null,
      product: pred.productId ? (productMap.get(pred.productId.toString()) ?? null) : null,
    })),
  }));

  res.json({ data });
});

export const getCustomerById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const customer = await Customer.findById(req.params.id)
    .populate("userId", "name email");
  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
  const pets = await Pet.find({ customerId: customer._id });
  res.json({ data: { ...customer.toObject(), pets } });
});

// ── Pets (under customer profile) ────────────────────────────────────

export const getMyPets = asyncHandler(async (req: AuthRequest, res: Response) => {
  const customer = await Customer.findOne({ userId: req.user!.id });
  if (!customer) { res.status(404).json({ error: "Profile not found" }); return; }
  const pets = await Pet.find({ customerId: customer._id });
  res.json({ data: pets });
});

export const addPet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = PetSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const customer = await Customer.findOne({ userId: req.user!.id });
  if (!customer) { res.status(404).json({ error: "Profile not found" }); return; }
  const pet = await Pet.create({ ...parsed.data, customerId: customer._id });
  res.status(201).json({ data: pet });
});

export const updatePet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = PetSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const customer = await Customer.findOne({ userId: req.user!.id });
  if (!customer) { res.status(404).json({ error: "Profile not found" }); return; }
  const pet = await Pet.findOneAndUpdate(
    { _id: req.params.petId, customerId: customer._id },
    parsed.data,
    { new: true, runValidators: true }
  );
  if (!pet) { res.status(404).json({ error: "Pet not found" }); return; }
  res.json({ data: pet });
});

export const deletePet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const customer = await Customer.findOne({ userId: req.user!.id });
  if (!customer) { res.status(404).json({ error: "Profile not found" }); return; }
  const pet = await Pet.findOneAndDelete({ _id: req.params.petId, customerId: customer._id });
  if (!pet) { res.status(404).json({ error: "Pet not found" }); return; }
  res.json({ data: { message: "Pet removed" } });
});

// ── CRM: customer 360 sub-resources ──────────────────────────────────

export const getCustomerOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
  const orders = await Order.find({ customer: req.params.id })
    .sort({ createdAt: -1 })
    .limit(100);
  res.json({ data: orders });
});

export const getCustomerCommunications = asyncHandler(async (req: AuthRequest, res: Response) => {
  const comms = await Communication.find({ customerId: req.params.id })
    .populate("campaignId", "name channel")
    .sort({ createdAt: -1 })
    .limit(200);
  res.json({ data: comms });
});
