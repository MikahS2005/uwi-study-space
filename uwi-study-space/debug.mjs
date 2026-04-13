import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xufaghkbpaeluijmxvvw.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1ZmFnaGticGFlbHVpam14dnZ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ4ODgzNiwiZXhwIjoyMDg2MDY0ODM2fQ.wTJaS_zu1Z4bezAQzuD5RWegfuE8ugo7CLG2LhtX_l8';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function debug() {
  console.log('=== DEBUG: Checking Supabase Data ===\n');

  // Check departments
  console.log('--- Checking departments table ---');
  const { data: departments, error: deptError } = await supabase
    .from('departments')
    .select('id, name')
    .limit(10);
  
  if (deptError) {
    console.error('❌ Error fetching departments:', deptError);
  } else {
    console.log(`✓ Found ${departments?.length || 0} departments`);
    console.log(JSON.stringify(departments, null, 2));
  }

  // Check rooms
  console.log('\n--- Checking rooms table ---');
  const { data: rooms, error: roomError } = await supabase
    .from('rooms')
    .select('id, name, building, floor, capacity, amenities, is_active, department_id')
    .eq('is_active', true)
    .limit(10);
  
  if (roomError) {
    console.error('❌ Error fetching rooms:', roomError);
  } else {
    console.log(`✓ Found ${rooms?.length || 0} active rooms`);
    console.log(JSON.stringify(rooms, null, 2));
  }

  // Check unique floors from rooms
  console.log('\n--- Checking unique floors ---');
  const { data: floorsData, error: floorsError } = await supabase
    .from('rooms')
    .select('floor')
    .eq('is_active', true);
  
  if (floorsError) {
    console.error('❌ Error fetching floors:', floorsError);
  } else {
    const uniqueFloors = new Set();
    (floorsData || []).forEach(r => {
      if (r.floor !== null && r.floor !== undefined) {
        uniqueFloors.add(String(r.floor).trim());
      }
    });
    console.log(`✓ Found ${uniqueFloors.size} unique floors:`, Array.from(uniqueFloors).sort());
  }

  // Check unique amenities from rooms
  console.log('\n--- Checking unique amenities ---');
  const { data: amenitiesData, error: amenitiesError } = await supabase
    .from('rooms')
    .select('amenities')
    .eq('is_active', true);
  
  if (amenitiesError) {
    console.error('❌ Error fetching amenities:', amenitiesError);
  } else {
    const uniqueAmenities = new Set();
    (amenitiesData || []).forEach(r => {
      if (Array.isArray(r.amenities)) {
        r.amenities.forEach(a => {
          if (a && a !== '') {
            uniqueAmenities.add(String(a).trim());
          }
        });
      }
    });
    console.log(`✓ Found ${uniqueAmenities.size} unique amenities:`, Array.from(uniqueAmenities).sort());
  }

  console.log('\n=== END DEBUG ===');
  process.exit(0);
}

debug().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
