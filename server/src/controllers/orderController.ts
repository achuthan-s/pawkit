import { asyncHandler } from "../utils/asyncHandler";
import { z } from "zod";
import type { Response } from "express";
import { Order }    from "../models/Order";
import { Customer } from "../models/Customer";
import type { AuthRequest } from "../middleware/auth";
import { recomputeForCustomer } from "../services/reorderClock";

const AddressSchema = z.object({
  street:  z.string().min(1),
  city:    z.string().min(1),
  state:   z.string().min(1),
  zip:     z.string().min(1),
  country: z.string().default("India"),
});

const OrderItemSchema = z.object({
  product:      z.string().length(24),
  productName:  z.string().min(1),
  productImage: z.string().default(""),
  selectedSize: z.string().min(1),
  quantity:     z.number().int().min(1),
  unitPrice:    z.number().min(0),
  totalPrice:   z.number().min(0).optional(),
});

const CreateOrderSchema = z.object({
  items:           z.array(OrderItemSchema).min(1),
  shippingAddress: AddressSchema,
  paymentMethod:   z.enum(["upi", "card", "netbanking", "cod", "wallet"]).default("upi"),
  subtotal:        z.number().min(0),
  deliveryFee:     z.number().min(0).default(40),
  discount:        z.number().min(0).default(0),
  total:           z.number().min(0),
  couponCode:      z.string().optional(),
  notes:           z.string().optional(),
});

export const getMyOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
  const customer = await Customer.findOne({ userId: req.user!.id });
  if (!customer) { res.status(404).json({ error: "Customer profile not found" }); return; }
  const orders = await Order.find({ customer: customer._id })
    .populate("items.product", "name images")
    .sort({ createdAt: -1 });
  res.json({ data: orders });
});

export const getOrderById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const customer = await Customer.findOne({ userId: req.user!.id });
  if (!customer) { res.status(404).json({ error: "Customer profile not found" }); return; }
  const order = await Order.findOne({ _id: req.params.id, customer: customer._id })
    .populate("items.product", "name images");
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  res.json({ data: order });
});

export const getAllOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status, search } = req.query as { status?: string; search?: string };
  const filter: Record<string, unknown> = {};
  if (status && status !== "all") filter.status = status;

  const orders = await Order.find(filter)
    .populate({ path: "customer", populate: { path: "userId", select: "name email" } })
    .sort({ createdAt: -1 });

  const result = search
    ? orders.filter((o) => {
        const cust = o.customer as unknown as { userId?: { name?: string; email?: string } };
        const name = cust?.userId?.name?.toLowerCase() ?? "";
        const email = cust?.userId?.email?.toLowerCase() ?? "";
        const q = search.toLowerCase();
        return name.includes(q) || email.includes(q) || o.orderNumber?.toLowerCase().includes(q);
      })
    : orders;

  res.json({ data: result });
});

export const createOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = CreateOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }
  const customer = await Customer.findOne({ userId: req.user!.id });
  if (!customer) { res.status(404).json({ error: "Customer profile not found" }); return; }
  const items = parsed.data.items.map((item) => ({
    ...item,
    totalPrice: item.totalPrice ?? item.unitPrice * item.quantity,
  }));
  const order = await Order.create({ ...parsed.data, items, customer: customer._id });

  // Update denormalized CRM fields
  await Customer.findByIdAndUpdate(customer._id, {
    $inc: { ltv: order.total, orderCount: 1 },
    lastOrderAt: order.createdAt,
  });

  // Recompute runout clock (fire-and-forget — don't block the response)
  recomputeForCustomer(customer._id.toString()).catch((err) =>
    console.error("reorderClock post-order trigger failed:", err)
  );

  res.status(201).json({ data: order });
});


const StatusSchema = z.object({
  status: z.enum(["confirmed", "shipped", "delivered", "cancelled"])
});

export const updateOrderStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = StatusSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid status" }); return; }
  const { status } = parsed.data;
  const trackingDescriptions: Record<string, string> = {
    confirmed: "Order confirmed by seller",
    shipped:   "Order shipped",
    delivered: "Order delivered successfully",
    cancelled: "Order cancelled",
  };

  const order = await Order.findByIdAndUpdate(
    req.params.id,
    {
      status,
      $push: {
        trackingTimeline: {
          status:      status === "confirmed" ? "packed" : status,
          description: trackingDescriptions[status] ?? status,
          timestamp:   new Date(),
        },
      },
    },
    { new: true }
  );
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  res.json({ data: order });
});
