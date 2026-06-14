import { Schema, model, Document } from "mongoose";
import { randomBytes } from "crypto";

export type ProductCategory =
  | "dog-food"
  | "cat-food"
  | "treats"
  | "supplements"
  | "accessories"
  | "health"
  | "grooming"
  | "other";

export type ProductSpecies = "dog" | "cat" | "bird" | "rabbit" | "all";

export interface IProductSize {
  label: string;       // "1kg", "5kg", "500g"
  price: number;
  inventory: number;
  sku: string;
}

export interface IProductDimensions {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  weightGrams: number;
}

export interface INutritionalInfo {
  protein?: number;    // g per 100g
  fat?: number;
  fibre?: number;
  moisture?: number;
  calories?: number;   // kcal per 100g
}

export interface IProduct extends Document {
  name: string;
  slug: string;
  sku: string;
  brand?: string;
  description: string;
  basePrice: number;
  sizes: IProductSize[];
  category: ProductCategory;
  subcategory?: string;
  targetSpecies: ProductSpecies[];
  images: string[];
  features: string[];
  tags: string[];
  nutritionalInfo?: INutritionalInfo;
  dimensions?: IProductDimensions;
  ratings: { average: number; count: number };
  isFeatured: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const productSizeSchema = new Schema<IProductSize>(
  {
    label: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    inventory: { type: Number, required: true, min: 0, default: 0 },
    sku: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const dimensionsSchema = new Schema<IProductDimensions>(
  {
    lengthCm: { type: Number, min: 0 },
    widthCm: { type: Number, min: 0 },
    heightCm: { type: Number, min: 0 },
    weightGrams: { type: Number, min: 0 },
  },
  { _id: false }
);

const nutritionalInfoSchema = new Schema<INutritionalInfo>(
  {
    protein: { type: Number, min: 0 },
    fat: { type: Number, min: 0 },
    fibre: { type: Number, min: 0 },
    moisture: { type: Number, min: 0 },
    calories: { type: Number, min: 0 },
  },
  { _id: false }
);

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    sku: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
    },
    brand: { type: String, trim: true },
    description: { type: String, required: true },
    basePrice: { type: Number, required: true, min: 0 },
    sizes: { type: [productSizeSchema], default: [] },
    category: {
      type: String,
      required: true,
      enum: ["dog-food", "cat-food", "treats", "supplements", "accessories", "health", "grooming", "other"],
    },
    subcategory: { type: String, trim: true },
    targetSpecies: {
      type: [String],
      enum: ["dog", "cat", "bird", "rabbit", "all"],
      default: ["all"],
    },
    images: [{ type: String }],
    features: [{ type: String }],
    tags: [{ type: String, trim: true, lowercase: true }],
    nutritionalInfo: { type: nutritionalInfoSchema },
    dimensions: { type: dimensionsSchema },
    ratings: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0, min: 0 },
    },
    isFeatured: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Auto-generate slug and SKU if not provided
productSchema.pre("validate", function () {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
  if (!this.sku) {
    this.sku = "PWK-" + randomBytes(4).toString("hex").toUpperCase();
  }
});

// Indexes
productSchema.index({ active: 1, category: 1 });
productSchema.index({ active: 1, targetSpecies: 1 });
productSchema.index({ isFeatured: 1, active: 1 });
productSchema.index({ tags: 1 });
productSchema.index({ name: "text", description: "text", brand: "text", tags: "text" });

export const Product = model<IProduct>("Product", productSchema);
