import { Response } from "express";
import { ZodError } from "zod";

export const sendSuccess = (res: Response, message: string, data: unknown, status = 200) =>
  res.status(status).json({ success: true, message, data });

export const sendValidationError = (res: Response, error: ZodError) => {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".") || "request";
    (errors[field] ??= []).push(issue.message);
  }
  return res.status(422).json({ success: false, message: "Validation failed", errors });
};

export const getPagination = (page: number, limit: number, total: number) => {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && total > 0,
  };
};

export const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const toDateRange = (from?: string, to?: string) => {
  if (!from && !to) return undefined;
  const range: { $gte?: Date; $lte?: Date } = {};
  if (from) range.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setUTCHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return range;
};
