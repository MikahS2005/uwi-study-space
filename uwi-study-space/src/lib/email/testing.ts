// src/lib/email/testing.ts
export function resolveEmailRecipient(realRecipient?: string | null) {
  const testMode = process.env.EMAIL_TEST_MODE === "true";
  const testRecipient = (process.env.EMAIL_TEST_RECIPIENT || "delivered@resend.dev").trim();

  if (testMode) {
    return testRecipient || null;
  }

  const real = (realRecipient ?? "").trim();
  return real || null;
}