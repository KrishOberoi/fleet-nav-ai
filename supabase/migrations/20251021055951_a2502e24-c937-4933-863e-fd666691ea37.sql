-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create bus_data table with all required fields
CREATE TABLE IF NOT EXISTS public.bus_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  bus_number TEXT NOT NULL,
  route_name TEXT NOT NULL,
  location JSONB NOT NULL,
  speed NUMERIC NOT NULL DEFAULT 0,
  avg_speed NUMERIC NOT NULL DEFAULT 0,
  passenger_count INTEGER NOT NULL DEFAULT 0,
  capacity INTEGER NOT NULL DEFAULT 50,
  avg_occupancy NUMERIC NOT NULL DEFAULT 0,
  total_journey_time NUMERIC NOT NULL DEFAULT 0,
  estimated_journey_time NUMERIC NOT NULL DEFAULT 0,
  is_under_maintenance BOOLEAN NOT NULL DEFAULT false,
  operational_status TEXT NOT NULL DEFAULT 'active' CHECK (operational_status IN ('active', 'idle', 'maintenance')),
  total_moving_time NUMERIC NOT NULL DEFAULT 0,
  total_stopping_time NUMERIC NOT NULL DEFAULT 0,
  delay_time NUMERIC NOT NULL DEFAULT 0,
  embedding vector(384),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bus_data_bus_number ON public.bus_data(bus_number);
CREATE INDEX IF NOT EXISTS idx_bus_data_route_name ON public.bus_data(route_name);
CREATE INDEX IF NOT EXISTS idx_bus_data_timestamp ON public.bus_data(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bus_data_operational_status ON public.bus_data(operational_status);

-- Create vector similarity search index
CREATE INDEX IF NOT EXISTS idx_bus_data_embedding ON public.bus_data USING ivfflat (embedding vector_cosine_ops);

-- Enable Row Level Security
ALTER TABLE public.bus_data ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access (this is operational data for dashboard)
CREATE POLICY "Allow public read access to bus data"
  ON public.bus_data
  FOR SELECT
  TO public
  USING (true);

-- Create policy to allow public insert for data ingestion
CREATE POLICY "Allow public insert for bus data"
  ON public.bus_data
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Create AI insights table to store generated insights
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('recommendation', 'alert', 'forecast', 'optimization')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for insights
CREATE INDEX IF NOT EXISTS idx_ai_insights_created_at ON public.ai_insights(created_at DESC);

-- Enable RLS for insights
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- Allow public read access to insights
CREATE POLICY "Allow public read access to ai insights"
  ON public.ai_insights
  FOR SELECT
  TO public
  USING (true);

-- Allow public insert for insights generation
CREATE POLICY "Allow public insert for ai insights"
  ON public.ai_insights
  FOR INSERT
  TO public
  WITH CHECK (true);