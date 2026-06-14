import { Schema, model, Document, Types } from "mongoose";

export type PetSpecies = "dog" | "cat" | "bird" | "rabbit" | "other";
export type PetGender = "male" | "female" | "unknown";

export interface IVaccination {
  name: string;
  administeredAt: Date;
  nextDueAt?: Date;
  veterinarian?: string;
}

export interface IFoodPreference {
  brand?: string;
  dailyAmountGrams?: number;
  feedingsPerDay?: number;
  dietaryNotes?: string;
}

export interface IPet extends Document {
  customerId: Types.ObjectId;
  name: string;
  species: PetSpecies;
  breed?: string;
  gender: PetGender;
  dob?: Date;
  weight?: number; // kg
  isNeutered: boolean;
  profileImage?: string;
  foodPreferences: IFoodPreference;
  vaccinations: IVaccination[];
  medicalNotes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const vaccinationSchema = new Schema<IVaccination>(
  {
    name: { type: String, required: true, trim: true },
    administeredAt: { type: Date, required: true },
    nextDueAt: { type: Date },
    veterinarian: { type: String, trim: true },
  },
  { _id: false }
);

const foodPreferenceSchema = new Schema<IFoodPreference>(
  {
    brand: { type: String, trim: true },
    dailyAmountGrams: { type: Number, min: 0 },
    feedingsPerDay: { type: Number, min: 1, max: 10 },
    dietaryNotes: { type: String, trim: true },
  },
  { _id: false }
);

const petSchema = new Schema<IPet>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    species: {
      type: String,
      required: true,
      enum: ["dog", "cat", "bird", "rabbit", "other"],
    },
    breed: { type: String, trim: true },
    gender: {
      type: String,
      enum: ["male", "female", "unknown"],
      default: "unknown",
    },
    dob: { type: Date },
    weight: { type: Number, min: 0, max: 200 },
    isNeutered: { type: Boolean, default: false },
    profileImage: { type: String, trim: true },
    foodPreferences: { type: foodPreferenceSchema, default: () => ({}) },
    vaccinations: { type: [vaccinationSchema], default: [] },
    medicalNotes: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: age in years derived from dob (avoids stale stored age)
petSchema.virtual("age").get(function () {
  if (!this.dob) return null;
  const ms = Date.now() - this.dob.getTime();
  return Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000));
});

// Indexes
petSchema.index({ customerId: 1 });
petSchema.index({ customerId: 1, isActive: 1 });
petSchema.index({ species: 1 });

export const Pet = model<IPet>("Pet", petSchema);
