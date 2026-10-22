import { ErrorRequestHandler } from "express";
import mongoose from "mongoose";
import { AppError } from "../shared/AppError";

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (typeof error === "object" && error !== null && "type" in error &&
    error.type === "entity.parse.failed") {
    res.status(400).json({ success: false, message: "Invalid JSON request body" });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      ...(error.errors ? { errors: error.errors } : {}),
    });
    return;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    res.status(422).json({ success: false, message: "Validation failed" });
    return;
  }

  if (error instanceof mongoose.Error.CastError) {
    res.status(400).json({ success: false, message: "Invalid resource id" });
    return;
  }

  if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
    res.status(409).json({ success: false, message: "A resource with this value already exists" });
    return;
  }

  console.error(error);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Internal server error" :
      error instanceof Error ? error.message : "Internal server error",
  });
};
