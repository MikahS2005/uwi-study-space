// src/lib/email/resend.ts
import { Resend } from "resend";

let _resend: Resend | null = null;

export function getResend() {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("Missing RESEND_API_KEY");
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

export function getEmailFrom() {
  return process.env.EMAIL_FROM || "UWI Study Space <noreply@example.com>";
}

export function getAppBaseUrl() {
  return process.env.APP_BASE_URL || "http://localhost:3000";
}