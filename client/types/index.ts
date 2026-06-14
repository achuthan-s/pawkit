// ── Auth ──────────────────────────────────────────────────────────────
export type UserRole = "customer" | "marketer" | "operator";

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ── Customer ──────────────────────────────────────────────────────────
export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface Customer {
  _id: string;
  userId: string | { _id?: string; name: string; email: string };
  phone?: string;
  /** addresses[] is what the API returns — use addresses[0] for the primary address */
  addresses: CrmAddress[];
  channelOptIns?: { whatsapp: boolean; sms: boolean; email: boolean; rcs: boolean };
  segment?: CustomerSegment;
  ltv?: number;
  orderCount?: number;
  lastOrderAt?: string;
  runoutPredictions?: RunoutPrediction[];
  daysUntilRunout?: number;
  nextRunoutAt?: string;
  tags?: string[];
  isBlocked?: boolean;
  createdAt: string;
  updatedAt?: string;
}

// ── Pet ───────────────────────────────────────────────────────────────
export type PetSpecies = "dog" | "cat" | "bird" | "rabbit" | "other";

export interface Pet {
  _id: string;
  name: string;
  species: PetSpecies;
  breed?: string;
  age: number;
  customerId: string;
  createdAt: string;
}

// ── Product ───────────────────────────────────────────────────────────
export type ProductCategory =
  | "dog-food"
  | "cat-food"
  | "treats"
  | "supplements"
  | "accessories"
  | "health"
  | "grooming"
  | "other";

export interface ProductSize {
  label: string;
  price: number;
  inventory?: number;
  sku?: string;
}

export interface Product {
  _id: string;
  name: string;
  brand?: string;
  description: string;
  basePrice: number;
  price?: number;
  sizes: ProductSize[];
  category: ProductCategory;
  subcategory?: string;
  targetSpecies?: string[];
  images: string[];
  features: string[];
  tags?: string[];
  ratings: { average: number; count: number };
  isFeatured?: boolean;
  active: boolean;
  createdAt: string;
}

// ── Cart ──────────────────────────────────────────────────────────────
export interface CartItem {
  product: Product;
  selectedSize: ProductSize;
  quantity: number;
}

// ── Order ─────────────────────────────────────────────────────────────
export type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
export type PaymentMethod = "upi" | "card" | "cod";

export type TrackingStatus =
  | "ordered"
  | "packed"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export interface TrackingEvent {
  status: TrackingStatus;
  description: string;
  timestamp: string;
}

export interface OrderItem {
  product: Product | string;
  productName: string;
  productImage: string;
  selectedSize: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
}

export interface Order {
  _id: string;
  orderNumber: string;
  customer: string | Customer;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount?: number;
  total: number;
  status: OrderStatus;
  shippingAddress: Address;
  paymentMethod: PaymentMethod;
  trackingTimeline: TrackingEvent[];
  createdAt: string;
  updatedAt?: string;
}

// ── Campaign ──────────────────────────────────────────────────────────
export type CampaignStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "running"
  | "completed"
  | "cancelled";
export type CampaignChannel = "whatsapp" | "sms" | "email" | "rcs";

export interface CampaignStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
}

export interface Campaign {
  _id: string;
  name: string;
  channel: CampaignChannel;
  targetSegment: string;
  messageTemplate: string;
  status: CampaignStatus;
  scheduledAt?: string;
  createdBy: string;
  stats: CampaignStats;
  createdAt: string;
}

// ── Communication ─────────────────────────────────────────────────────
export type CommStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "converted"
  | "failed"
  | "bounced";

export interface Communication {
  _id: string;
  campaignId: string;
  customerId: string;
  channel: CampaignChannel;
  recipient: string;
  message: string;
  status: CommStatus;
  createdAt: string;
}

// ── Analytics ─────────────────────────────────────────────────────────
export interface AnalyticsOverview {
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  activeCampaigns: number;
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

// ── CRM Extended Types ────────────────────────────────────────────────
export type CustomerSegment = "high-ltv" | "loyal" | "at-risk" | "new" | "growing" | "inactive";

export interface CrmAddress {
  label?: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  isDefault: boolean;
}

export interface RunoutPrediction {
  petId: string;
  productId?: string;
  predictedRunoutDate: string;
  daysUntilRunout: number;
  confidence: number;
  calculatedAt: string;
}

export interface Vaccination {
  _id?: string;
  name: string;
  administeredAt: string;
  nextDueAt?: string;
  veterinarian?: string;
}

export interface FoodPreference {
  brand?: string;
  dailyAmountGrams?: number;
  feedingsPerDay?: number;
  dietaryNotes?: string;
}

export interface CrmPet {
  _id: string;
  customerId: string;
  name: string;
  species: PetSpecies;
  breed?: string;
  gender: "male" | "female" | "unknown";
  dob?: string;
  age?: number;
  weight?: number;
  isNeutered: boolean;
  profileImage?: string;
  foodPreferences: FoodPreference;
  vaccinations: Vaccination[];
  medicalNotes?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CrmCustomer {
  _id: string;
  userId: { _id: string; name: string; email: string };
  phone?: string;
  addresses: CrmAddress[];
  segment: CustomerSegment;
  ltv: number;
  orderCount: number;
  lastOrderAt?: string;
  tags: string[];
  runoutPredictions: RunoutPrediction[];
  isBlocked: boolean;
  pets: CrmPet[];
  createdAt: string;
  updatedAt: string;
}

export interface CrmOrderItem {
  product: string | Product;
  productName: string;
  productImage: string;
  selectedSize: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface CrmOrder {
  _id: string;
  orderNumber: string;
  customer: string;
  items: CrmOrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  status: OrderStatus | "packed";
  paymentMethod: string;
  paymentStatus: string;
  transactionId?: string;
  shippingAddress: Address;
  expectedDeliveryAt?: string;
  trackingTimeline: TrackingEvent[];
  notes?: string;
  createdAt: string;
}

export interface CommEvent {
  type: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface CrmCommunication {
  _id: string;
  campaignId: string | { _id: string; name: string; channel: CampaignChannel };
  customerId: string;
  channel: CampaignChannel;
  recipient: string;
  message: string;
  status: CommStatus;
  events: CommEvent[];
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  convertedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
}

// ── API ───────────────────────────────────────────────────────────────
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  error?: string;
  total?: number;
  page?: number;
  limit?: number;
}
