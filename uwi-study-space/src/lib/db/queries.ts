import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type RoomsFilter = {
  building?: string;
  minCapacity?: number;
  amenity?: string;
};

export async function getRoomsFiltered(filters: RoomsFilter) {
  const supabase = await createSupabaseServer();

  let q = supabase
    .from("rooms")
    .select(
      "id, name, building, floor, capacity, amenities, image_url, buffer_minutes, department:departments(name)",
    )
    .eq("is_active", true);

  if (filters.building) q = q.ilike("building", `%${filters.building}%`);
  if (filters.minCapacity) q = q.gte("capacity", filters.minCapacity);
  if (filters.amenity) q = q.contains("amenities", [filters.amenity]);

  const { data, error } = await q.order("building").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getBookedRoomIdsBetween(start: string, end: string) {
  const supabase = createSupabaseAdmin(); // ✅ bypass RLS safely

  const { data, error } = await supabase
    .from("bookings")
    .select("room_id")
    .eq("status", "active")
    .lt("start_time", end)
    .gt("end_time", start);

  if (error) {
    throw new Error(`getBookedRoomIdsBetween failed: ${error.message}`);
  }

  const ids = new Set<number>();
  for (const row of data ?? []) ids.add(row.room_id);

  return ids;
}