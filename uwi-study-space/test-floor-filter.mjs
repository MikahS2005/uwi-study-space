import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xufaghkbpaeluijmxvvw.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1ZmFnaGticGFlbHVpam14dnZ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ4ODgzNiwiZXhwIjoyMDg2MDY0ODM2fQ.wTJaS_zu1Z4bezAQzuD5RWegfuE8ugo7CLG2LhtX_l8';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function testFloorFilter() {
  console.log('=== Testing Floor Filter ===\n');

  // Test 1: Simple floor query without joins
  console.log('Test 1: Query floor==1 without joins...');
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('id, name, floor')
      .eq('is_active', true)
      .eq('floor', '1');
    
    if (error) {
      console.error('❌ Error:', error);
    } else {
      console.log('✓ Result count:', data?.length);
      console.log('  Sample:', data?.[0]);
    }
  } catch (err) {
    console.error('❌ Exception:', err);
  }

  // Test 2: With department join
  console.log('\nTest 2: Query floor==1 WITH department join...');
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('id, name, floor, department:departments(id, name)')
      .eq('is_active', true)
      .eq('floor', '1');
    
    if (error) {
      console.error('❌ Error:', error);
    } else {
      console.log('✓ Result count:', data?.length);
      console.log('  Sample:', data?.[0]);
    }
  } catch (err) {
    console.error('❌ Exception:', err);
  }

  // Test 3: Full query like in app
  console.log('\nTest 3: Full query with floor==1...');
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('id, name, building, floor, capacity, amenities, image_url, buffer_minutes, department_id, department:departments(id, name)')
      .eq('is_active', true)
      .eq('floor', '1')
      .order('building')
      .order('name');
    
    if (error) {
      console.error('❌ Error:', error);
    } else {
      console.log('✓ Result count:', data?.length);
      console.log('  Sample:', JSON.stringify(data?.[0], null, 2));
    }
  } catch (err) {
    console.error('❌ Exception:', err);
  }

  // Test 4: Try numeric floor
  console.log('\nTest 4: Query floor==1 (numeric, not string)...');
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('id, name, floor')
      .eq('is_active', true)
      .eq('floor', 1);
    
    if (error) {
      console.error('❌ Error:', error);
    } else {
      console.log('✓ Result count:', data?.length);
      console.log('  Sample:', data?.[0]);
    }
  } catch (err) {
    console.error('❌ Exception:', err);
  }

  console.log('\n=== END TESTS ===');
  process.exit(0);
}

testFloorFilter().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
