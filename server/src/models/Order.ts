import { Schema, model, Document, Types } from "mongoose";
import { randomBytes } from "crypto";
import type { IAddress } from "./Customer";

export type OrderStatus = "pending" | "confirmed" | "packed" | "shipped" | "delivered" | "cancelled";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded" | "partially_refunded";
export type PaymentMethod = "upi" | "card" | "netbanking" | "cod" | "wallet";
export type TrackingStatus = "ordered" | "confirmed" | "packed" | "shipped" | "out_for_delivery" | "delivered" | "cancelled";

export interface IOrderItem {
  product: Types.ObjectId;
  productName: string;
  productImage: string;
  selectedSize: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ITrackingEvent {
  status: TrackingStatus;
  description: string;
  location?: string;
  timestamp: Date;
}

export interface IRefund {
  amount: number;
  reason: string;
  processedAt: Date;
  transactionId?: string;
}

export interface IOrder extends Document {
  orderNumber: string;
  customer: Types.ObjectId;
  items: IOrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  couponCode?: string;
  total: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  transactionId?: string;
  shippingAddress: IAddress;
  expectedDeliveryAt?: Date;
  trackingTimeline: ITrackingEvent[];
  refund?: IRefund;
  notes?: string;
  attributedCommunicationId?: Types.ObjectId;  // set when order is created via campaign conversion
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema(
  {
    label: { type: String },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zip: { type: String, required: true },
    country: { type: String, required: true, default: "India" },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false }
);

const orderItemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    productImage: { type: String, default: "" },
    selectedSize: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const trackingSchema = new Schema<ITrackingEvent>(
  {
    status: {
      type: String,
      required: true,
      enum: ["ordered", "confirmed", "packed", "shipped", "out_for_delivery", "delivered", "cancelled"],
    },
    description: { type: String, required: true },
    location: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const refundSchema = new Schema<IRefund>(
  {
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true },
    processedAt: { type: Date, required: true },
    transactionId: { type: String },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      unique: true,
      // Collision-safe: prefix + 8 random hex chars
      default: () => "PWK-" + randomBytes(4).toString("hex").toUpperCase(),
    },
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    items: { type: [orderItemSchema], required: true, validate: [(v: unknown[]) => v.length > 0, "Order must have at least one item"] },
    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, default: 40, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    couponCode: { type: String, trim: true, uppercase: true },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "packed", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["upi", "card", "netbanking", "cod", "wallet"],
      default: "upi",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "partially_refunded"],
      default: "pending",
    },
    transactionId: { type: String, trim: true },
    shippingAddress: { type: addressSchema, required: true },
    expectedDeliveryAt: { type: Date },
    trackingTimeline: { type: [trackingSchema], default: [] },
    refund: { type: refundSchema },
    notes: { type: String, trim: true },
    attributedCommunicationId: { type: Schema.Types.ObjectId, ref: "Communication" },
  },
  { timestamps: true }
);

// Seed tracking timeline on new orders
orderSchema.pre("save", function (next) {
  if (this.isNew && this.trackingTimeline.length === 0) {
    this.trackingTimeline.push({
      status: "ordered",
      description: "Order placed successfully",
      timestamp: new Date(),
    });
  }
  next();
});

// Indexes
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });

export const Order = model<IOrder>("Order", orderSchema);
