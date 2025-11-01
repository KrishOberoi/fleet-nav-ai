import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ponecvgchpqwxbsddcen.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbmVjdmdjaHBxd3hic2RkY2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMDg0NDQsImV4cCI6MjA3NjU4NDQ0NH0.U6iKFy-PM2ljPDTVWAOmIKErhADsm8G3KEfJ9pzHgaw";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export class SyntheticIncomeGenerator {

  async generate10DaysIncomeHistory() {
    console.log('💰 Generating 10 days of income history...');

    const { data: routes } = await supabase.from('routes').select('*');
    const { data: buses } = await supabase.from('buses').select('*');

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 10 * 24 * 60 * 60 * 1000);

    for (let day = 0; day < 10; day++) {
      const currentDate = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
      const jsDayOfWeek = currentDate.getDay(); // JavaScript: 0=Sunday
      const dbDayOfWeek = (jsDayOfWeek + 6) % 7; // Database: 0=Monday
      const isWeekend = jsDayOfWeek === 0 || jsDayOfWeek === 6; // Still use JS day for weekend check

      for (let hour = 0; hour < 24; hour++) {
        for (const bus of buses) {
          const route = routes.find(r => r.route_id === bus.route_id);

          const incomeMetrics = this.generateRealisticIncomeMetrics(
            hour,
            jsDayOfWeek,
            isWeekend,
            route
          );

          // Update existing hourly_baselines record with income data
          await supabase
            .from('hourly_baselines')
            .upsert({
              route_id: bus.route_id,
              bus_id: bus.bus_id,
              hour_of_day: hour,
              day_of_week: dbDayOfWeek, // Use database day numbering
              avg_income_per_hour: incomeMetrics.income,
              avg_ticket_price: incomeMetrics.avgTicket,
              avg_passengers_per_trip: incomeMetrics.passengers,
              total_trips: incomeMetrics.trips,
              is_synthetic: true,
              last_updated: new Date(currentDate.getTime() + hour * 60 * 60 * 1000).toISOString()
            }, {
              onConflict: 'route_id,bus_id,hour_of_day,day_of_week'
            });
        }
      }

      console.log(`✅ Generated income day ${day + 1}/10`);
    }

    console.log('✅ Income history generation complete!');
  }

  generateRealisticIncomeMetrics(hour: number, dayOfWeek: number, isWeekend: boolean, route: any) {
    const isMorningRush = hour >= 7 && hour <= 9;
    const isEveningRush = hour >= 17 && hour <= 19;
    const isNight = hour >= 22 || hour <= 5;

    let baseIncome = 200; // ₹200 per hour base
    let avgTicket = 15; // ₹15 average
    let passengers = 20;
    let trips = 4; // 4 trips per hour

    if (isWeekend) {
      baseIncome *= 0.7;
      passengers *= 0.6;
    }

    if (isMorningRush && !isWeekend) {
      baseIncome *= 3;
      passengers *= 2.5;
      avgTicket *= 1.2; // Longer distances during rush
      trips *= 1.5;
    } else if (isEveningRush && !isWeekend) {
      baseIncome *= 2.8;
      passengers *= 2.2;
      avgTicket *= 1.15;
      trips *= 1.4;
    } else if (isNight) {
      baseIncome *= 0.3;
      passengers *= 0.3;
      avgTicket *= 0.9;
      trips *= 0.5;
    }

    // Add randomness ±15%
    const variance = 0.15;
    const income = baseIncome * (1 + (Math.random() - 0.5) * variance);
    const ticket = avgTicket * (1 + (Math.random() - 0.5) * variance);
    const pass = passengers * (1 + (Math.random() - 0.5) * variance);

    return {
      income: Math.round(income),
      avgTicket: Math.round(ticket * 10) / 10,
      passengers: Math.round(pass),
      trips: Math.round(trips)
    };
  }
}
