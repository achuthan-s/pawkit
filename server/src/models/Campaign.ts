import { Schema, model, Document, Types } from "mongoose";

export type CampaignChannel = "whatsapp" | "sms" | "email" | "rcs";
export type CampaignStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "running"
  | "completed"
  | "cancelled";

export interface IAudienceFilter {
  segment?: string;               // "at-risk" | "high-ltv" | etc.
  minLtv?: number;
  maxDaysSinceOrder?: number;     // inactive for N+ days
  maxDaysUntilRunout?: number;    // runout within N days
  tags?: string[];
  species?: string[];             // filter by pet species
}

export interface ICampaignStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  bounced: number;
  converted: number;
  revenue: number;               // estimated revenue attributed
}

export interface ILastLaunch {
  resolved:         number;
  sent:             number;
  excluded: {
    optedOut:        number;
    frequencyCapped: number;
  };
  launchedAt: Date;
}

export interface ICampaign extends Document {
  name: string;
  goal: string;
  channel: CampaignChannel;
  targetAudience: IAudienceFilter;
  audienceCount: number;
  messageTemplate: string;
  frequencyCapDays: number;       // min days between messages to same customer on same channel
  status: CampaignStatus;
  scheduledAt?: Date;
  completedAt?: Date;
  estimatedRevenue?: number;
  createdBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  stats: ICampaignStats;
  lastLaunch?: ILastLaunch;
  createdAt: Date;
  updatedAt: Date;
}

const audienceFilterSchema = new Schema<IAudienceFilter>(
  {
    segment: { type: String },
    minLtv: { type: Number, min: 0 },
    maxDaysSinceOrder: { type: Number, min: 0 },
    maxDaysUntilRunout: { type: Number },
    tags: [{ type: String }],
    species: [{ type: String }],
  },
  { _id: false }
);

const campaignSchema = new Schema<ICampaign>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    goal: { type: String, required: true, trim: true },
    channel: {
      type: String,
      required: true,
      enum: ["whatsapp", "sms", "email", "rcs"],
    },
    targetAudience: { type: audienceFilterSchema, default: () => ({}) },
    audienceCount: { type: Number, default: 0, min: 0 },
    messageTemplate: { type: String, required: true },
    frequencyCapDays: { type: Number, default: 7, min: 1, max: 365 },
    status: {
      type: String,
      enum: ["draft", "pending_approval", "approved", "running", "completed", "cancelled"],
      default: "draft",
    },
    scheduledAt: { type: Date },
    completedAt: { type: Date },
    estimatedRevenue: { type: Number, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    stats: {
      sent:      { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      opened:    { type: Number, default: 0 },
      clicked:   { type: Number, default: 0 },
      failed:    { type: Number, default: 0 },
      bounced:   { type: Number, default: 0 },
      converted: { type: Number, default: 0 },
      revenue:   { type: Number, default: 0 },
    },
    lastLaunch: {
      resolved:        { type: Number },
      sent:            { type: Number },
      excluded: {
        optedOut:        { type: Number },
        frequencyCapped: { type: Number },
      },
      launchedAt: { type: Date },
    },
  },
  { timestamps: true }
);

// Stamp completedAt when status flips to completed
campaignSchema.pre("save", function (next) {
  if (this.isModified("status") && this.status === "completed" && !this.completedAt) {
    this.completedAt = new Date();
  }
  next();
});

// Stamp approvedAt when approvedBy is set
campaignSchema.pre("save", function (next) {
  if (this.isModified("approvedBy") && this.approvedBy && !this.approvedAt) {
    this.approvedAt = new Date();
  }
  next();
});

// Indexes
campaignSchema.index({ status: 1, createdAt: -1 });
campaignSchema.index({ createdBy: 1 });
campaignSchema.index({ scheduledAt: 1, status: 1 });
campaignSchema.index({ channel: 1 });

export const Campaign = model<ICampaign>("Campaign", campaignSchema);
