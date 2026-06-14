import { asyncHandler } from "../utils/asyncHandler";
import type { Request, Response } from "express";
import { Product } from "../models/Product";
import { z } from "zod";


const ProductSchema = z.object({
  name: z.string().min(1).optional(),
  basePrice: z.number().min(0).optional(),
  category: z.string().optional()
}).passthrough();

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const { category, subcategory, q, limit = "20", page = "1", showAll } = req.query;
  const filter: Record<string, unknown> = showAll === "true" ? {} : { active: true };
  if (category) filter.category = category;
  if (subcategory) filter.subcategory = subcategory;
  if (q) filter.$text = { $search: q as string };

  const skip = (Number(page) - 1) * Number(limit);
  const [products, total] = await Promise.all([
    Product.find(filter).sort({ "ratings.average": -1 }).skip(skip).limit(Number(limit)),
    Product.countDocuments(filter),
  ]);
  res.json({ data: products, total });
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findById(req.params.id);
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json({ data: product });
});

export const getRelatedProducts = asyncHandler(async (req: Request, res: Response) => {
  const product = await Product.findById(req.params.id);
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  const related = await Product.find({
    category: product.category,
    _id: { $ne: product._id },
    active: true,
  }).limit(4);
  res.json({ data: related });
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const parsed = ProductSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const product = await Product.create(parsed.data);
  res.status(201).json({ data: product });
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const parsed = ProductSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const product = await Product.findByIdAndUpdate(req.params.id, parsed.data, {
    new: true,
    runValidators: true,
  });
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json({ data: product });
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  await Product.findByIdAndUpdate(req.params.id, { active: false });
  res.json({ data: { message: "Product deactivated" } });
});
