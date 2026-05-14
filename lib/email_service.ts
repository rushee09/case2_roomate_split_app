/**
 * Email notification service — settlement flow.
 *
 * For MVP, emails are logged to console and stored in the database as
 * status "mock_sent". To use a real provider (Resend, SendGrid, Postmark),
 * set SMTP_* env vars and swap the sendEmail implementation below.
 */

import { db } from "@/lib/db";

interface SettlementEmailPayload {
  recipientEmail: string;
  recipientName: string;
  payerName: string;
  receiverName: string;
  amount: string;
  currency: string;
  paymentMethod: string;
  groupName: string;
  settlementId: string;
  requiresConfirmation: boolean;
}

export async function sendSettlementNotification(
  payload: SettlementEmailPayload
): Promise<void> {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Pocket";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const subject = `${appName} settlement recorded: ${payload.amount} via ${formatMethod(payload.paymentMethod)}`;

  const body = payload.requiresConfirmation
    ? `${payload.recipientName}, ${payload.payerName} says they paid you ${payload.amount} via ${formatMethod(payload.paymentMethod)} in ${payload.groupName}. Please open ${appName} to confirm or reject this settlement. ${appUrl}/groups`
    : `${payload.payerName} recorded a payment of ${payload.amount} to ${payload.receiverName} using ${formatMethod(payload.paymentMethod)} in ${payload.groupName}. Please open ${appName} to view details. ${appUrl}/groups`;

  // Log to console (dev mode)
  console.log("\n[EMAIL NOTIFICATION - mock_sent]");
  console.log(`To: ${payload.recipientEmail}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body: ${body}\n`);

  // Store in database as queued/mock_sent for audit trail
  // Using Activity model to avoid a separate EmailLog model for MVP
  try {
    await db.activity.create({
      data: {
        groupId: "email-queue", // virtual group for email log
        type: "EMAIL_NOTIFICATION",
        data: JSON.stringify({
          status: "mock_sent",
          to: payload.recipientEmail,
          subject,
          body,
          settlementId: payload.settlementId,
          sentAt: new Date().toISOString(),
        }),
      },
    });
  } catch {
    // Email logging failure should not block the main flow
    console.warn("[email_service] Failed to log email notification to DB");
  }
}

function formatMethod(method: string): string {
  const map: Record<string, string> = {
    CASH: "Cash",
    BANK_TRANSFER: "Bank Transfer",
    UPI: "UPI",
    CARD: "Card",
    OTHER: "Other",
  };
  return map[method] ?? method;
}
