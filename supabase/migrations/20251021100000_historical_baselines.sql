-- Create historical baselines table for trend analysis
CREATE TABLE IF NOT EXISTS public.historical_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL, -- 'speed', 'occupancy', 'delay', etc.
  route_name TEXT,
  bus_number TEXT,
  time_period TEXT NOT NULL, -- 'hourly', 'daily', 'weekly'
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  avg_value NUMERIC NOT NULL,
  min_value NUMERIC NOT NULL,
  max_value NUMERIC NOT NULL,
  std_dev NUMERIC NOT NULL,
  sample_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for historical baselines
CREATE INDEX IF NOT EXISTS idx_historical_baselines_metric ON public.historical_baselines(metric_name);
CREATE INDEX IF NOT EXISTS idx_historical_baselines_route ON public.historical_baselines(route_name);
CREATE INDEX IF NOT EXISTS idx_historical_baselines_bus ON public.historical_baselines(bus_number);
CREATE INDEX IF NOT EXISTS idx_historical_baselines_period ON public.historical_baselines(time_period, period_start);

-- Create fleet performance metrics table
CREATE TABLE IF NOT EXISTS public.fleet_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  total_buses INTEGER NOT NULL,
  active_buses INTEGER NOT NULL,
  avg_speed NUMERIC NOT NULL,
  avg_occupancy NUMERIC NOT NULL,
  total_passengers INTEGER NOT NULL,
  on_time_percentage NUMERIC NOT NULL,
  maintenance_incidents INTEGER NOT NULL DEFAULT 0,
  fuel_efficiency NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for fleet performance
CREATE INDEX IF NOT EXISTS idx_fleet_performance_date ON public.fleet_performance(date);

-- Create anomaly detection table
CREATE TABLE IF NOT EXISTS public.anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_type TEXT NOT NULL, -- 'speed', 'occupancy', 'delay', 'maintenance'
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  bus_number TEXT,
  route_name TEXT,
  description TEXT NOT NULL,
  detected_value NUMERIC,
  expected_range JSONB, -- {min, max, avg}
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for anomalies
CREATE INDEX IF NOT EXISTS idx_anomalies_type ON public.anomalies(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON public.anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_anomalies_timestamp ON public.anomalies(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_resolved ON public.anomalies(resolved);

-- Create route optimization suggestions table
CREATE TABLE IF NOT EXISTS public.route_optimizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_name TEXT NOT NULL,
  optimization_type TEXT NOT NULL, -- 'frequency', 'timing', 'capacity'
  current_value JSONB NOT NULL,
  suggested_value JSONB NOT NULL,
  expected_benefit TEXT NOT NULL,
  implementation_cost TEXT,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'implemented', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for route optimizations
CREATE INDEX IF NOT EXISTS idx_route_optimizations_route ON public.route_optimizations(route_name);
CREATE INDEX IF NOT EXISTS idx_route_optimizations_status ON public.route_optimizations(status);

-- Enable RLS on all new tables
ALTER TABLE public.historical_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_optimizations ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (operational data)
CREATE POLICY "Allow public read access to historical baselines"
  ON public.historical_baselines FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert for historical baselines"
  ON public.historical_baselines FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public read access to fleet performance"
  ON public.fleet_performance FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert for fleet performance"
  ON public.fleet_performance FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public read access to anomalies"
  ON public.anomalies FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert for anomalies"
  ON public.anomalies FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public read access to route optimizations"
  ON public.route_optimizations FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert for route optimizations"
  ON public.route_optimizations FOR INSERT TO public WITH CHECK (true);

-- Create function to update historical baselines
CREATE OR REPLACE FUNCTION update_historical_baselines()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  metric_record RECORD;
  baseline_record RECORD;
BEGIN
  -- Update speed baselines
  FOR metric_record IN
    SELECT
      route_name,
      DATE_TRUNC('hour', timestamp) as hour_start,
      AVG(speed) as avg_speed,
      MIN(speed) as min_speed,
      MAX(speed) as max_speed,
      STDDEV(speed) as std_speed,
      COUNT(*) as sample_count
    FROM public.bus_data
    WHERE timestamp >= NOW() - INTERVAL '24 hours'
    GROUP BY route_name, DATE_TRUNC('hour', timestamp)
  LOOP
    INSERT INTO public.historical_baselines (
      metric_name, route_name, time_period, period_start, period_end,
      avg_value, min_value, max_value, std_dev, sample_count
    ) VALUES (
      'speed', metric_record.route_name, 'hourly',
      metric_record.hour_start, metric_record.hour_start + INTERVAL '1 hour',
      metric_record.avg_speed, metric_record.min_speed, metric_record.max_speed,
      COALESCE(metric_record.std_speed, 0), metric_record.sample_count
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Update occupancy baselines
  FOR metric_record IN
    SELECT
      route_name,
      DATE_TRUNC('hour', timestamp) as hour_start,
      AVG((passenger_count::numeric / capacity) * 100) as avg_occupancy,
      MIN((passenger_count::numeric / capacity) * 100) as min_occupancy,
      MAX((passenger_count::numeric / capacity) * 100) as max_occupancy,
      STDDEV((passenger_count::numeric / capacity) * 100) as std_occupancy,
      COUNT(*) as sample_count
    FROM public.bus_data
    WHERE timestamp >= NOW() - INTERVAL '24 hours'
    GROUP BY route_name, DATE_TRUNC('hour', timestamp)
  LOOP
    INSERT INTO public.historical_baselines (
      metric_name, route_name, time_period, period_start, period_end,
      avg_value, min_value, max_value, std_dev, sample_count
    ) VALUES (
      'occupancy', metric_record.route_name, 'hourly',
      metric_record.hour_start, metric_record.hour_start + INTERVAL '1 hour',
      metric_record.avg_occupancy, metric_record.min_occupancy, metric_record.max_occupancy,
      COALESCE(metric_record.std_occupancy, 0), metric_record.sample_count
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- Create function to detect anomalies
CREATE OR REPLACE FUNCTION detect_anomalies()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  speed_record RECORD;
  occupancy_record RECORD;
BEGIN
  -- Detect speed anomalies
  FOR speed_record IN
    SELECT
      b.bus_number,
      b.route_name,
      b.speed,
      b.timestamp,
      h.avg_value as baseline_avg,
      h.std_dev as baseline_std
    FROM public.bus_data b
    LEFT JOIN public.historical_baselines h ON
      h.metric_name = 'speed' AND
      h.route_name = b.route_name AND
      h.time_period = 'hourly' AND
      DATE_TRUNC('hour', b.timestamp) = h.period_start
    WHERE b.timestamp >= NOW() - INTERVAL '1 hour'
      AND h.avg_value IS NOT NULL
      AND (b.speed < h.avg_value - (3 * h.std_dev) OR b.speed > h.avg_value + (3 * h.std_dev))
  LOOP
    INSERT INTO public.anomalies (
      anomaly_type, severity, bus_number, route_name, description,
      detected_value, expected_range
    ) VALUES (
      'speed',
      CASE
        WHEN ABS(speed_record.speed - speed_record.baseline_avg) > 4 * speed_record.baseline_std THEN 'critical'
        WHEN ABS(speed_record.speed - speed_record.baseline_avg) > 3 * speed_record.baseline_std THEN 'high'
        ELSE 'medium'
      END,
      speed_record.bus_number,
      speed_record.route_name,
      CASE
        WHEN speed_record.speed < speed_record.baseline_avg THEN 'Unusually slow speed detected'
        ELSE 'Unusually high speed detected'
      END,
      speed_record.speed,
      jsonb_build_object(
        'min', GREATEST(0, speed_record.baseline_avg - (2 * speed_record.baseline_std)),
        'max', speed_record.baseline_avg + (2 * speed_record.baseline_std),
        'avg', speed_record.baseline_avg
      )
    );
  END LOOP;

  -- Detect occupancy anomalies
  FOR occupancy_record IN
    SELECT
      b.bus_number,
      b.route_name,
      (b.passenger_count::numeric / b.capacity) * 100 as occupancy_pct,
      b.timestamp,
      h.avg_value as baseline_avg,
      h.std_dev as baseline_std
    FROM public.bus_data b
    LEFT JOIN public.historical_baselines h ON
      h.metric_name = 'occupancy' AND
      h.route_name = b.route_name AND
      h.time_period = 'hourly' AND
      DATE_TRUNC('hour', b.timestamp) = h.period_start
    WHERE b.timestamp >= NOW() - INTERVAL '1 hour'
      AND h.avg_value IS NOT NULL
      AND (occupancy_pct < h.avg_value - (3 * h.std_dev) OR occupancy_pct > h.avg_value + (3 * h.std_dev))
  LOOP
    INSERT INTO public.anomalies (
      anomaly_type, severity, bus_number, route_name, description,
      detected_value, expected_range
    ) VALUES (
      'occupancy',
      CASE
        WHEN ABS(occupancy_record.occupancy_pct - occupancy_record.baseline_avg) > 4 * occupancy_record.baseline_std THEN 'critical'
        WHEN ABS(occupancy_record.occupancy_pct - occupancy_record.baseline_avg) > 3 * occupancy_record.baseline_std THEN 'high'
        ELSE 'medium'
      END,
      occupancy_record.bus_number,
      occupancy_record.route_name,
      CASE
        WHEN occupancy_record.occupancy_pct < occupancy_record.baseline_avg THEN 'Unusually low occupancy detected'
        ELSE 'Unusually high occupancy detected'
      END,
      occupancy_record.occupancy_pct,
      jsonb_build_object(
        'min', GREATEST(0, occupancy_record.baseline_avg - (2 * occupancy_record.baseline_std)),
        'max', occupancy_record.baseline_avg + (2 * occupancy_record.baseline_std),
        'avg', occupancy_record.baseline_avg
      )
    );
  END LOOP;
END;
$$;
