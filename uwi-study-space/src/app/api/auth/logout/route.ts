import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

function toPositiveInt(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export async function POST() {
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    let threshold = toPositiveInt(process.env.REVERIFY_AFTER_LOGOUTS, 1);

    // Optional DB override: settings.reverify_after_logout_count (if column exists in your table)
    try {
      const { data: settingsRow } = await admin
        .from("settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

      threshold = toPositiveInt(
        (settingsRow as Record<string, unknown> | null)?.reverify_after_logout_count,
        threshold,
      );
    } catch {
      // Keep env/default threshold when settings lookup is unavailable.
    }

    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const currentCount = toPositiveInt(metadata.logout_count_since_reverify, 0);
    const nextCount = currentCount + 1;
    const shouldRequireReverify = nextCount >= threshold;

    if (shouldRequireReverify) {
      await admin
        .from("profiles")
        .update({ account_status: "pending_verification" })
        .eq("id", user.id);
    }

    // Persist rolling logout count in auth metadata.
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...metadata,
        logout_count_since_reverify: shouldRequireReverify ? 0 : nextCount,
      },
    });
  }

  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
