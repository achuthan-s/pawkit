import { asyncHandler } from "../utils/asyncHandler";
import { z } from "zod";
import type { Request, Response } from "express";
import { User } from "../models/User";
import { Customer } from "../models/Customer";
import { signToken } from "../utils/jwt";

const RegisterSchema = z.object({
  name:     z.string().min(1).max(100).trim(),
  email:    z.string().email(),
  password: z.string().min(6).max(100),
  role:     z.enum(["customer", "marketer", "operator"]).default("customer"),
});

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }

  const { name, email, password, role } = parsed.data;

      const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    const user = await User.create({ name, email, password, role });

    if (role === "customer") {
      await Customer.create({ userId: user._id });
    }

    const token = signToken({ id: user._id, role: user.role });
    res.status(201).json({
      data: { token, user: { _id: user._id, name, email, role: user.role } } });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }

  const { email, password } = parsed.data;

      const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const token = signToken({ id: user._id, role: user.role });
    res.json({
      data: { token, user: { _id: user._id, name: user.name, email, role: user.role } } });
});
