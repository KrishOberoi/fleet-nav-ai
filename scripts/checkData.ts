import { createClient } from '@supabase/supabase-js';

// Create Supabase client for scripts
const SUPABASE_URL = "https://ponecvgchpqwxbsddcen.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbmVjdmdjaHBxd3hic2RkY2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMDg0NDQsImV4cCI6MjA3NjU4NDQ0NH0.U6iKFy-PM2ljPDTVWAOmIKErhADsm8G3KEfJ9pzHgaw";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function checkData() {
  console.log('🔍 Checking database data...\n');

  // Check buses
  const { data: buses, error: busesError } = await supabase
    .from('buses')
    .select('*')
    .limit(5);

  console.log('🚌 Buses in database:');
  if (busesError) {
    console.log('❌ Error:', busesError);
  } else {
    console.log(buses?.map(b => `${b.bus_id} (${b.route_id})`).join(', ') || 'None');
  }

  // Check routes
  const { data: routes, error: routesError } = await supabase
    .from('routes')
    .select('*')
    .limit(5);

  console.log('\n🛣️ Routes in database:');
  if (routesError) {
    console.log('❌ Error:', routesError);
  } else {
    console.log(routes?.map(r => `${r.route_name} (${r.route_id})`).join(', ') || 'None');
  }

  // Check stops
  const { data: stops, error: stopsError } = await supabase
    .from('stops')
    .select('*')
    .limit(5);

  console.log('\n🛑 Stops in database:');
  if (stopsError) {
    console.log('❌ Error:', stopsError);
  } else {
    console.log(`${stops?.length || 0} stops found`);
  }

  // Check realtime readings
  const { data: readings, error: readingsError } = await supabase
    .from('bus_realtime_readings')
    .select('*')
    .limit(3);

  console.log('\n📡 Real-time readings:');
  if (readingsError) {
    console.log('❌ Error:', readingsError);
  } else {
    console.log(`${readings?.length || 0} readings found`);
    readings?.forEach(r => console.log(`  - ${r.bus_id} at ${r.timestamp}`));
  }

  // Check baselines
  const { data: baselines, error: baselinesError } = await supabase
    .from('hourly_baselines')
    .select('*')
    .limit(3);

  console.log('\n📊 Baselines:');
  if (baselinesError) {
    console.log('❌ Error:', baselinesError);
  } else {
    console.log(`${baselines?.length || 0} baselines found`);
  }
}

// Run data check
checkData();
