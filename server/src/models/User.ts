import { Schema, model, Document } from "mongoose";
import bcrypt from "bcryptjs";

export type UserRole = "customer" | "marketer" | "operator" | "admin";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email address"],
    },
    password: {
      type: String,
      required: true,
      select: false,
      minlength: 8,
      maxlength: 128,
    },
    role: {
      type: String,
      enum: ["customer", "marketer", "operator", "admin"],
      default: "customer",
    },
    avatar: { type: String, trim: true },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[\d\s\-()]{7,20}$/, "Invalid phone number"],
    },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

// Never leak password in JSON responses — select: false already excludes it,
// but this guards against explicit .select('+password') leaking into responses.
userSchema.set("toJSON", {
  transform(_doc, ret) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ret as any).password = undefined;
    return ret;
  },
});

export const User = model<IUser>("User", userSchema);
