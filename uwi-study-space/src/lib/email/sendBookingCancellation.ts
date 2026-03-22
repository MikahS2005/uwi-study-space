// src/lib/email/sendBookingCancellation.ts
import { getResend, getEmailFrom, getAppBaseUrl } from "@/lib/email/resend";
import { renderEmailShell } from "@/lib/email/templates/base";
import { resolveEmailRecipient } from "@/lib/email/testing";

type BookingCancellationInput = {
  to: string;
  recipientName?: string | null;
  roomName: string;
  building?: string | null;
  startLabel: string;
  endLabel: string;
  reason?: string | null;
};

export async function sendBookingCancellation(input: BookingCancellationInput) {
  const resend = getResend();
  const from = getEmailFrom();
  const appBaseUrl = getAppBaseUrl();
  const to = resolveEmailRecipient(input.to);

  if (!to) {
    console.warn("[email.cancellation] No recipient resolved");
    return null;
  }

  const html = renderEmailShell({
    title: "Booking Cancelled",
    preview: `Your booking for ${input.roomName} was cancelled.`,
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.7;">
        Hello ${escapeHtml(input.recipientName || "there")},
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">
        Your booking has been cancelled.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-collapse:collapse;">
        <tr><td style="padding:8px 0;font-weight:700;">Room:</td><td style="padding:8px 0;">${escapeHtml(input.roomName)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:700;">Building:</td><td style="padding:8px 0;">${escapeHtml(input.building || "-")}</td></tr>
        <tr><td style="padding:8px 0;font-weight:700;">Start:</td><td style="padding:8px 0;">${escapeHtml(input.startLabel)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:700;">End:</td><td style="padding:8px 0;">${escapeHtml(input.endLabel)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:700;">Reason:</td><td style="padding:8px 0;">${escapeHtml(input.reason || "-")}</td></tr>
      </table>
      <p style="margin:0;font-size:15px;line-height:1.7;">
        You can make a new booking here:
        <a href="${appBaseUrl}/rooms">${appBaseUrl}/rooms</a>
      </p>
    `,
  });

  return resend.emails.send({
    from,
    to,
    subject: `Booking cancelled - ${input.roomName}`,
    html,
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}