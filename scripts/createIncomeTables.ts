import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ponecvgchpqwxbsddcen.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbmVjdmdjaHBxd3hic2RkY2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMDg0NDQsImV4cCI6MjA3NjU4NDQ0NH0.U6iKFy-PM2ljPDTVWAOmIKErhADsm8G3KEfJ9pzHgaw";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function createIncomeTables() {
  console.log('💰 Creating income tracking tables...');

  try {
    // Create ticket_transactions table
    console.log('📝 Creating ticket_transactions table...');
    const { error: ticketError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS ticket_transactions (
          transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          bus_id TEXT,
          route_id UUID,
          boarding_stop_id UUID,
          deboarding_stop_id UUID,
          passenger_count INTEGER DEFAULT 1,
          distance_km FLOAT,
          ticket_price FLOAT,
          total_income FLOAT,
          timestamp TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_transactions_bus ON ticket_transactions(bus_id, timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_transactions_route ON ticket_transactions(route_id, timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_transactions_stops ON ticket_transactions(boarding_stop_id, deboarding_stop_id);
      `
    });

    if (ticketError) {
      console.error('Error creating ticket_transactions:', ticketError);
    } else {
      console.log('✅ ticket_transactions table created');
    }

    // Create hourly_income_baselines table
    console.log('📊 Creating hourly_income_baselines table...');
    const { error: incomeError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS hourly_income_baselines (
          baseline_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          route_id UUID,
          bus_id TEXT,
          hour_of_day INTEGER CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
          day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
          avg_income_per_hour FLOAT,
          avg_ticket_price FLOAT,
          avg_passengers_per_trip FLOAT,
          total_trips INTEGER,
          is_synthetic BOOLEAN DEFAULT false,
          last_updated TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(route_id, bus_id, hour_of_day, day_of_week)
        );

        CREATE INDEX IF NOT EXISTS idx_income_baselines_route_hour_day ON hourly_income_baselines(route_id, hour_of_day, day_of_week);
      `
    });

    if (incomeError) {
      console.error('Error creating hourly_income_baselines:', incomeError);
    } else {
      console.log('✅ hourly_income_baselines table created');
    }

    // Create stop_pair_income table
    console.log('🛑 Creating stop_pair_income table...');
    const { error: pairError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS stop_pair_income (
          pair_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          route_id UUID,
          from_stop_id UUID,
          to_stop_id UUID,
          total_passengers INTEGER DEFAULT 0,
          total_income FLOAT DEFAULT 0,
          avg_ticket_price FLOAT,
          distance_km FLOAT,
          last_updated TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(route_id, from_stop_id, to_stop_id)
        );

        CREATE INDEX IF NOT EXISTS idx_stop_pair_route ON stop_pair_income(route_id);
      `
    });

    if (pairError) {
      console.error('Error creating stop_pair_income:', pairError);
    } else {
      console.log('✅ stop_pair_income table created');
    }

    console.log('🎉 All income tables created successfully!');
    console.log('💡 Next: Run synthetic income data generation');

  } catch (error) {
    console.error('❌ Failed to create tables:', error);
    console.log('🔧 Alternative: Run the SQL manually in Supabase SQL Editor');
  }
}

createIncomeTables();
