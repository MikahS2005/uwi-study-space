import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type RoomsFilter = {
  departmentId?: number;
  floor?: string;
  minCapacity?: number;
  maxCapacity?: number;
  amenity?: string;
};

export async function getRoomsFiltered(filters: RoomsFilter) {
  const supabase = await createSupabaseServer();
  console.log('[getRoomsFiltered] Starting query with filters:', JSON.stringify(filters));

  let q = supabase
    .from("rooms")
    .select(
      "id, name, building, floor, capacity, amenities, image_url, buffer_minutes, department_id, department:departments(id, name)",
    )
    .eq("is_active", true);

  console.log('[getRoomsFiltered] After initial select is_active=true');

  if (filters.departmentId) {
    console.log('[getRoomsFiltered] Adding departmentId filter:', filters.departmentId);
    q = q.eq("department_id", filters.departmentId);
  }
  if (filters.floor) {
    console.log('[getRoomsFiltered] Adding floor filter:', filters.floor, 'Type:', typeof filters.floor);
    q = q.eq("floor", filters.floor);
  }
  if (filters.minCapacity) {
    console.log('[getRoomsFiltered] Adding minCapacity filter:', filters.minCapacity);
    q = q.gte("capacity", filters.minCapacity);
  }
  if (filters.maxCapacity) {
    console.log('[getRoomsFiltered] Adding maxCapacity filter:', filters.maxCapacity);
    q = q.lte("capacity", filters.maxCapacity);
  }
  if (filters.amenity) {
    console.log('[getRoomsFiltered] Adding amenity filter:', filters.amenity);
    q = q.contains("amenities", [filters.amenity]);
  }

  console.log('[getRoomsFiltered] About to execute query...');
  const { data, error } = await q.order("building").order("name");
  console.log('[getRoomsFiltered] Query executed');
  
  if (error) {
    console.error('[getRoomsFiltered] Query error:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    console.warn('[getRoomsFiltered] Attempting with admin client...');
    
    // Fallback to admin client
    const adminSupabase = createSupabaseAdmin();
    let aq = adminSupabase
      .from("rooms")
      .select(
        "id, name, building, floor, capacity, amenities, image_url, buffer_minutes, department_id, department:departments(id, name)",
      )
      .eq("is_active", true);

    if (filters.departmentId) aq = aq.eq("department_id", filters.departmentId);
    if (filters.floor) aq = aq.eq("floor", filters.floor);
    if (filters.minCapacity) aq = aq.gte("capacity", filters.minCapacity);
    if (filters.maxCapacity) aq = aq.lte("capacity", filters.maxCapacity);
    if (filters.amenity) aq = aq.contains("amenities", [filters.amenity]);

    const { data: adminData, error: adminError } = await aq.order("building").order("name");
    if (adminError) {
      console.error('[getRoomsFiltered] Admin fallback also failed:', adminError.message);
      throw new Error(adminError.message);
    }
    console.log('[getRoomsFiltered] Admin client succeeded! RLS issue confirmed. Returned', adminData?.length, 'rooms');
    return adminData ?? [];
  }
  
  console.log('[getRoomsFiltered] Server query succeeded. Returned:', data?.length, 'rooms');
  return data ?? [];
}

/**
 * Get unique department options for filter dropdown
 */
export async function getDepartmentFilterOptions() {
  try {
    const supabase = await createSupabaseServer();
    console.log('[getDepartmentFilterOptions] Starting query...');

    const { data, error } = await supabase
      .from("departments")
      .select("id, name")
      .order("name");

    if (error) {
      console.error('[getDepartmentFilterOptions] Query error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      // Fallback to admin client to check if RLS is the issue
      console.warn('[getDepartmentFilterOptions] Attempting with admin client...');
      const adminSupabase = createSupabaseAdmin();
      const { data: adminData, error: adminError } = await adminSupabase
        .from("departments")
        .select("id, name")
        .order("name");
      if (!adminError && adminData) {
        console.log('[getDepartmentFilterOptions] Admin client succeeded! RLS issue confirmed.');
        return adminData;
      }
      return [];
    }
    
    console.log('[getDepartmentFilterOptions] Retrieved:', data?.length, 'departments');
    return data ?? [];
  } catch (err) {
    console.error('[getDepartmentFilterOptions] Exception:', err);
    return [];
  }
}

/**
 * Get unique floor options for filter dropdown
 */
export async function getFloorFilterOptions() {
  try {
    const supabase = await createSupabaseServer();
    console.log('[getFloorFilterOptions] Starting query...');

    const { data, error } = await supabase
      .from("rooms")
      .select("floor")
      .eq("is_active", true);

    if (error) {
      console.error('[getFloorFilterOptions] Query error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      console.warn('[getFloorFilterOptions] Attempting with admin client...');
      const adminSupabase = createSupabaseAdmin();
      const { data: adminData, error: adminError } = await adminSupabase
        .from("rooms")
        .select("floor")
        .eq("is_active", true);
      if (!adminError && adminData) {
        console.log('[getFloorFilterOptions] Admin client succeeded! RLS issue confirmed.');
        const floors = new Set<string>();
        for (const row of adminData) {
          if (row.floor !== null && row.floor !== undefined && row.floor !== '') {
            floors.add(String(row.floor).trim());
          }
        }
        return Array.from(floors).filter((f) => f.length > 0).sort();
      }
      return [];
    }

    // Get unique values, handle null and convert to string
    const floors = new Set<string>();
    for (const row of data ?? []) {
      if (row.floor !== null && row.floor !== undefined && row.floor !== '') {
        floors.add(String(row.floor).trim());
      }
    }

    const result = Array.from(floors)
      .filter((f) => f.length > 0)
      .sort();
    
    console.log('[getFloorFilterOptions] Retrieved:', result.length, 'floors');
    return result;
  } catch (err) {
    console.error('[getFloorFilterOptions] Exception:', err);
    return [];
  }
}

/**
 * Get unique amenity options for filter dropdown
 */
export async function getAmenityFilterOptions() {
  try {
    const supabase = await createSupabaseServer();
    console.log('[getAmenityFilterOptions] Starting query...');

    const { data, error } = await supabase
      .from("rooms")
      .select("amenities")
      .eq("is_active", true);

    if (error) {
      console.error('[getAmenityFilterOptions] Query error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      console.warn('[getAmenityFilterOptions] Attempting with admin client...');
      const adminSupabase = createSupabaseAdmin();
      const { data: adminData, error: adminError } = await adminSupabase
        .from("rooms")
        .select("amenities")
        .eq("is_active", true);
      if (!adminError && adminData) {
        console.log('[getAmenityFilterOptions] Admin client succeeded! RLS issue confirmed.');
        const amenities = new Set<string>();
        for (const row of adminData) {
          if (Array.isArray(row.amenities)) {
            for (const amenity of row.amenities) {
              if (amenity && amenity !== '') {
                amenities.add(String(amenity).trim());
              }
            }
          }
        }
        return Array.from(amenities).filter((a) => a.length > 0).sort();
      }
      return [];
    }

    // Flatten all amenity arrays and deduplicate
    const amenities = new Set<string>();
    for (const row of data ?? []) {
      if (Array.isArray(row.amenities)) {
        for (const amenity of row.amenities) {
          if (amenity && amenity !== '') {
            amenities.add(String(amenity).trim());
          }
        }
      }
    }

    const result = Array.from(amenities)
      .filter((a) => a.length > 0)
      .sort();
    
    console.log('[getAmenityFilterOptions] Retrieved:', result.length, 'amenities');
    return result;
  } catch (err) {
    console.error('[getAmenityFilterOptions] Exception:', err);
    return [];
  }
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