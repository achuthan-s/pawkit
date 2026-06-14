import { Schema, model, Document, Types } from "mongoose";

export interface ISavedSegment extends Document {
  name:        string;
  createdBy:   Types.ObjectId;
  filterState: Record<string, unknown>; // raw UI filter state
  lastTotal:   number;
  createdAt:   Date;
  updatedAt:   Date;
}

const savedSegmentSchema = new Schema<ISavedSegment>(
  {
    name:        { type: String, required: true, trim: true, maxlength: 100 },
    createdBy:   { type: Schema.Types.ObjectId, ref: "User", required: true },
    filterState: { type: Schema.Types.Mixed, required: true },
    lastTotal:   { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

savedSegmentSchema.index({ createdBy: 1, createdAt: -1 });

export const SavedSegment = model<ISavedSegment>("SavedSegment", savedSegmentSchema);
