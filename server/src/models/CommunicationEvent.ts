import { Schema, model, Document, Types } from "mongoose";
import type { CommEventType } from "./Communication";

export interface ICommunicationEvent extends Document {
  eventId:         string;           // idempotency key — UUID from simulator
  communicationId: Types.ObjectId;
  event:           CommEventType;
  timestamp:       Date;
  metadata?:       Record<string, unknown>;
  receivedAt:      Date;
}

const communicationEventSchema = new Schema<ICommunicationEvent>(
  {
    eventId:         { type: String, required: true, unique: true },
    communicationId: { type: Schema.Types.ObjectId, ref: "Communication", required: true },
    event:           {
      type:     String,
      required: true,
      enum:     ["sent", "delivered", "opened", "clicked", "converted", "failed", "bounced"],
    },
    timestamp:  { type: Date, required: true },
    metadata:   { type: Schema.Types.Mixed },
    receivedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// eventId is already unique — also index by communicationId for lookup
communicationEventSchema.index({ communicationId: 1, event: 1 });

export const CommunicationEvent = model<ICommunicationEvent>(
  "CommunicationEvent",
  communicationEventSchema
);
