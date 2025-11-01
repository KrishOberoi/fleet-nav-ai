import { createClient } from '@supabase/supabase-js';

// Create Supabase client for scripts
const SUPABASE_URL = "https://ponecvgchpqwxbsddcen.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbmVjdmdjaHBxd3hic2RkY2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMDg0NDQsImV4cCI6MjA3NjU4NDQ0NH0.U6iKFy-PM2ljPDTVWAOmIKErhADsm8G3KEfJ9pzHgaw";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function checkTables() {
  console.log('🔍 Checking existing tables...\n');

  const tables = ['routes', 'stops', 'buses', 'bus_realtime_readings', 'hourly_baselines', 'delay_alerts'];

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);

      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: exists`);
      }
    } catch (err) {
      console.log(`❌ ${table}: error - ${err}`);
    }
  }

  console.log('\n📋 If tables are missing, create them manually in Supabase Dashboard:');
  console.log('   Go to: https://supabase.com/dashboard/project/ponecvgchpqwxbsddcen/editor');
  console.log('   Navigate to SQL Editor and run the migration SQL');
}

// Run table check
checkTables();
