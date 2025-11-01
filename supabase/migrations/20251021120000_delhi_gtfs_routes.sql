-- Delhi GTFS Routes and Shapes Schema
-- This migration adds support for Delhi GTFS static data

-- Routes table - from routes.txt
CREATE TABLE IF NOT EXISTS public.gtfs_routes (
  route_id TEXT PRIMARY KEY,
  agency_id TEXT,
  route_short_name TEXT,
  route_long_name TEXT,
  route_desc TEXT,
  route_type INTEGER, -- 0: Tram, 1: Subway, 2: Rail, 3: Bus, 4: Ferry, 5: Cable car, 6: Gondola, 7: Funicular
  route_url TEXT,
  route_color TEXT,
  route_text_color TEXT,
  route_sort_order INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trips table - from trips.txt
CREATE TABLE IF NOT EXISTS public.gtfs_trips (
  trip_id TEXT PRIMARY KEY,
  route_id TEXT REFERENCES public.gtfs_routes(route_id),
  service_id TEXT,
  trip_headsign TEXT,
  trip_short_name TEXT,
  direction_id INTEGER, -- 0: outbound, 1: inbound
  block_id TEXT,
  shape_id TEXT,
  wheelchair_accessible INTEGER, -- 0: no info, 1: accessible, 2: not accessible
  bikes_allowed INTEGER, -- 0: no info, 1: allowed, 2: not allowed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shapes table - route geometries from shapes.txt
CREATE TABLE IF NOT EXISTS public.gtfs_shapes (
  shape_id TEXT,
  shape_pt_lat DOUBLE PRECISION NOT NULL,
  shape_pt_lon DOUBLE PRECISION NOT NULL,
  shape_pt_sequence INTEGER NOT NULL,
  shape_dist_traveled DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (shape_id, shape_pt_sequence)
);

-- Stops table - from stops.txt
CREATE TABLE IF NOT EXISTS public.gtfs_stops (
  stop_id TEXT PRIMARY KEY,
  stop_code TEXT,
  stop_name TEXT,
  stop_desc TEXT,
  stop_lat DOUBLE PRECISION NOT NULL,
  stop_lon DOUBLE PRECISION NOT NULL,
  zone_id TEXT,
  stop_url TEXT,
  location_type INTEGER, -- 0: stop, 1: station
  parent_station TEXT,
  stop_timezone TEXT,
  wheelchair_boarding INTEGER, -- 0: no info, 1: accessible, 2: not accessible
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Route shapes aggregated table - for easy route visualization
CREATE TABLE IF NOT EXISTS public.route_shapes (
  route_id TEXT PRIMARY KEY REFERENCES public.gtfs_routes(route_id),
  route_name TEXT NOT NULL,
  shape_points JSONB NOT NULL, -- Array of [lng, lat] coordinates
  total_distance_km DOUBLE PRECISION,
  avg_travel_time_minutes INTEGER,
  start_stop_name TEXT,
  end_stop_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Route baselines for performance metrics
CREATE TABLE IF NOT EXISTS public.route_baselines (
  route_id TEXT PRIMARY KEY REFERENCES public.gtfs_routes(route_id),
  avg_speed_kmh DOUBLE PRECISION,
  avg_travel_time_minutes INTEGER,
  total_trips_analyzed INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Update bus_data table to include route information
ALTER TABLE public.bus_data
ADD COLUMN IF NOT EXISTS trip_id TEXT,
ADD COLUMN IF NOT EXISTS route_id TEXT,
ADD COLUMN IF NOT EXISTS shape_id TEXT,
ADD COLUMN IF NOT EXISTS direction_id INTEGER,
ADD COLUMN IF NOT EXISTS distance_remaining_km DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS estimated_arrival_minutes INTEGER;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_gtfs_shapes_shape_id ON public.gtfs_shapes(shape_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_trips_route_id ON public.gtfs_trips(route_id);
CREATE INDEX IF NOT EXISTS idx_gtfs_trips_shape_id ON public.gtfs_trips(shape_id);
CREATE INDEX IF NOT EXISTS idx_bus_data_trip_id ON public.bus_data(trip_id);
CREATE INDEX IF NOT EXISTS idx_bus_data_route_id ON public.bus_data(route_id);

-- Enable RLS
ALTER TABLE public.gtfs_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_shapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gtfs_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_shapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_baselines ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Allow public read access to gtfs_routes" ON public.gtfs_routes FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access to gtfs_trips" ON public.gtfs_trips FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access to gtfs_shapes" ON public.gtfs_shapes FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access to gtfs_stops" ON public.gtfs_stops FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access to route_shapes" ON public.route_shapes FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access to route_baselines" ON public.route_baselines FOR SELECT TO public USING (true);

-- Insert policies
CREATE POLICY "Allow public insert for gtfs_routes" ON public.gtfs_routes FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public insert for gtfs_trips" ON public.gtfs_trips FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public insert for gtfs_shapes" ON public.gtfs_shapes FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public insert for gtfs_stops" ON public.gtfs_stops FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public insert for route_shapes" ON public.route_shapes FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public insert for route_baselines" ON public.route_baselines FOR INSERT TO public WITH CHECK (true);

-- Function to calculate distance between two points (Haversine formula)
CREATE OR REPLACE FUNCTION calculate_distance_km(
  lat1 DOUBLE PRECISION,
  lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  dlat DOUBLE PRECISION;
  dlon DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
  earth_radius_km DOUBLE PRECISION := 6371;
BEGIN
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);

  a := sin(dlat/2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)^2;
  c := 2 * atan2(sqrt(a), sqrt(1-a));

  RETURN earth_radius_km * c;
END;
$$;

-- Function to aggregate route shapes from GTFS shapes
CREATE OR REPLACE FUNCTION aggregate_route_shapes()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  route_record RECORD;
  shape_coords JSONB;
  total_distance DOUBLE PRECISION;
  start_stop TEXT;
  end_stop TEXT;
BEGIN
  -- Clear existing aggregated data
  TRUNCATE TABLE public.route_shapes;

  -- Aggregate shapes for each route
  FOR route_record IN
    SELECT DISTINCT
      r.route_id,
      r.route_long_name,
      t.shape_id
    FROM public.gtfs_routes r
    JOIN public.gtfs_trips t ON r.route_id = t.route_id
    WHERE t.shape_id IS NOT NULL
  LOOP
    -- Get shape coordinates ordered by sequence
    SELECT jsonb_agg(
      jsonb_build_array(s.shape_pt_lon, s.shape_pt_lat)
      ORDER BY s.shape_pt_sequence
    ) INTO shape_coords
    FROM public.gtfs_shapes s
    WHERE s.shape_id = route_record.shape_id;

    -- Calculate total distance
    SELECT SUM(
      calculate_distance_km(
        lag.shape_pt_lat, lag.shape_pt_lon,
        curr.shape_pt_lat, curr.shape_pt_lon
      )
    ) INTO total_distance
    FROM (
      SELECT shape_pt_lat, shape_pt_lon,
             ROW_NUMBER() OVER (ORDER BY shape_pt_sequence) as rn
      FROM public.gtfs_shapes
      WHERE shape_id = route_record.shape_id
    ) curr
    LEFT JOIN (
      SELECT shape_pt_lat, shape_pt_lon,
             ROW_NUMBER() OVER (ORDER BY shape_pt_sequence) as rn
      FROM public.gtfs_shapes
      WHERE shape_id = route_record.shape_id
    ) lag ON curr.rn = lag.rn + 1;

    -- Get start and end stops (simplified)
    SELECT stop_name INTO start_stop
    FROM public.gtfs_stops
    LIMIT 1;

    SELECT stop_name INTO end_stop
    FROM public.gtfs_stops
    ORDER BY stop_id DESC
    LIMIT 1;

    -- Insert aggregated route shape
    INSERT INTO public.route_shapes (
      route_id, route_name, shape_points,
      total_distance_km, start_stop_name, end_stop_name
    ) VALUES (
      route_record.route_id,
      COALESCE(route_record.route_long_name, route_record.route_id),
      shape_coords,
      total_distance,
      start_stop,
      end_stop
    );
  END LOOP;
END;
$$;

-- Function to update route baselines from historical data
CREATE OR REPLACE FUNCTION update_route_baselines()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  baseline_record RECORD;
BEGIN
  -- Calculate baselines from last 7 days of bus data
  FOR baseline_record IN
    SELECT
      route_id,
      AVG(speed) as avg_speed,
      AVG(EXTRACT(EPOCH FROM (timestamp - LAG(timestamp) OVER (PARTITION BY bus_number ORDER BY timestamp)))) / 60 as avg_travel_time_minutes,
      COUNT(*) as trips_count
    FROM public.bus_data
    WHERE timestamp >= NOW() - INTERVAL '7 days'
      AND route_id IS NOT NULL
      AND speed > 0
    GROUP BY route_id
  LOOP
    INSERT INTO public.route_baselines (
      route_id, avg_speed_kmh, avg_travel_time_minutes, total_trips_analyzed, last_updated
    ) VALUES (
      baseline_record.route_id,
      baseline_record.avg_speed,
      baseline_record.avg_travel_time_minutes,
      baseline_record.trips_count,
      NOW()
    )
    ON CONFLICT (route_id) DO UPDATE SET
      avg_speed_kmh = EXCLUDED.avg_speed_kmh,
      avg_travel_time_minutes = EXCLUDED.avg_travel_time_minutes,
      total_trips_analyzed = EXCLUDED.total_trips_analyzed,
      last_updated = EXCLUDED.last_updated;
  END LOOP;
END;
$$;
