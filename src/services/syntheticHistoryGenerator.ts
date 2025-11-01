import { createClient } from '@supabase/supabase-js';

// Create Supabase client for services
const SUPABASE_URL = "https://ponecvgchpqwxbsddcen.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbmVjdmdjaHBxd3hic2RkY2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMDg0NDQsImV4cCI6MjA3NjU4NDQ0NH0.U6iKFy-PM2ljPDTVWAOmIKErhADsm8G3KEfJ9pzHgaw";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Convert JavaScript day (0=Sunday) to database day (0=Monday)
function getDbDayOfWeek(jsDay: number): number {
  // Convert: Monday=0, Tuesday=1, ..., Sunday=6
  return (jsDay + 6) % 7;
}

export class SyntheticHistoryGenerator {

  async generate10DaysHistory() {
    console.log('🔄 Generating 10 days of synthetic historical data...');

    const { data: routes } = await supabase.from('routes').select('*');
    const { data: buses } = await supabase.from('buses').select('*');

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 10 * 24 * 60 * 60 * 1000);

    for (let day = 0; day < 10; day++) {
      const currentDate = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
      const jsDayOfWeek = currentDate.getDay(); // JavaScript: 0=Sunday
      const dbDayOfWeek = getDbDayOfWeek(jsDayOfWeek); // Database: 0=Monday
      const isWeekend = jsDayOfWeek === 0 || jsDayOfWeek === 6; // Still use JS day for weekend check

      for (let hour = 0; hour < 24; hour++) {
        for (const bus of buses) {
          const route = routes.find(r => r.route_id === bus.route_id);
          const metrics = this.generateRealisticMetrics(hour, jsDayOfWeek, isWeekend, route);

          await supabase.from('hourly_baselines').insert({
            route_id: bus.route_id,
            bus_id: bus.bus_id,
            hour_of_day: hour,
            day_of_week: dbDayOfWeek, // Use database day numbering
            avg_speed_kmh: metrics.speed,
            avg_passenger_count: metrics.passengers,
            avg_distance_traveled_km: metrics.distance,
            sample_count: 40,
            is_synthetic: true,
            last_updated: new Date(currentDate.getTime() + hour * 60 * 60 * 1000).toISOString()
          });
        }
      }

      console.log(`✅ Generated day ${day + 1}/10`);
    }

    console.log('✅ Synthetic history complete!');
  }

  generateRealisticMetrics(hour: number, dayOfWeek: number, isWeekend: boolean, route: any) {
    const isMorningRush = hour >= 7 && hour <= 9;
    const isEveningRush = hour >= 17 && hour <= 19;
    const isNight = hour >= 22 || hour <= 5;

    let baseSpeed = 35;
    let basePassengers = 20;

    if (isWeekend) {
      baseSpeed += 5;
      basePassengers *= 0.6;
    }

    if (isMorningRush && !isWeekend) {
      baseSpeed *= 0.6;
      basePassengers *= 2.5;
    } else if (isEveningRush && !isWeekend) {
      baseSpeed *= 0.65;
      basePassengers *= 2.2;
    } else if (isNight) {
      baseSpeed *= 1.2;
      basePassengers *= 0.3;
    }

    const variation = 0.15;
    const speed = baseSpeed * (1 + (Math.random() - 0.5) * variation);
    const passengers = Math.max(0, Math.min(50, basePassengers * (1 + (Math.random() - 0.5) * variation)));
    const distance = route?.total_distance_km || 15;

    return {
      speed: Math.round(speed * 10) / 10,
      passengers: Math.round(passengers),
      distance: Math.round(distance * 10) / 10
    };
  }
}
