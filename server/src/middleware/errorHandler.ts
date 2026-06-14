import type { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: Error & { code?: number; name?: string },
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error(err.stack);

  // Mongoose CastError — malformed ObjectId in URL param
  if (err.name === "CastError") {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  // Mongoose ValidationError — schema constraint violation
  if (err.name === "ValidationError") {
    return res.status(422).json({ error: err.message });
  }

  // MongoDB duplicate key (e.g. unique email)
  if (err.code === 11000) {
    return res.status(409).json({ error: "Duplicate entry" });
  }

  res.status(500).json({ error: err.message ?? "Internal server error" });
}
