import { getResend, getEmailFrom, getAppBaseUrl } from "@/lib/email/resend";
import { renderEmailShell } from "@/lib/email/templates/base";
import { resolveEmailRecipient } from "@/lib/email/testing";

type BookingReminderInput = {
  to: string;
  recipientName?: string | null;
  roomName: string;
  building?: string | null;
  startLabel: string;
  endLabel: string;
};

export async function sendBookingReminder(input: BookingReminderInput) {
  const resend = getResend();
  const from = getEmailFrom();
  const appBaseUrl = getAppBaseUrl();
  const to = resolveEmailRecipient(input.to);

  if (!to) {
    console.warn("[email.reminder] No recipient resolved");
    return null;
  }

  const html = renderEmailShell({
    title: "Booking Reminder",
    preview: `Reminder for your booking in ${input.roomName}.`,
    bodyHtml: `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.7;">
        Hello ${escapeHtml(input.recipientName || "there")},
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">
        This is a reminder about your upcoming booking.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-collapse:collapse;">
        <tr><td style="padding:8px 0;font-weight:700;">Room:</td><td style="padding:8px 0;">${escapeHtml(input.roomName)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:700;">Building:</td><td style="padding:8px 0;">${escapeHtml(input.building || "-")}</td></tr>
        <tr><td style="padding:8px 0;font-weight:700;">Start:</td><td style="padding:8px 0;">${escapeHtml(input.startLabel)}</td></tr>
        <tr><td style="padding:8px 0;font-weight:700;">End:</td><td style="padding:8px 0;">${escapeHtml(input.endLabel)}</td></tr>
      </table>
      <p style="margin:0;font-size:15px;line-height:1.7;">
        View your booking here:
        <a href="${appBaseUrl}/bookings">${appBaseUrl}/bookings</a>
      </p>
    `,
  });

  return resend.emails.send({
    from,
    to,
    subject: `Booking reminder - ${input.roomName}`,
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