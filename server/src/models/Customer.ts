import { Schema, model, Document, Types } from "mongoose";

export type CustomerSegment = "high-ltv" | "loyal" | "at-risk" | "new" | "growing" | "inactive";

export interface IAddress {
  label?: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  isDefault: boolean;
}

export interface IRunoutPrediction {
  petId:               Types.ObjectId;
  productId?:          Types.ObjectId;
  predictedRunoutDate: Date;
  daysUntilRunout:     number;   // negative = already overdue
  confidence:          number;   // 0–100
  method?:             "cold-start" | "blended" | "empirical";
  calculatedAt:        Date;
}

export interface IChannelOptIns {
  whatsapp: boolean;
  sms:      boolean;
  email:    boolean;
  rcs:      boolean;
}

export interface ICustomer extends Document {
  userId:       Types.ObjectId;
  phone?:       string;
  addresses:    IAddress[];
  channelOptIns: IChannelOptIns;
  // CRM analytics (denormalized from Orders for fast reads)
  ltv:          number;
  orderCount:   number;
  lastOrderAt?: Date;
  segment:      CustomerSegment;
  tags:         string[];
  runoutPredictions: IRunoutPrediction[];
  // Denormalized from runoutPredictions for fast range queries
  nextRunoutAt?:    Date;
  daysUntilRunout?: number;      // negative = overdue
  isBlocked:    boolean;
  createdAt:    Date;
  updatedAt:    Date;
}

const addressSchema = new Schema<IAddress>(
  {
    label:     { type: String, trim: true, default: "Home" },
    street:    { type: String, required: true, trim: true },
    city:      { type: String, required: true, trim: true },
    state:     { type: String, required: true, trim: true },
    zip:       { type: String, required: true, trim: true },
    country:   { type: String, required: true, trim: true, default: "India" },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false }
);

const channelOptInsSchema = new Schema<IChannelOptIns>(
  {
    whatsapp: { type: Boolean, default: true },
    sms:      { type: Boolean, default: true },
    email:    { type: Boolean, default: true },
    rcs:      { type: Boolean, default: true },
  },
  { _id: false }
);

const runoutPredictionSchema = new Schema<IRunoutPrediction>(
  {
    petId:               { type: Schema.Types.ObjectId, ref: "Pet", required: true },
    productId:           { type: Schema.Types.ObjectId, ref: "Product" },
    predictedRunoutDate: { type: Date, required: true },
    daysUntilRunout:     { type: Number, required: true }, // no min — can be negative
    confidence:          { type: Number, required: true, min: 0, max: 100 },
    method:              { type: String, enum: ["cold-start", "blended", "empirical"] },
    calculatedAt:        { type: Date, default: Date.now },
  },
  { _id: false }
);

const customerSchema = new Schema<ICustomer>(
  {
    userId: {
      type:     Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      unique:   true,
    },
    phone: {
      type:  String,
      trim:  true,
      match: [/^\+?[\d\s\-()]{7,20}$/, "Invalid phone number"],
    },
    addresses:     { type: [addressSchema], default: [] },
    channelOptIns: { type: channelOptInsSchema, default: () => ({ whatsapp: true, sms: true, email: true, rcs: true }) },

    ltv:          { type: Number, default: 0, min: 0 },
    orderCount:   { type: Number, default: 0, min: 0 },
    lastOrderAt:  { type: Date },
    segment: {
      type:    String,
      enum:    ["high-ltv", "loyal", "at-risk", "new", "growing", "inactive"],
      default: "new",
    },
    tags:              [{ type: String, trim: true }],
    runoutPredictions: { type: [runoutPredictionSchema], default: [] },
    nextRunoutAt:      { type: Date },
    daysUntilRunout:   { type: Number },
    isBlocked:         { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes (userId already indexed via unique:true)
customerSchema.index({ segment: 1 });
customerSchema.index({ ltv: -1 });
customerSchema.index({ lastOrderAt: -1 });
customerSchema.index({ tags: 1 });
customerSchema.index({ isBlocked: 1 });
customerSchema.index({ nextRunoutAt: 1 });   // fast range queries for radar
customerSchema.index({ daysUntilRunout: 1 });

export const Customer = model<ICustomer>("Customer", customerSchema);
