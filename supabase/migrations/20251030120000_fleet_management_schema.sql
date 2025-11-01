-- Fleet Management Database Schema
-- This migration creates the core tables for bus fleet management system

-- Routes table
CREATE TABLE IF NOT EXISTS routes (
  route_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_name TEXT NOT NULL,
  route_color TEXT,
  total_distance_km FLOAT,
  waypoints JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stops table
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

-- Buses table
CREATE TABLE IF NOT EXISTS buses (
  bus_id TEXT PRIMARY KEY,
  route_id UUID REFERENCES routes(route_id),
  capacity INTEGER DEFAULT 50,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bus realtime readings table
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

-- Hourly baselines table
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

-- Delay alerts table
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

-- Enable Row Level Security
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bus_realtime_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hourly_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE delay_alerts ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (operational data)
CREATE POLICY "Allow public read access to routes" ON routes FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert for routes" ON routes FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public read access to stops" ON stops FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert for stops" ON stops FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public read access to buses" ON buses FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert for buses" ON buses FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public read access to bus_realtime_readings" ON bus_realtime_readings FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert for bus_realtime_readings" ON bus_realtime_readings FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public read access to hourly_baselines" ON hourly_baselines FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert for hourly_baselines" ON hourly_baselines FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update for hourly_baselines" ON hourly_baselines FOR UPDATE TO public USING (true);

CREATE POLICY "Allow public read access to delay_alerts" ON delay_alerts FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert for delay_alerts" ON delay_alerts FOR INSERT TO public WITH CHECK (true);
