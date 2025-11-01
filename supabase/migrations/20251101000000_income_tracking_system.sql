-- Income Tracking System - Add columns to existing hourly_baselines table

-- Add income columns to the existing hourly_baselines table
ALTER TABLE hourly_baselines
ADD COLUMN IF NOT EXISTS avg_income_per_hour FLOAT,
ADD COLUMN IF NOT EXISTS avg_ticket_price FLOAT,
ADD COLUMN IF NOT EXISTS avg_passengers_per_trip FLOAT,
ADD COLUMN IF NOT EXISTS total_trips INTEGER;

-- Ticket transactions table
CREATE TABLE IF NOT EXISTS ticket_transactions (
  transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id TEXT REFERENCES buses(bus_id),
  route_id UUID REFERENCES routes(route_id),
  boarding_stop_id UUID REFERENCES stops(stop_id),
  deboarding_stop_id UUID REFERENCES stops(stop_id),
  passenger_count INTEGER DEFAULT 1,
  distance_km FLOAT,
  ticket_price FLOAT,
  total_income FLOAT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_bus ON ticket_transactions(bus_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_route ON ticket_transactions(route_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_stops ON ticket_transactions(boarding_stop_id, deboarding_stop_id);

-- Stop pair income tracking table
CREATE TABLE IF NOT EXISTS stop_pair_income (
  pair_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES routes(route_id),
  from_stop_id UUID REFERENCES stops(stop_id),
  to_stop_id UUID REFERENCES stops(stop_id),
  total_passengers INTEGER DEFAULT 0,
  total_income FLOAT DEFAULT 0,
  avg_ticket_price FLOAT,
  distance_km FLOAT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(route_id, from_stop_id, to_stop_id)
);

CREATE INDEX IF NOT EXISTS idx_stop_pair_route ON stop_pair_income(route_id);

-- Enable Row Level Security
ALTER TABLE ticket_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stop_pair_income ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow public read access on ticket_transactions" ON ticket_transactions FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on ticket_transactions" ON ticket_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on ticket_transactions" ON ticket_transactions FOR UPDATE USING (true);

CREATE POLICY "Allow public read access on stop_pair_income" ON stop_pair_income FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on stop_pair_income" ON stop_pair_income FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on stop_pair_income" ON stop_pair_income FOR UPDATE USING (true);
