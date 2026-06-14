import mongoose from "mongoose";
import { seedDevData } from "./seed"; 

import { User } from "../models/User";
import { Customer } from "../models/Customer";
import { Pet } from "../models/Pet";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { Campaign } from "../models/Campaign";
import { Communication } from "../models/Communication";
import { CommunicationEvent } from "../models/CommunicationEvent";

export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  mongoose.connection.on("connected", () => {
    console.log("MongoDB connection established.");
  });

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.log("MongoDB disconnected.");
  });

  if (uri) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log("MongoDB connected:", uri.split("@").pop());
      await syncAllIndexes();
      return;
    } catch (err) {
      console.error("Failed to connect to MongoDB Atlas on startup", err);
      process.exit(1);
    }
  }

  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const memServer = await MongoMemoryServer.create();
  await mongoose.connect(memServer.getUri());
  console.log("MongoDB in-memory server started (dev mode)");
  await syncAllIndexes();

  if (process.env.SEED_ON_START === "true" || !uri) {
    await seedDevData();
  }
}

async function syncAllIndexes() {
  console.log("Syncing MongoDB indexes...");
  try {
    await Promise.all([
      User.syncIndexes(),
      Customer.syncIndexes(),
      Pet.syncIndexes(),
      Product.syncIndexes(),
      Order.syncIndexes(),
      Campaign.syncIndexes(),
      Communication.syncIndexes(),
      CommunicationEvent.syncIndexes(),
    ]);
    console.log("MongoDB indexes synced.");
  } catch (err) {
    console.error("Failed to sync indexes:", err);
  }
}
