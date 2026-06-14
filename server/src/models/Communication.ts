import { Schema, model, Document, Types } from "mongoose";
import type { CampaignChannel } from "./Campaign";

export type CommStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "converted"
  | "failed"
  | "bounced";

export type CommEventType =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "converted"
  | "failed"
  | "bounced";

export interface ICommEvent {
  type: CommEventType;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ICommunication extends Document {
  campaignId: Types.ObjectId;
  customerId: Types.ObjectId;
  channel: CampaignChannel;
  recipient: string;
  message: string;
  status: CommStatus;
  externalMessageId?: string;
  events: ICommEvent[];
  // Denormalized timestamps for fast range queries
  sentAt?:      Date;
  deliveredAt?: Date;
  openedAt?:    Date;
  clickedAt?:   Date;
  convertedAt?: Date;
  // Error details when status is failed/bounced
  errorCode?:    string;
  errorMessage?: string;
  // Attribution: set when a converted event creates an attributed order
  attributedOrderId?: Types.ObjectId;
  attributedRevenue?: number;
  createdAt: Date;
  updatedAt: Date;
}

const commEventSchema = new Schema<ICommEvent>(
  {
    type: {
      type: String,
      required: true,
      enum: ["sent", "delivered", "opened", "clicked", "converted", "failed", "bounced"],
    },
    timestamp: { type: Date, default: Date.now },
    metadata:  { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const communicationSchema = new Schema<ICommunication>(
  {
    campaignId:  { type: Schema.Types.ObjectId, ref: "Campaign",  required: true },
    customerId:  { type: Schema.Types.ObjectId, ref: "Customer",  required: true },
    channel: {
      type:     String,
      required: true,
      enum:     ["whatsapp", "sms", "email", "rcs"],
    },
    recipient:          { type: String, required: true, trim: true },
    message:            { type: String, required: true },
    status: {
      type:    String,
      enum:    ["queued", "sent", "delivered", "opened", "clicked", "converted", "failed", "bounced"],
      default: "queued",
    },
    externalMessageId: { type: String, trim: true },
    events:            { type: [commEventSchema], default: [] },
    sentAt:            { type: Date },
    deliveredAt:       { type: Date },
    openedAt:          { type: Date },
    clickedAt:         { type: Date },
    convertedAt:       { type: Date },
    errorCode:           { type: String, trim: true },
    errorMessage:        { type: String, trim: true },
    attributedOrderId:   { type: Schema.Types.ObjectId, ref: "Order" },
    attributedRevenue:   { type: Number, min: 0 },
  },
  { timestamps: true }
);

// Indexes
communicationSchema.index({ campaignId: 1, status: 1 });
communicationSchema.index({ customerId: 1, createdAt: -1 });
communicationSchema.index({ status: 1 });
communicationSchema.index({ externalMessageId: 1 }, { sparse: true });

export const Communication = model<ICommunication>("Communication", communicationSchema);
