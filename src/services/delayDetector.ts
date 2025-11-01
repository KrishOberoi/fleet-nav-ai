import { createClient } from '@supabase/supabase-js';

// Create Supabase client for services
const SUPABASE_URL = "https://ponecvgchpqwxbsddcen.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbmVjdmdjaHBxd3hic2RkY2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMDg0NDQsImV4cCI6MjA3NjU4NDQ0NH0.U6iKFy-PM2ljPDTVWAOmIKErhADsm8G3KEfJ9pzHgaw";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export class DelayDetector {

  async detectDelays() {
    const currentHour = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const { data: recentReadings } = await supabase
      .from('bus_realtime_readings')
      .select('*')
      .gte('timestamp', fiveMinutesAgo.toISOString());

    for (const reading of recentReadings) {
      const { data: baseline } = await supabase
        .from('hourly_baselines')
        .select('*')
        .eq('bus_id', reading.bus_id)
        .eq('hour_of_day', currentHour)
        .eq('day_of_week', dayOfWeek)
        .single();

      if (!baseline) continue;

      // Check for speed anomaly (30% slower)
      if (reading.speed_kmh < baseline.avg_speed_kmh * 0.7) {
        await supabase.from('delay_alerts').insert({
          bus_id: reading.bus_id, // This should be the display bus number
          route_id: reading.route_id,
          alert_type: 'delay',
          severity: 'high',
          message: `Bus ${reading.bus_id} delayed - ${reading.speed_kmh} km/h (baseline: ${baseline.avg_speed_kmh.toFixed(1)})`,
          current_value: reading.speed_kmh,
          baseline_value: baseline.avg_speed_kmh,
          deviation_percentage: ((baseline.avg_speed_kmh - reading.speed_kmh) / baseline.avg_speed_kmh * 100)
        });
      }

      // Check for passenger surge (200% above baseline)
      if (reading.passenger_count > baseline.avg_passenger_count * 2) {
        await supabase.from('delay_alerts').insert({
          bus_id: reading.bus_id,
          route_id: reading.route_id,
          alert_type: 'passenger_surge',
          severity: 'medium',
          message: `Bus ${reading.bus_id} passenger surge - ${reading.passenger_count} (baseline: ${baseline.avg_passenger_count.toFixed(0)})`,
          current_value: reading.passenger_count,
          baseline_value: baseline.avg_passenger_count,
          deviation_percentage: ((reading.passenger_count - baseline.avg_passenger_count) / baseline.avg_passenger_count * 100)
        });
      }
    }
  }
}

// Run every 2 minutes
setInterval(() => new DelayDetector().detectDelays(), 2 * 60 * 1000);
