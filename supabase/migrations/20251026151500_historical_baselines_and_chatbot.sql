-- Create historical baselines table for trend analysis
CREATE TABLE IF NOT EXISTS public.historical_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL, -- 'speed', 'occupancy', 'delay', 'passenger_count', etc.
  route_name TEXT,
  bus_number TEXT,
  time_period TEXT NOT NULL, -- 'hourly', 'daily', 'weekly'
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  avg_value NUMERIC NOT NULL,
  min_value NUMERIC,
  max_value NUMERIC,
  std_deviation NUMERIC,
  sample_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for historical baselines
CREATE INDEX IF NOT EXISTS idx_historical_baselines_metric ON public.historical_baselines(metric_name);
CREATE INDEX IF NOT EXISTS idx_historical_baselines_route ON public.historical_baselines(route_name);
CREATE INDEX IF NOT EXISTS idx_historical_baselines_bus ON public.historical_baselines(bus_number);
CREATE INDEX IF NOT EXISTS idx_historical_baselines_period ON public.historical_baselines(time_period, period_start);

