import { getDepartmentFilterOptions, getFloorFilterOptions, getAmenityFilterOptions, getRoomsFiltered } from "@/lib/db/queries";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log('\n=== [API] Testing filter queries ===');
    
    // Test departments
    const departments = await getDepartmentFilterOptions();
    console.log('[API] Departments:', departments.length);
    
    // Test floors
    const floors = await getFloorFilterOptions();
    console.log('[API] Floors:', floors.length);
    
    // Test amenities
    const amenities = await getAmenityFilterOptions();
    console.log('[API] Amenities:', amenities.length);
    
    // Test rooms
    const rooms = await getRoomsFiltered({});
    console.log('[API] Rooms:', rooms.length);
    
    return NextResponse.json({
      status: 'ok',
      data: {
        departments: departments.length,
        floors: floors.length,
        amenities: amenities.length,
        rooms: rooms.length,
        details: {
          departments: departments.slice(0, 3),
          floors,
          amenities: amenities.slice(0, 3),
          roomSample: (rooms as any[])[0],
        }
      }
    });
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json({
      status: 'error',
      error: String(error),
    }, { status: 500 });
  }
}
