import { createClient } from '@supabase/supabase-js';

// Create Supabase client for scripts
const SUPABASE_URL = "https://ponecvgchpqwxbsddcen.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbmVjdmdjaHBxd3hic2RkY2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMDg0NDQsImV4cCI6MjA3NjU4NDQ0NH0.U6iKFy-PM2ljPDTVWAOmIKErhADsm8G3KEfJ9pzHgaw";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function createTables() {
  console.log('🔧 Creating fleet management tables...');

  try {
    // Create routes table
    console.log('📍 Creating routes table...');
    const { error: routesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS routes (
          route_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          route_name TEXT NOT NULL,
          route_color TEXT,
          total_distance_km FLOAT,
          waypoints JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });

    if (routesError && !routesError.message.includes('already exists')) {
      console.error('Error creating routes table:', routesError);
    } else {
      console.log('✅ Routes table ready');
    }

    // Create stops table
    console.log('🛑 Creating stops table...');
    const { error: stopsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS stops (
          stop_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          stop_name TEXT NOT NULL,
          latitude FLOAT NOT NULL,
          longitude FLOAT NOT NULL,
          stop_order INTEGER,
          route_id UUID REFERENCES routes(route_id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_stops_route ON stops(route_id);
      `
    });

    if (stopsError && !stopsError.message.includes('already exists')) {
      console.error('Error creating stops table:', stopsError);
    } else {
      console.log('✅ Stops table ready');
    }

    // Create buses table
    console.log('🚌 Creating buses table...');
    const { error: busesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS buses (
          bus_id TEXT PRIMARY KEY,
          route_id UUID REFERENCES routes(route_id),
          capacity INTEGER DEFAULT 50,
          status TEXT DEFAULT 'active',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });

    if (busesError && !busesError.message.includes('already exists')) {
      console.error('Error creating buses table:', busesError);
    } else {
      console.log('✅ Buses table ready');
    }

    // Create bus_realtime_readings table
    console.log('📡 Creating bus_realtime_readings table...');
    const { error: readingsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS bus_realtime_readings (
          reading_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          bus_id TEXT REFERENCES buses(bus_id),
          route_id UUID REFERENCES routes(route_id),
          timestamp TIMESTAMPTZ NOT NULL,
          latitude FLOAT,
          longitude FLOAT,
          speed_kmh FLOAT,
          passenger_count INTEGER,
          total_distance_traveled_km FLOAT
        );
        CREATE INDEX IF NOT EXISTS idx_readings_bus_time ON bus_realtime_readings(bus_id, timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_readings_route_time ON bus_realtime_readings(route_id, timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON bus_realtime_readings(timestamp DESC);
      `
    });

    if (readingsError && !readingsError.message.includes('already exists')) {
      console.error('Error creating bus_realtime_readings table:', readingsError);
    } else {
      console.log('✅ Bus realtime readings table ready');
    }

    // Create hourly_baselines table
    console.log('📊 Creating hourly_baselines table...');
    const { error: baselinesError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS hourly_baselines (
          baseline_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          route_id UUID REFERENCES routes(route_id),
          bus_id TEXT REFERENCES buses(bus_id),
          hour_of_day INTEGER CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
          day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
          avg_speed_kmh FLOAT,
          avg_passenger_count FLOAT,
          avg_distance_traveled_km FLOAT,
          sample_count INTEGER DEFAULT 0,
          is_synthetic BOOLEAN DEFAULT false,
          last_updated TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(route_id, bus_id, hour_of_day, day_of_week)
        );
        CREATE INDEX IF NOT EXISTS idx_baselines_route_hour_day ON hourly_baselines(route_id, hour_of_day, day_of_week);
      `
    });

    if (baselinesError && !baselinesError.message.includes('already exists')) {
      console.error('Error creating hourly_baselines table:', baselinesError);
    } else {
      console.log('✅ Hourly baselines table ready');
    }

    // Create delay_alerts table
    console.log('🚨 Creating delay_alerts table...');
    const { error: alertsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS delay_alerts (
          alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          bus_id TEXT REFERENCES buses(bus_id),
          route_id UUID REFERENCES routes(route_id),
          detected_at TIMESTAMPTZ DEFAULT NOW(),
          alert_type TEXT,
          severity TEXT,
          message TEXT,
          current_value FLOAT,
          baseline_value FLOAT,
          deviation_percentage FLOAT,
          resolved BOOLEAN DEFAULT false
        );
        CREATE INDEX IF NOT EXISTS idx_alerts_unresolved ON delay_alerts(bus_id, alert_type) WHERE resolved = false;
      `
    });

    if (alertsError && !alertsError.message.includes('already exists')) {
      console.error('Error creating delay_alerts table:', alertsError);
    } else {
      console.log('✅ Delay alerts table ready');
    }

    console.log('🎉 All tables created successfully!');

  } catch (error) {
    console.error('❌ Error creating tables:', error);
  }
}

// Run table creation
createTables();
