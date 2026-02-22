// src/lib/actions/favourites.ts
"use server";

import { createSupabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleFavoriteAction(roomId: number) {
  const supabase = await createSupabaseServer();
  
  // 1. Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("You must be logged in to favorite rooms.");
  }

  // 2. Check if already favorited
  const { data: existing } = await supabase
    .from("user_favorites")
    .select("*")
    .eq("user_id", user.id)
    .eq("room_id", roomId)
    .single();

  if (existing) {
    // 3a. Remove if exists
    await supabase
      .from("user_favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("room_id", roomId);
  } else {
    // 3b. Add if not exists
    await supabase
      .from("user_favorites")
      .insert({ user_id: user.id, room_id: roomId });
  }

  // 4. Refresh the page so the list order updates
  revalidatePath("/rooms");
}