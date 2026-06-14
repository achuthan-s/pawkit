import mongoose from "mongoose";

async function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export async function seedDevData() {
  const { User }     = await import("../models/User");
  const { Customer } = await import("../models/Customer");
  const { Pet }      = await import("../models/Pet");
  const { Product }  = await import("../models/Product");
  const { Order }    = await import("../models/Order");
  const bcrypt       = await import("bcryptjs");
  const { recomputeAll } = await import("../services/reorderClock");

  if (await User.findOne({ email: "customer@pawkit.dev" })) return;

  const hash = await (bcrypt.default || bcrypt).hash("password123", 10);

  // ── Users ──────────────────────────────────────────────────────────────
  const [rohanUser, priyaUser, arjunUser, kavyaUser, vikramUser, nehaUser,
         mktUser, opUser] = await User.insertMany([
    { name: "Rohan Mehta",    email: "customer@pawkit.dev",  password: hash, role: "customer" },
    { name: "Priya Verma",    email: "priya@example.com",    password: hash, role: "customer" },
    { name: "Arjun Kapoor",   email: "arjun@example.com",    password: hash, role: "customer" },
    { name: "Kavya Nair",     email: "kavya@example.com",    password: hash, role: "customer" },
    { name: "Vikram Sharma",  email: "vikram@example.com",   password: hash, role: "customer" },
    { name: "Neha Gupta",     email: "neha@example.com",     password: hash, role: "customer" },
    { name: "Maya Sharma",    email: "marketer@pawkit.dev",  password: hash, role: "marketer" },
    { name: "Admin User",     email: "operator@pawkit.dev",  password: hash, role: "operator" },
  ]);

  // ── Customers ──────────────────────────────────────────────────────────
  const [rohan, priya, arjun, kavya, vikram, neha] = await Customer.insertMany([
    {
      userId: rohanUser._id, phone: "+91 98765 43210",
      addresses: [{ label: "Home", street: "12 Park Street", city: "Mumbai", state: "Maharashtra", zip: "400001", country: "India", isDefault: true }],
      segment: "loyal", ltv: 12400, orderCount: 7, lastOrderAt: await daysAgo(8), tags: ["dog-owner", "premium"],
    },
    {
      userId: priyaUser._id, phone: "+91 99001 12345",
      addresses: [{ label: "Home", street: "45 Residency Road", city: "Bengaluru", state: "Karnataka", zip: "560025", country: "India", isDefault: true }],
      segment: "high-ltv", ltv: 28700, orderCount: 14, lastOrderAt: await daysAgo(3), tags: ["cat-owner", "premium", "subscriber"],
    },
    {
      userId: arjunUser._id, phone: "+91 97654 32100",
      addresses: [{ label: "Home", street: "7 Lajpat Nagar", city: "Delhi", state: "Delhi", zip: "110024", country: "India", isDefault: true }],
      segment: "growing", ltv: 7200, orderCount: 4, lastOrderAt: await daysAgo(22), tags: ["dog-owner", "cat-owner"],
    },
    {
      userId: kavyaUser._id, phone: "+91 91234 56789",
      addresses: [{ label: "Home", street: "22 MG Road", city: "Pune", state: "Maharashtra", zip: "411001", country: "India", isDefault: true }],
      segment: "at-risk", ltv: 3100, orderCount: 2, lastOrderAt: await daysAgo(62), tags: ["dog-owner"],
      channelOptIns: { whatsapp: true, sms: false, email: true, rcs: false },
    },
    {
      userId: vikramUser._id, phone: "+91 88888 77777",
      addresses: [{ label: "Home", street: "5 Anna Salai", city: "Chennai", state: "Tamil Nadu", zip: "600002", country: "India", isDefault: true }],
      segment: "new", ltv: 890, orderCount: 1, lastOrderAt: await daysAgo(45), tags: ["bird-owner"],
    },
    {
      userId: nehaUser._id, phone: "+91 77777 66666",
      addresses: [{ label: "Home", street: "99 Sector 18", city: "Noida", state: "Uttar Pradesh", zip: "201301", country: "India", isDefault: true }],
      segment: "inactive", ltv: 2250, orderCount: 3, lastOrderAt: await daysAgo(95), tags: ["rabbit-owner"],
      channelOptIns: { whatsapp: false, sms: false, email: true, rcs: false },
    },
  ]);

  // ── Pets ───────────────────────────────────────────────────────────────
  const [bruno, whiskers, max, luna, charlie, kiki, thumper] = await Pet.insertMany([
    {
      customerId: rohan._id, name: "Bruno", species: "dog", breed: "German Shepherd",
      gender: "male", dob: new Date("2021-03-15"), weight: 32, isNeutered: false,
      foodPreferences: { brand: "Royal Canin", dailyAmountGrams: 400, feedingsPerDay: 2 },
      vaccinations: [
        { name: "Rabies", administeredAt: new Date("2023-04-10"), nextDueAt: new Date("2024-04-10"), veterinarian: "Dr. Mehta Pet Clinic" },
        { name: "DHPPiL", administeredAt: new Date("2023-04-10"), nextDueAt: new Date("2024-04-10"), veterinarian: "Dr. Mehta Pet Clinic" },
      ],
    },
    {
      customerId: priya._id, name: "Whiskers", species: "cat", breed: "Persian",
      gender: "female", dob: new Date("2022-08-20"), weight: 4.2, isNeutered: true,
      foodPreferences: { brand: "Whiskas", dailyAmountGrams: 80, feedingsPerDay: 3 },
      vaccinations: [
        { name: "FVRCP", administeredAt: new Date("2023-09-05"), nextDueAt: new Date("2024-09-05") },
      ],
    },
    {
      customerId: arjun._id, name: "Max", species: "dog", breed: "Golden Retriever",
      gender: "male", dob: new Date("2019-06-01"), weight: 28, isNeutered: true,
      foodPreferences: { brand: "Drools", dailyAmountGrams: 350, feedingsPerDay: 2 },
      vaccinations: [
        { name: "Rabies", administeredAt: new Date("2024-01-15"), nextDueAt: new Date("2025-01-15") },
      ],
    },
    {
      customerId: arjun._id, name: "Luna", species: "cat", breed: "Siamese",
      gender: "female", dob: new Date("2023-02-14"), weight: 3.5, isNeutered: false,
      foodPreferences: { brand: "Me-O", dailyAmountGrams: 70, feedingsPerDay: 3 },
      vaccinations: [],
    },
    {
      customerId: kavya._id, name: "Charlie", species: "dog", breed: "Labrador Retriever",
      gender: "male", dob: new Date("2020-11-10"), weight: 30, isNeutered: false,
      foodPreferences: { brand: "Pedigree", dailyAmountGrams: 380, feedingsPerDay: 2 },
      vaccinations: [
        { name: "Rabies",  administeredAt: new Date("2023-12-01"), nextDueAt: new Date("2024-12-01") },
        { name: "DHPPiL",  administeredAt: new Date("2023-12-01"), nextDueAt: new Date("2024-12-01") },
      ],
    },
    {
      customerId: vikram._id, name: "Kiki", species: "bird", breed: "Indian Ringneck Parakeet",
      gender: "female", dob: new Date("2023-05-01"), weight: 0.12, isNeutered: false,
      foodPreferences: { brand: "Taiyo", dailyAmountGrams: 20, feedingsPerDay: 2 },
      vaccinations: [],
    },
    {
      customerId: neha._id, name: "Thumper", species: "rabbit", breed: "Holland Lop",
      gender: "male", dob: new Date("2022-01-20"), weight: 1.8, isNeutered: true,
      foodPreferences: { dailyAmountGrams: 150, feedingsPerDay: 2, dietaryNotes: "Hay-based diet, occasional veggies" },
      vaccinations: [],
    },
  ]);

  // Suppress unused-var warnings — pets are declared for reference clarity
  void [bruno, whiskers, max, luna, charlie, kiki, thumper];

  // ── Products ───────────────────────────────────────────────────────────
  const products = await Product.insertMany([
    {
      name: "Royal Canin Medium Adult Dog Food",
      brand: "Royal Canin", category: "dog-food", subcategory: "Dry Food", targetSpecies: ["dog"],
      description: "Complete balanced nutrition for medium-sized adult dogs aged 1–7 years. Supports optimal weight and digestive health.",
      basePrice: 1850,
      sizes: [
        { label: "3 kg",  price: 1850, inventory: 48, sku: "RC-MED-3KG"  },
        { label: "10 kg", price: 5400, inventory: 22, sku: "RC-MED-10KG" },
        { label: "15 kg", price: 7800, inventory: 10, sku: "RC-MED-15KG" },
      ],
      images: ["https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?auto=format&fit=crop&w=800&q=80"],
      features: ["High protein formula", "Supports joint health", "Promotes healthy coat"],
      tags: ["dog-food", "adult", "medium-breed", "royal-canin"],
      nutritionalInfo: { protein: 25, fat: 14, fibre: 2.9, moisture: 8, calories: 362 },
      ratings: { average: 4.6, count: 312 }, isFeatured: true, active: true,
    },
    {
      name: "Whiskas Ocean Fish Adult Cat Food",
      brand: "Whiskas", category: "cat-food", subcategory: "Dry Food", targetSpecies: ["cat"],
      description: "Complete nutrition for adult cats with real ocean fish. Supports urinary tract health and shiny coat.",
      basePrice: 945,
      sizes: [
        { label: "3 kg",  price: 945,  inventory: 60, sku: "WKS-OCF-3KG" },
        { label: "7 kg",  price: 1990, inventory: 30, sku: "WKS-OCF-7KG" },
      ],
      images: ["https://images.unsplash.com/photo-1606092195730-5d7b9af1efc5?auto=format&fit=crop&w=800&q=80"],
      features: ["Real ocean fish", "Taurine for heart health", "Vitamin E for immunity"],
      tags: ["cat-food", "adult", "fish", "whiskas"],
      nutritionalInfo: { protein: 30, fat: 11, fibre: 2.5, moisture: 10, calories: 340 },
      ratings: { average: 4.3, count: 218 }, isFeatured: true, active: true,
    },
    {
      name: "Drools Focus Puppy Super Premium Dog Food",
      brand: "Drools", category: "dog-food", subcategory: "Puppy", targetSpecies: ["dog"],
      description: "High-protein formula crafted for growing puppies. DHA for brain development and prebiotics for gut health.",
      basePrice: 1200,
      sizes: [
        { label: "3 kg",  price: 1200, inventory: 35, sku: "DR-PUP-3KG"  },
        { label: "7 kg",  price: 2600, inventory: 18, sku: "DR-PUP-7KG"  },
        { label: "12 kg", price: 4200, inventory: 8,  sku: "DR-PUP-12KG" },
      ],
      images: ["https://images.unsplash.com/photo-1601758003122-53c40e686a19?auto=format&fit=crop&w=800&q=80"],
      features: ["30% real chicken", "DHA for brain development", "No artificial colours"],
      tags: ["dog-food", "puppy", "drools", "premium"],
      nutritionalInfo: { protein: 30, fat: 15, fibre: 3.5, moisture: 9, calories: 380 },
      ratings: { average: 4.5, count: 187 }, isFeatured: false, active: true,
    },
    {
      name: "Me-O Tuna & Sardine Adult Cat Food",
      brand: "Me-O", category: "cat-food", subcategory: "Dry Food", targetSpecies: ["cat"],
      description: "Delicious tuna & sardine dry food for adult cats. Omega-3 fatty acids for healthy skin and coat.",
      basePrice: 520,
      sizes: [
        { label: "1.1 kg", price: 520,  inventory: 55, sku: "MEO-TS-1KG" },
        { label: "3.5 kg", price: 1450, inventory: 28, sku: "MEO-TS-3KG" },
        { label: "7 kg",   price: 2600, inventory: 12, sku: "MEO-TS-7KG" },
      ],
      images: ["https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80"],
      features: ["Real tuna & sardine", "High taurine content", "Hairball control formula"],
      tags: ["cat-food", "adult", "fish", "me-o", "tuna"],
      nutritionalInfo: { protein: 28, fat: 12, fibre: 2, moisture: 10, calories: 330 },
      ratings: { average: 4.1, count: 145 }, isFeatured: false, active: true,
    },
    {
      name: "Pedigree DentaStix Daily Oral Care",
      brand: "Pedigree", category: "treats", subcategory: "Dental", targetSpecies: ["dog"],
      description: "X-shaped treats that clean your dog's teeth while they chew. Reduces tartar build-up by up to 80%.",
      basePrice: 150,
      sizes: [
        { label: "7 sticks",  price: 150, inventory: 120, sku: "PDG-DX-7S"  },
        { label: "28 sticks", price: 480, inventory: 65,  sku: "PDG-DX-28S" },
      ],
      images: ["https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=800&q=80"],
      features: ["Reduces tartar 80%", "Cleans between teeth", "Low fat treat"],
      tags: ["treats", "dental", "dog", "pedigree"],
      ratings: { average: 4.4, count: 425 }, isFeatured: true, active: true,
    },
    {
      name: "Himalaya Erina Coat Conditioning Dog Shampoo",
      brand: "Himalaya", category: "grooming", targetSpecies: ["dog"],
      description: "Herbal shampoo with neem and aloe vera. Conditions coat and controls ticks, fleas, and lice.",
      basePrice: 175,
      sizes: [
        { label: "200 ml", price: 175, inventory: 80, sku: "HIM-ERN-200" },
        { label: "400 ml", price: 290, inventory: 45, sku: "HIM-ERN-400" },
      ],
      images: ["https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=800&q=80"],
      features: ["Neem & aloe vera", "Anti-tick & flea", "pH balanced for dogs"],
      tags: ["shampoo", "grooming", "dog", "himalaya", "herbal"],
      ratings: { average: 4.2, count: 289 }, isFeatured: false, active: true,
    },
    {
      name: "NutriVet Hip & Joint Supplement for Dogs",
      brand: "NutriVet", category: "supplements", subcategory: "Joint Care", targetSpecies: ["dog"],
      description: "Glucosamine & chondroitin chewable tablets for joint health. Ideal for aging or large-breed dogs.",
      basePrice: 980,
      sizes: [
        { label: "60 chews",  price: 980,  inventory: 40, sku: "NV-HJ-60"  },
        { label: "150 chews", price: 2100, inventory: 20, sku: "NV-HJ-150" },
      ],
      images: ["https://images.unsplash.com/photo-1584362917165-526a968579e8?auto=format&fit=crop&w=800&q=80"],
      features: ["Glucosamine 500mg", "Chondroitin 400mg", "Bacon flavour chews"],
      tags: ["supplements", "joint", "senior", "dog", "nutrivet"],
      ratings: { average: 4.5, count: 112 }, isFeatured: false, active: true,
    },
    {
      name: "KONG Classic Dog Toy",
      brand: "KONG", category: "accessories", targetSpecies: ["dog"],
      description: "Natural rubber chew toy that can be stuffed with treats. Ideal for aggressive chewers and mental stimulation.",
      basePrice: 780,
      sizes: [
        { label: "Small (up to 9 kg)",  price: 780,  inventory: 30, sku: "KONG-SM" },
        { label: "Large (18–30 kg)",    price: 1200, inventory: 20, sku: "KONG-LG" },
      ],
      images: ["https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=800&q=80"],
      features: ["Natural rubber", "Dishwasher safe", "Bounces unpredictably"],
      tags: ["toy", "chew", "kong", "dog", "accessories"],
      ratings: { average: 4.7, count: 534 }, isFeatured: true, active: true,
    },
    {
      name: "Beaphar Kitty's Best Senior Cat Food",
      brand: "Beaphar", category: "cat-food", subcategory: "Senior", targetSpecies: ["cat"],
      description: "Specially formulated for cats aged 8+. Reduced phosphorus to support kidney health, with L-carnitine.",
      basePrice: 1100,
      sizes: [
        { label: "2 kg", price: 1100, inventory: 25, sku: "BEA-SEN-2KG" },
        { label: "4 kg", price: 1950, inventory: 12, sku: "BEA-SEN-4KG" },
      ],
      images: ["https://images.unsplash.com/photo-1615796153287-98eacf0abb13?auto=format&fit=crop&w=800&q=80"],
      features: ["Low phosphorus formula", "L-carnitine for metabolism", "Omega-3 & 6"],
      tags: ["cat-food", "senior", "kidney", "beaphar"],
      nutritionalInfo: { protein: 26, fat: 10, fibre: 3, moisture: 10, calories: 310 },
      ratings: { average: 4.3, count: 78 }, isFeatured: false, active: true,
    },
    {
      name: "Trixie Scratching Post with Platform",
      brand: "Trixie", category: "accessories", targetSpecies: ["cat"],
      description: "Sisal scratching post with elevated platform and dangling toy. Keeps cats entertained and claws healthy.",
      basePrice: 890,
      sizes: [
        { label: "Standard (45 cm)", price: 890,  inventory: 22, sku: "TRX-SP-45" },
        { label: "Tall (65 cm)",     price: 1350, inventory: 10, sku: "TRX-SP-65" },
      ],
      images: ["https://images.unsplash.com/photo-1574144113084-b6f450cc5fca?auto=format&fit=crop&w=800&q=80"],
      features: ["Natural sisal rope", "Stable weighted base", "Includes hanging toy"],
      tags: ["cat", "scratching-post", "toy", "trixie", "accessories"],
      ratings: { average: 4.0, count: 96 }, isFeatured: false, active: true,
    },
  ]);

  const [rcMedium, whiskasCat, droolsPuppy, meoCat, dentastix, himalayaShampoo,
         nutrivet, kong, beaphar, trixie] = products;

  // ── Additional products (no orders reference these) ────────────────────
  await Product.insertMany([
    {
      name: "Pedigree Adult Dry Dog Food Chicken & Vegetables",
      brand: "Pedigree", category: "dog-food", subcategory: "Dry Food", targetSpecies: ["dog"],
      description: "Complete nutrition for adult dogs with real chicken and vegetables. Supports strong bones, healthy digestion and a shiny coat.",
      basePrice: 780,
      sizes: [
        { label: "1.5 kg", price: 780,  inventory: 55, sku: "PDG-AD-1KG"  },
        { label: "3 kg",   price: 1350, inventory: 38, sku: "PDG-AD-3KG"  },
        { label: "6 kg",   price: 2450, inventory: 20, sku: "PDG-AD-6KG"  },
        { label: "10 kg",  price: 3800, inventory: 12, sku: "PDG-AD-10KG" },
      ],
      images: ["https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?auto=format&fit=crop&w=800&q=80"],
      features: ["Real chicken & vegetables", "18 vitamins & minerals", "Supports healthy digestion", "Strengthens bones & teeth"],
      tags: ["dog-food", "adult", "pedigree", "chicken"],
      nutritionalInfo: { protein: 21, fat: 10, fibre: 3.5, moisture: 10, calories: 340 },
      ratings: { average: 4.2, count: 520 }, isFeatured: true, active: true,
    },
    {
      name: "Purina SuperCoat Adult Dog Food",
      brand: "Purina", category: "dog-food", subcategory: "Dry Food", targetSpecies: ["dog"],
      description: "Scientifically formulated with real chicken, antioxidants and DHA for adult dogs. Promotes strong immunity and lustrous coat.",
      basePrice: 1050,
      sizes: [
        { label: "3 kg",  price: 1050, inventory: 40, sku: "PUR-SC-3KG"  },
        { label: "6.5 kg",price: 2050, inventory: 22, sku: "PUR-SC-6KG"  },
        { label: "10 kg", price: 3100, inventory: 14, sku: "PUR-SC-10KG" },
      ],
      images: ["https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=800&q=80"],
      features: ["Real chicken #1 ingredient", "Antioxidant blend", "DHA for brain & eyes", "No artificial colours"],
      tags: ["dog-food", "adult", "purina", "premium"],
      nutritionalInfo: { protein: 22, fat: 12, fibre: 3, moisture: 10, calories: 355 },
      ratings: { average: 4.3, count: 295 }, isFeatured: false, active: true,
    },
    {
      name: "Royal Canin Maxi Breed Puppy Dog Food",
      brand: "Royal Canin", category: "dog-food", subcategory: "Puppy", targetSpecies: ["dog"],
      description: "Tailored nutrition for large breed puppies (26–44 kg adult) up to 15 months old. Supports bone & joint development.",
      basePrice: 2200,
      sizes: [
        { label: "4 kg",  price: 2200, inventory: 28, sku: "RC-MXP-4KG"  },
        { label: "10 kg", price: 5200, inventory: 14, sku: "RC-MXP-10KG" },
        { label: "15 kg", price: 7600, inventory: 8,  sku: "RC-MXP-15KG" },
      ],
      images: ["https://images.unsplash.com/photo-1601758003122-53c40e686a19?auto=format&fit=crop&w=800&q=80"],
      features: ["Large breed formula", "Optimal calcium:phosphorus", "EPA & DHA for immunity", "Promotes lean muscle"],
      tags: ["dog-food", "puppy", "large-breed", "royal-canin"],
      nutritionalInfo: { protein: 28, fat: 16, fibre: 2.8, moisture: 8, calories: 375 },
      ratings: { average: 4.7, count: 183 }, isFeatured: true, active: true,
    },
    {
      name: "Hill's Science Diet Adult Hairball Control Cat Food",
      brand: "Hill's", category: "cat-food", subcategory: "Dry Food", targetSpecies: ["cat"],
      description: "Clinically proven antioxidants with natural fibre system to minimize hairball formation in indoor adult cats.",
      basePrice: 1380,
      sizes: [
        { label: "1.58 kg", price: 1380, inventory: 32, sku: "HLS-HB-1KG" },
        { label: "3.17 kg", price: 2550, inventory: 18, sku: "HLS-HB-3KG" },
        { label: "7.03 kg", price: 5200, inventory: 8,  sku: "HLS-HB-7KG" },
      ],
      images: ["https://images.unsplash.com/photo-1606092195730-5d7b9af1efc5?auto=format&fit=crop&w=800&q=80"],
      features: ["Hairball reduction", "Natural fibre blend", "Clinically proven antioxidants", "Healthy skin & coat"],
      tags: ["cat-food", "hairball", "indoor", "hills", "adult"],
      nutritionalInfo: { protein: 29, fat: 12, fibre: 5.5, moisture: 9, calories: 325 },
      ratings: { average: 4.4, count: 156 }, isFeatured: false, active: true,
    },
    {
      name: "Drools Adult Dry Cat Food Salmon & Tuna",
      brand: "Drools", category: "cat-food", subcategory: "Dry Food", targetSpecies: ["cat"],
      description: "High-protein adult cat food with real salmon and tuna. Omega-3 & 6 for a lustrous coat and healthy skin.",
      basePrice: 640,
      sizes: [
        { label: "1 kg",  price: 640,  inventory: 50, sku: "DR-CT-1KG" },
        { label: "3 kg",  price: 1700, inventory: 28, sku: "DR-CT-3KG" },
        { label: "7 kg",  price: 3600, inventory: 12, sku: "DR-CT-7KG" },
      ],
      images: ["https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80"],
      features: ["Real salmon & tuna", "Omega-3 & 6 enriched", "No artificial preservatives", "Supports urinary health"],
      tags: ["cat-food", "adult", "drools", "salmon", "tuna"],
      nutritionalInfo: { protein: 32, fat: 13, fibre: 2, moisture: 10, calories: 345 },
      ratings: { average: 4.1, count: 98 }, isFeatured: false, active: true,
    },
    {
      name: "Inaba Churu Lickable Puree Cat Treats",
      brand: "Inaba", category: "treats", subcategory: "Cat Treats", targetSpecies: ["cat"],
      description: "Irresistible lickable puree treats made with real tuna. Low calorie, hydrating, and perfect for bonding time.",
      basePrice: 350,
      sizes: [
        { label: "4 tubes (56 g)", price: 350,  inventory: 80, sku: "INB-CHR-4T"  },
        { label: "10 tubes (140 g)", price: 750, inventory: 45, sku: "INB-CHR-10T" },
      ],
      images: ["https://images.unsplash.com/photo-1612613977726-5afba41f8dcb?auto=format&fit=crop&w=800&q=80"],
      features: ["Real tuna puree", "No grain, preservatives", "Low calorie (<3 kcal/tube)", "Hydrating formula"],
      tags: ["treats", "cat", "lickable", "tuna", "inaba"],
      ratings: { average: 4.8, count: 612 }, isFeatured: true, active: true,
    },
    {
      name: "Milk-Bone Original Dog Biscuits",
      brand: "Milk-Bone", category: "treats", subcategory: "Dog Treats", targetSpecies: ["dog"],
      description: "Classic crunchy biscuits with 12 essential vitamins and minerals. A wholesome snack for dogs of all sizes.",
      basePrice: 220,
      sizes: [
        { label: "200 g",  price: 220,  inventory: 95, sku: "MLK-OR-200G"  },
        { label: "450 g",  price: 420,  inventory: 60, sku: "MLK-OR-450G"  },
        { label: "900 g",  price: 750,  inventory: 35, sku: "MLK-OR-900G"  },
      ],
      images: ["https://images.unsplash.com/photo-1601758124510-52d02ddb7cbd?auto=format&fit=crop&w=800&q=80"],
      features: ["12 vitamins & minerals", "Promotes clean teeth", "No artificial flavours", "Loved by all breeds"],
      tags: ["treats", "biscuits", "dog", "milk-bone", "classic"],
      ratings: { average: 4.3, count: 348 }, isFeatured: false, active: true,
    },
    {
      name: "Taiyo Parrot & Budgie Seed Mix",
      brand: "Taiyo", category: "other", targetSpecies: ["bird"],
      description: "Balanced mix of millets, canary seeds and sunflower seeds for parrots, budgerigars and cockatiels. Fortified with vitamins.",
      basePrice: 180,
      sizes: [
        { label: "400 g", price: 180,  inventory: 60, sku: "TAI-PBS-400G" },
        { label: "1 kg",  price: 380,  inventory: 35, sku: "TAI-PBS-1KG"  },
      ],
      images: ["https://images.unsplash.com/photo-1452570053594-1b985d6ea890?auto=format&fit=crop&w=800&q=80"],
      features: ["6 seed varieties", "Vitamin-fortified", "No artificial colour", "Supports feather health"],
      tags: ["bird", "parrot", "budgie", "seed", "taiyo"],
      ratings: { average: 4.2, count: 142 }, isFeatured: false, active: true,
    },
    {
      name: "Oxbow Bunny Basics Rabbit Pellets",
      brand: "Oxbow", category: "other", targetSpecies: ["rabbit"],
      description: "Timothy hay-based pellets for adult rabbits. High fibre, stabilised vitamins and no added sugars or artificial preservatives.",
      basePrice: 850,
      sizes: [
        { label: "1.13 kg", price: 850,  inventory: 40, sku: "OXB-BB-1KG" },
        { label: "2.27 kg", price: 1550, inventory: 20, sku: "OXB-BB-2KG" },
      ],
      images: ["https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?auto=format&fit=crop&w=800&q=80"],
      features: ["Timothy hay-based", "High fibre (25%)", "No added sugars", "Stabilised vitamins"],
      tags: ["rabbit", "pellets", "oxbow", "timothy", "adult"],
      ratings: { average: 4.6, count: 89 }, isFeatured: false, active: true,
    },
    {
      name: "Ruffwear Front Range Dog Harness",
      brand: "Ruffwear", category: "accessories", targetSpecies: ["dog"],
      description: "Everyday harness with two leash attachment points and padded chest & belly panel. Easy on-off with four points of adjustment.",
      basePrice: 3200,
      sizes: [
        { label: "XS (33–43 cm)",  price: 3200, inventory: 18, sku: "RFW-FR-XS" },
        { label: "S (43–56 cm)",   price: 3200, inventory: 25, sku: "RFW-FR-SM" },
        { label: "M (56–69 cm)",   price: 3400, inventory: 20, sku: "RFW-FR-MD" },
        { label: "L (69–81 cm)",   price: 3600, inventory: 14, sku: "RFW-FR-LG" },
      ],
      images: ["https://images.unsplash.com/photo-1567014543648-e4391c989aab?auto=format&fit=crop&w=800&q=80"],
      features: ["Two leash points", "Padded chest panel", "ID tag pocket", "Reflective trim"],
      tags: ["harness", "accessories", "dog", "ruffwear", "outdoor"],
      ratings: { average: 4.7, count: 241 }, isFeatured: true, active: true,
    },
    {
      name: "Petkit Eversweet Smart Pet Water Fountain",
      brand: "Petkit", category: "accessories", targetSpecies: ["all"],
      description: "2L circulating water fountain with triple filtration, LED indicator and ultra-quiet pump. Keeps water fresh 24/7.",
      basePrice: 2499,
      sizes: [
        { label: "2 L", price: 2499, inventory: 22, sku: "PKT-EW-2L" },
      ],
      images: ["https://images.unsplash.com/photo-1551334787-21e6bd3ab135?auto=format&fit=crop&w=800&q=80"],
      features: ["Triple filtration", "Ultra-quiet pump", "LED water indicator", "BPA-free food-grade material"],
      tags: ["fountain", "water", "accessories", "petkit", "all"],
      ratings: { average: 4.4, count: 178 }, isFeatured: false, active: true,
    },
    {
      name: "Himalaya Immunol Dog Supplement",
      brand: "Himalaya", category: "supplements", subcategory: "Immunity", targetSpecies: ["dog"],
      description: "Ayurvedic immunity booster with Ashwagandha, Shatavari and Amalaki. Strengthens natural defence and reduces fatigue.",
      basePrice: 320,
      sizes: [
        { label: "60 tablets",  price: 320,  inventory: 50, sku: "HIM-IMM-60"  },
        { label: "200 tablets", price: 920,  inventory: 25, sku: "HIM-IMM-200" },
      ],
      images: ["https://images.unsplash.com/photo-1584362917165-526a968579e8?auto=format&fit=crop&w=800&q=80"],
      features: ["Ashwagandha & Shatavari", "Boosts natural immunity", "No steroids or chemicals", "Suitable for all breeds"],
      tags: ["supplements", "immunity", "ayurvedic", "himalaya", "dog"],
      ratings: { average: 4.1, count: 134 }, isFeatured: false, active: true,
    },
    {
      name: "TropiClean Fresh Breath Dental Health Solution",
      brand: "TropiClean", category: "health", subcategory: "Dental Care", targetSpecies: ["dog", "cat"],
      description: "Add to water to clean teeth, freshen breath and prevent tartar. No brushing needed. Safe for dogs and cats.",
      basePrice: 680,
      sizes: [
        { label: "473 ml", price: 680,  inventory: 45, sku: "TRP-FB-473" },
        { label: "946 ml", price: 1150, inventory: 22, sku: "TRP-FB-946" },
      ],
      images: ["https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=800&q=80"],
      features: ["No brushing needed", "Eliminates bad breath", "Prevents tartar build-up", "Vet recommended"],
      tags: ["dental", "health", "tropicleam", "dog", "cat", "breath"],
      ratings: { average: 4.3, count: 207 }, isFeatured: false, active: true,
    },
    // ── Wet Food (dog) ────────────────────────────────────────────────────
    {
      name: "Pedigree Adult Wet Dog Food – Chicken in Gravy",
      brand: "Pedigree", category: "dog-food", subcategory: "Wet Food", targetSpecies: ["dog"],
      description: "Tender chicken chunks in a rich, flavoursome gravy. Perfectly balanced for adult dogs with essential vitamins and minerals.",
      basePrice: 90,
      sizes: [
        { label: "70 g pouch",    price: 90,  inventory: 200, sku: "PDG-WET-70"  },
        { label: "12-pack (70 g)", price: 999, inventory: 80,  sku: "PDG-WET-12P" },
      ],
      images: ["https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80"],
      features: ["Real chicken", "Rich gravy", "No artificial colours", "Essential vitamins"],
      tags: ["wet food", "dog", "pedigree", "gravy", "chicken"],
      ratings: { average: 4.2, count: 312 }, isFeatured: false, active: true,
    },
    // ── Wet Food (cat) ────────────────────────────────────────────────────
    {
      name: "Whiskas Adult Wet Cat Food – Tuna in Jelly",
      brand: "Whiskas", category: "cat-food", subcategory: "Wet Food", targetSpecies: ["cat"],
      description: "Tender tuna pieces in a light, savoury jelly that cats love. Each pouch is a complete meal packed with moisture to support hydration.",
      basePrice: 75,
      sizes: [
        { label: "85 g pouch",     price: 75,  inventory: 250, sku: "WSK-WET-85"  },
        { label: "12-pack (85 g)", price: 849, inventory: 90,  sku: "WSK-WET-12P" },
      ],
      images: ["https://images.unsplash.com/photo-1574169208507-84376144848b?auto=format&fit=crop&w=800&q=80"],
      features: ["Real tuna", "Light jelly", "Supports hydration", "Grain free"],
      tags: ["wet food", "cat", "whiskas", "tuna", "jelly"],
      ratings: { average: 4.4, count: 528 }, isFeatured: true, active: true,
    },
    {
      name: "Royal Canin Instinctive Wet Cat Food",
      brand: "Royal Canin", category: "cat-food", subcategory: "Wet Food", targetSpecies: ["cat"],
      description: "Scientifically formulated wet food that meets the natural instincts of adult cats. High moisture content with a palatability cats cannot resist.",
      basePrice: 120,
      sizes: [
        { label: "85 g pouch",     price: 120,  inventory: 160, sku: "RC-INST-85"  },
        { label: "12-pack (85 g)", price: 1350, inventory: 55,  sku: "RC-INST-12P" },
      ],
      images: ["https://images.unsplash.com/photo-1585846416120-3a7354ed7d39?auto=format&fit=crop&w=800&q=80"],
      features: ["Highly palatable", "High moisture", "Digestive support", "Vet recommended"],
      tags: ["wet food", "cat", "royal canin", "instinctive", "premium"],
      ratings: { average: 4.6, count: 284 }, isFeatured: true, active: true,
    },
  ]);

  // ── Orders ─────────────────────────────────────────────────────────────
  const addr = (c: typeof rohan) => ({
    street: c.addresses[0].street, city: c.addresses[0].city,
    state: c.addresses[0].state,   zip: c.addresses[0].zip,
    country: "India",
  });

  const makeItem = (p: (typeof products)[0], size: number, qty: number) => ({
    product: p._id,
    productName: p.name,
    productImage: "",
    selectedSize: p.sizes[size].label,
    quantity: qty,
    unitPrice: p.sizes[size].price,
    totalPrice: p.sizes[size].price * qty,
  });

  const sub = (items: ReturnType<typeof makeItem>[]) => items.reduce((a, i) => a + i.totalPrice, 0);

  const ordersData = [
    // Rohan — delivered
    {
      customer: rohan._id, status: "delivered", paymentMethod: "upi", paymentStatus: "paid",
      shippingAddress: addr(rohan), createdAt: await daysAgo(45),
      items: [makeItem(rcMedium, 0, 1), makeItem(dentastix, 1, 2)],
      deliveryFee: 40, discount: 0,
    },
    {
      customer: rohan._id, status: "delivered", paymentMethod: "upi", paymentStatus: "paid",
      shippingAddress: addr(rohan), createdAt: await daysAgo(22),
      items: [makeItem(rcMedium, 1, 1), makeItem(himalayaShampoo, 1, 1)],
      deliveryFee: 40, discount: 200,
    },
    {
      customer: rohan._id, status: "shipped", paymentMethod: "card", paymentStatus: "paid",
      shippingAddress: addr(rohan), createdAt: await daysAgo(8),
      items: [makeItem(rcMedium, 0, 2)],
      deliveryFee: 0, discount: 0,
    },
    // Priya — high-LTV, multiple orders
    {
      customer: priya._id, status: "delivered", paymentMethod: "upi", paymentStatus: "paid",
      shippingAddress: addr(priya), createdAt: await daysAgo(60),
      items: [makeItem(whiskasCat, 1, 1), makeItem(trixie, 0, 1)],
      deliveryFee: 40, discount: 0,
    },
    {
      customer: priya._id, status: "delivered", paymentMethod: "upi", paymentStatus: "paid",
      shippingAddress: addr(priya), createdAt: await daysAgo(30),
      items: [makeItem(whiskasCat, 0, 2), makeItem(beaphar, 0, 1)],
      deliveryFee: 40, discount: 100,
    },
    {
      customer: priya._id, status: "delivered", paymentMethod: "upi", paymentStatus: "paid",
      shippingAddress: addr(priya), createdAt: await daysAgo(15),
      items: [makeItem(meoCat, 1, 1)],
      deliveryFee: 40, discount: 0,
    },
    {
      customer: priya._id, status: "confirmed", paymentMethod: "upi", paymentStatus: "paid",
      shippingAddress: addr(priya), createdAt: await daysAgo(3),
      items: [makeItem(whiskasCat, 1, 2), makeItem(trixie, 1, 1)],
      deliveryFee: 0, discount: 300,
    },
    // Arjun — growing
    {
      customer: arjun._id, status: "delivered", paymentMethod: "cod", paymentStatus: "paid",
      shippingAddress: addr(arjun), createdAt: await daysAgo(50),
      items: [makeItem(droolsPuppy, 0, 1), makeItem(kong, 0, 1)],
      deliveryFee: 40, discount: 0,
    },
    {
      customer: arjun._id, status: "pending", paymentMethod: "upi", paymentStatus: "pending",
      shippingAddress: addr(arjun), createdAt: await daysAgo(22),
      items: [makeItem(droolsPuppy, 1, 1), makeItem(meoCat, 0, 2)],
      deliveryFee: 40, discount: 0,
    },
    // Kavya — at-risk
    {
      customer: kavya._id, status: "delivered", paymentMethod: "card", paymentStatus: "paid",
      shippingAddress: addr(kavya), createdAt: await daysAgo(80),
      items: [makeItem(dentastix, 1, 1), makeItem(himalayaShampoo, 0, 2)],
      deliveryFee: 40, discount: 0,
    },
    {
      customer: kavya._id, status: "cancelled", paymentMethod: "upi", paymentStatus: "refunded",
      shippingAddress: addr(kavya), createdAt: await daysAgo(62),
      items: [makeItem(nutrivet, 0, 1)],
      deliveryFee: 40, discount: 0,
    },
    // Vikram — new
    {
      customer: vikram._id, status: "delivered", paymentMethod: "upi", paymentStatus: "paid",
      shippingAddress: addr(vikram), createdAt: await daysAgo(45),
      items: [makeItem(kong, 0, 1)],
      deliveryFee: 40, discount: 0,
    },
    // Neha — inactive
    {
      customer: neha._id, status: "delivered", paymentMethod: "cod", paymentStatus: "paid",
      shippingAddress: addr(neha), createdAt: await daysAgo(110),
      items: [makeItem(nutrivet, 0, 2)],
      deliveryFee: 40, discount: 0,
    },
    {
      customer: neha._id, status: "delivered", paymentMethod: "upi", paymentStatus: "paid",
      shippingAddress: addr(neha), createdAt: await daysAgo(95),
      items: [makeItem(dentastix, 0, 3)],
      deliveryFee: 40, discount: 0,
    },
  ];

  for (const o of ordersData) {
    const subtotal = sub(o.items as ReturnType<typeof makeItem>[]);
    const total    = subtotal + o.deliveryFee - o.discount;
    await Order.create({ ...o, subtotal, total });
  }

  // Compute reorder clocks for all seeded customers
  const clockResult = await recomputeAll();
  console.log(`  reorder clock: ${clockResult.processed} computed, ${clockResult.errors} errors`);

  console.log("\n─── Dev seed complete ───────────────────────────────");
  console.log("  customer@pawkit.dev  / password123  (Rohan Mehta)");
  console.log("  marketer@pawkit.dev  / password123  (Maya Sharma)");
  console.log("  operator@pawkit.dev  / password123  (Admin User)");
  console.log("  26 products · 6 customers · 7 pets · 14 orders");
  console.log("────────────────────────────────────────────────────\n");
}

if (require.main === module) {
  (async () => {
    require("dotenv").config();
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error("MONGODB_URI is required to run seed script standalone");
      process.exit(1);
    }
    try {
      await mongoose.connect(uri);
      console.log("Connected to MongoDB for seeding...");
      await seedDevData();
      console.log("Seeding finished.");
      process.exit(0);
    } catch (err) {
      console.error("Error during seeding:", err);
      process.exit(1);
    }
  })();
}
