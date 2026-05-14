/**
 * Zod validation schemas for all API inputs.
 * All money values arrive as floats (INR) from the form and are
 * converted to integer paise before storage.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Group
// ─────────────────────────────────────────────────────────────────────────────

export const CreateGroupSchema = z.object({
  name: z.string().min(1, "Group name is required").max(100),
  currency: z.string().default("INR"),
});

export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Member
// ─────────────────────────────────────────────────────────────────────────────

export const AddMemberSchema = z.object({
  name: z.string().min(1, "Member name is required").max(100),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
});

export type AddMemberInput = z.infer<typeof AddMemberSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Expense splits
// ─────────────────────────────────────────────────────────────────────────────

const EqualSplitSchema = z.object({
  type: z.literal("EQUAL"),
  memberIds: z.array(z.string()).min(1, "At least one participant required"),
});

const PercentageSplitSchema = z.object({
  type: z.literal("PERCENTAGE"),
  splits: z
    .array(
      z.object({
        memberId: z.string(),
        percentage: z.number().min(0).max(100),
      })
    )
    .min(1)
    .refine(
      (splits) => {
        const total = splits.reduce((sum, s) => sum + s.percentage, 0);
        return Math.abs(total - 100) < 0.01; // allow tiny floating-point drift
      },
      { message: "Percentages must sum to 100%" }
    ),
});

const ExactSplitSchema = z.object({
  type: z.literal("EXACT"),
  splits: z
    .array(
      z.object({
        memberId: z.string(),
        amountInr: z.number().min(0, "Amount cannot be negative"),
      })
    )
    .min(1),
  // Cross-field validation happens in CreateExpenseSchema
});

// ─────────────────────────────────────────────────────────────────────────────
// Expense
// ─────────────────────────────────────────────────────────────────────────────

export const CreateExpenseSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200),
    amountInr: z.number().positive("Amount must be greater than zero"),
    paidById: z.string().min(1, "Payer is required"),
    date: z.string().optional(),
    category: z.string().optional(),
    notes: z.string().max(500).optional(),
    isRecurring: z.boolean().default(false),
    recurringPeriod: z.enum(["weekly", "monthly", "yearly"]).optional(),
    receiptUrl: z.string().url().optional().or(z.literal("")),
    split: z.discriminatedUnion("type", [
      EqualSplitSchema,
      PercentageSplitSchema,
      ExactSplitSchema,
    ]),
  })
  .refine(
    (data) => {
      if (data.split.type === "EXACT") {
        const total = data.split.splits.reduce(
          (sum, s) => sum + s.amountInr,
          0
        );
        return Math.abs(total - data.amountInr) < 0.005;
      }
      return true;
    },
    {
      message: "Exact split amounts must sum to the total expense amount",
      path: ["split"],
    }
  );

export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Settlement
// ─────────────────────────────────────────────────────────────────────────────

export const CreateSettlementSchema = z.object({
  fromMemberId: z.string().min(1),
  toMemberId: z.string().min(1),
  amountPaise: z.number().int().positive("Settlement amount must be positive"),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "UPI", "CARD", "OTHER"]).default("CASH"),
  paymentReference: z.string().max(200).optional(),
  proofUrl: z.string().url().optional().or(z.literal("")),
  note: z.string().max(200).optional(),
});

export type CreateSettlementInput = z.infer<typeof CreateSettlementSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Join group
// ─────────────────────────────────────────────────────────────────────────────

export const JoinGroupSchema = z.object({
  inviteCode: z.string().min(1, "Invite code is required").toUpperCase(),
});

export type JoinGroupInput = z.infer<typeof JoinGroupSchema>;
