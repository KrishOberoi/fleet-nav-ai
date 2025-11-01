import { createClient } from '@supabase/supabase-js';

// Create Supabase client for scripts
const SUPABASE_URL = "https://ponecvgchpqwxbsddcen.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbmVjdmdjaHBxd3hic2RkY2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMDg0NDQsImV4cCI6MjA3NjU4NDQ0NH0.U6iKFy-PM2ljPDTVWAOmIKErhADsm8G3KEfJ9pzHgaw";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function checkRoutes() {
  console.log('🔍 Checking routes in database...\n');

  const { data: routes, error } = await supabase
    .from('routes')
    .select('*');

  if (error) {
    console.log('❌ Error:', error);
    return;
  }

  console.log('📍 Routes found:');
  routes?.forEach(route => {
    console.log(`  - "${route.route_name}" (ID: ${route.route_id})`);
  });

  // Test search for "Central Delhi Loop"
  console.log('\n🔍 Testing search for "Central Delhi Loop":');
  const { data: searchResult, error: searchError } = await supabase
    .from('routes')
    .select('*')
    .ilike('route_name', '%Central Delhi Loop%');

  if (searchError) {
    console.log('❌ Search error:', searchError);
  } else {
    console.log('✅ Search result:', searchResult);
  }
}

// Run route check
checkRoutes();
