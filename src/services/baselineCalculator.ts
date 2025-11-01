import { createClient } from '@supabase/supabase-js';

// Create Supabase client for services
const SUPABASE_URL = "https://ponecvgchpqwxbsddcen.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbmVjdmdjaHBxd3hic2RkY2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMDg0NDQsImV4cCI6MjA3NjU4NDQ0NH0.U6iKFy-PM2ljPDTVWAOmIKErhADsm8G3KEfJ9pzHgaw";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Convert JavaScript day (0=Sunday) to database day (0=Monday)
function getDbDayOfWeek(): number {
  const jsDay = new Date().getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  // Convert: Monday=0, Tuesday=1, ..., Sunday=6
  return (jsDay + 6) % 7;
}

export class BaselineCalculator {

  async computeHourlyBaselines() {
    const currentHour = new Date().getHours();
    const dayOfWeek = getDbDayOfWeek(); // Use database day numbering

    const { data: buses } = await supabase.from('buses').select('*');

    for (const bus of buses) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const { data: readings } = await supabase
        .from('bus_realtime_readings')
        .select('*')
        .eq('bus_id', bus.bus_id)
        .gte('timestamp', thirtyDaysAgo.toISOString());

      const filteredReadings = readings.filter(r => {
        const date = new Date(r.timestamp);
        const readingJsDay = date.getDay(); // Get JS day from reading timestamp
        const readingDbDay = (readingJsDay + 6) % 7; // Convert to DB day numbering
        return date.getHours() === currentHour && readingDbDay === dayOfWeek;
      });

      if (filteredReadings.length === 0) continue;

      const avgSpeed = filteredReadings.reduce((sum, r) => sum + r.speed_kmh, 0) / filteredReadings.length;
      const avgPassengers = filteredReadings.reduce((sum, r) => sum + r.passenger_count, 0) / filteredReadings.length;
      const avgDistance = filteredReadings.reduce((sum, r) => sum + r.total_distance_traveled_km, 0) / filteredReadings.length;

      await supabase.from('hourly_baselines').upsert({
        route_id: bus.route_id,
        bus_id: bus.bus_id, // This should be the display bus number
        hour_of_day: currentHour,
        day_of_week: dayOfWeek,
        avg_speed_kmh: avgSpeed,
        avg_passenger_count: avgPassengers,
        avg_distance_traveled_km: avgDistance,
        sample_count: filteredReadings.length,
        is_synthetic: false,
        last_updated: new Date().toISOString()
      }, { onConflict: 'route_id,bus_id,hour_of_day,day_of_week' });
    }

    console.log('✅ Baselines updated');
  }
}

// Run every hour
setInterval(() => new BaselineCalculator().computeHourlyBaselines(), 60 * 60 * 1000);
