import { createClient } from '@supabase/supabase-js';

// Create Supabase client for scripts
const SUPABASE_URL = "https://ponecvgchpqwxbsddcen.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbmVjdmdjaHBxd3hic2RkY2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMDg0NDQsImV4cCI6MjA3NjU4NDQ0NH0.U6iKFy-PM2ljPDTVWAOmIKErhADsm8G3KEfJ9pzHgaw";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function resetAndInit() {
  console.log('🔄 Resetting database and re-initializing...');

  try {
    // Clear existing data (in reverse dependency order)
    console.log('🗑️ Clearing existing data...');

    await supabase.from('delay_alerts').delete().neq('alert_id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('hourly_baselines').delete().neq('baseline_id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('bus_realtime_readings').delete().neq('reading_id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('buses').delete().neq('bus_id', 'dummy');
    await supabase.from('stops').delete().neq('stop_id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('routes').delete().neq('route_id', '00000000-0000-0000-0000-000000000000');

    console.log('✅ Database cleared');

    // Now run the initialization
    console.log('🚀 Running initialization...');
    const { spawn } = await import('child_process');

    const initProcess = spawn('npx', ['tsx', 'scripts/initialize.ts'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    initProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Re-initialization complete!');
      } else {
        console.error(`❌ Initialization failed with code ${code}`);
      }
    });

  } catch (error) {
    console.error('❌ Reset failed:', error);
  }
}

// Run reset and init
resetAndInit();
