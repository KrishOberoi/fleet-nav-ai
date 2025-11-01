import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ponecvgchpqwxbsddcen.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbmVjdmdjaHBxd3hic2RkY2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMDg0NDQsImV4cCI6MjA3NjU4NDQ0NH0.U6iKFy-PM2ljPDTVWAOmIKErhADsm8G3KEfJ9pzHgaw";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Convert JavaScript day (0=Sunday) to database day (0=Monday)
function getDbDayOfWeek(): number {
  const jsDay = new Date().getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  // Convert: Monday=0, Tuesday=1, ..., Sunday=6
  return (jsDay + 6) % 7;
}

export class DatabaseRetriever {

  async getRelevantData(question: string): Promise<string> {
    const q = question.toLowerCase();
    let contextData = [];

    // Extract bus ID if mentioned
    const busIdMatch = question.match(/(DL\d{3})/i);
    const busId = busIdMatch ? busIdMatch[1].toUpperCase() : null;

    // Extract route name if mentioned
    const routeMatch = question.match(/(central|east|west|south|north|delhi|loop|corridor|line|route|express)/i);

    // Extract day if mentioned
    const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    let specificDay = null;

    // Check for day name
    for (let i = 0; i < dayNames.length; i++) {
      if (q.includes(dayNames[i])) {
        specificDay = i; // 0=Monday, 1=Tuesday, etc.
        break;
      }
    }

    // Check for "day X" format
    const dayNumMatch = q.match(/day\s+(\d)/);
    if (dayNumMatch) {
      specificDay = parseInt(dayNumMatch[1]);
    }

    // Check if asking about peak hours, trends, or time-related
    const isTimeQuery = q.includes('peak') || q.includes('hour') || q.includes('busiest') ||
                        q.includes('trend') || q.includes('average') || q.includes('performance');

    // Check if asking about income/revenue
    const isIncomeQuery = q.includes('income') || q.includes('revenue') ||
                          q.includes('earnings') || q.includes('ticket') ||
                          q.includes('generates') || q.includes('profitable') ||
                          q.includes('profit') || q.includes('money');

    // Always get recent bus data (last 5 minutes)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recentReadings } = await supabase
      .from('bus_realtime_readings')
      .select('*, buses(bus_id, route_id), routes(route_name)')
      .gte('timestamp', fiveMinAgo)
      .order('timestamp', { ascending: false })
      .limit(50);

    if (recentReadings && recentReadings.length > 0) {
      contextData.push({
        type: 'realtime_data',
        description: 'Current bus positions and metrics (last 5 minutes)',
        data: recentReadings.map(r => ({
          bus_id: r.bus_id,
          route: r.routes?.route_name,
          speed_kmh: r.speed_kmh,
          passengers: r.passenger_count,
          location: { lat: r.latitude, lng: r.longitude },
          timestamp: r.timestamp
        }))
      });
    }

    // If time-related query or specific day mentioned, fetch hourly baselines
    if (isTimeQuery || specificDay !== null) {
      console.log(`📊 Fetching historical baselines for day: ${specificDay ?? 'all days'}`);

      let baselineQuery = supabase
        .from('hourly_baselines')
        .select('*')
        .order('hour_of_day');

      // Filter by specific day if mentioned
      if (specificDay !== null) {
        baselineQuery = baselineQuery.eq('day_of_week', specificDay);
      }

      // Filter by route if mentioned
      if (routeMatch) {
        const { data: routes } = await supabase
          .from('routes')
          .select('route_id, route_name')
          .ilike('route_name', `%${routeMatch[1]}%`);

        if (routes && routes.length > 0) {
          baselineQuery = baselineQuery.eq('route_id', routes[0].route_id);
        }
      }

      const { data: baselines } = await baselineQuery.limit(200); // Get up to 200 baseline records

      if (baselines && baselines.length > 0) {
        contextData.push({
          type: 'hourly_baselines',
          description: `Historical hourly performance data${specificDay !== null ? ` for day ${specificDay} (${dayNames[specificDay]})` : ''}`,
          data: baselines,
          note: 'Each record shows average speed, passengers, and distance for a specific hour of day. Use this to identify peak hours (high passengers) and traffic patterns (low speed).'
        });

        console.log(`✅ Added ${baselines.length} baseline records to context`);
      } else {
        console.log('⚠️ No baseline data found');
      }
    }

    // If income-related query, fetch income data from hourly_baselines
    if (isIncomeQuery) {
      console.log('💰 Fetching income-related data');

      // Get current income totals for today (for "most profitable currently" questions)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: currentIncome } = await supabase
        .from('ticket_transactions')
        .select('bus_id, total_income')
        .gte('timestamp', today.toISOString());

      if (currentIncome && currentIncome.length > 0) {
        // Aggregate by bus
        const incomeByBus: Record<string, number> = {};
        currentIncome.forEach(item => {
          incomeByBus[item.bus_id] = (incomeByBus[item.bus_id] || 0) + item.total_income;
        });

        // Convert to array and sort by income
        const sortedIncome = Object.entries(incomeByBus)
          .map(([bus_id, total_income]) => ({ bus_id, total_income }))
          .sort((a, b) => b.total_income - a.total_income);

        contextData.push({
          type: 'current_income_totals',
          description: 'Today\'s income totals for all buses (for profitability analysis)',
          data: sortedIncome,
          note: 'Use this to determine which bus is most profitable currently. Higher total_income = more profitable.'
        });
      }

      // Get income baselines from hourly_baselines table
      let incomeQuery = supabase
        .from('hourly_baselines')
        .select('*')
        .not('avg_income_per_hour', 'is', null); // Only records with income data

      // Filter by specific day if mentioned
      if (specificDay !== null) {
        incomeQuery = incomeQuery.eq('day_of_week', specificDay);
      }

      const { data: incomeBaselines } = await incomeQuery
        .order('avg_income_per_hour', { ascending: false })
        .limit(100);

      if (incomeBaselines) {
        contextData.push({
          type: 'income_baselines',
          description: `Historical income data per bus/route/hour${specificDay !== null ? ` for ${dayNames[specificDay]}` : ''}`,
          data: incomeBaselines
        });
      }

      // Get stop pair income
      const { data: stopPairIncome } = await supabase
        .from('stop_pair_income')
        .select('*, stops_from:stops!from_stop_id(stop_name), stops_to:stops!to_stop_id(stop_name)')
        .order('total_income', { ascending: false })
        .limit(50);

      if (stopPairIncome) {
        contextData.push({
          type: 'stop_pair_income',
          description: 'Income generated between stop pairs',
          data: stopPairIncome
        });
      }

      // Get recent transactions
      const { data: recentTransactions } = await supabase
        .from('ticket_transactions')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (recentTransactions) {
        contextData.push({
          type: 'recent_transactions',
          description: 'Recent ticket transactions with prices and distances',
          data: recentTransactions
        });
      }
    }

    // If specific bus mentioned, get its details
    if (busId) {
      const { data: busInfo } = await supabase
        .from('buses')
        .select('*, routes(route_name)')
        .eq('bus_id', busId)
        .single();

      if (busInfo) {
        contextData.push({
          type: 'bus_details',
          description: `Details for bus ${busId}`,
          data: busInfo
        });

        // Get stops for this bus's route
        const { data: stops } = await supabase
          .from('stops')
          .select('*')
          .eq('route_id', busInfo.route_id)
          .order('stop_order');

        if (stops) {
          contextData.push({
            type: 'bus_stops',
            description: `Stops for bus ${busId}`,
            data: stops
          });
        }

        // Get historical baselines for this bus
        const { data: baselines } = await supabase
          .from('hourly_baselines')
          .select('*')
          .or(`bus_id.eq.${busId},route_id.eq.${busInfo.route_id}`)
          .order('hour_of_day')
          .limit(24);

        if (baselines) {
          contextData.push({
            type: 'historical_baselines',
            description: `Historical performance data for ${busId}`,
            data: baselines
          });
        }

        // If this is an income query, also get income baselines for this bus
        if (isIncomeQuery) {
          const { data: incomeBaselines } = await supabase
            .from('hourly_baselines')
            .select('*')
            .or(`bus_id.eq.${busId},route_id.eq.${busInfo.route_id}`)
            .not('avg_income_per_hour', 'is', null) // Only records with income data
            .order('avg_income_per_hour', { ascending: false })
            .limit(50);

          if (incomeBaselines) {
            contextData.push({
              type: 'bus_income_baselines',
              description: `Historical income data for ${busId}`,
              data: incomeBaselines
            });
          }
        }
      }
    }

    // Get active alerts
    const { data: alerts } = await supabase
      .from('delay_alerts')
      .select('*')
      .eq('resolved', false)
      .order('detected_at', { ascending: false })
      .limit(20);

    if (alerts && alerts.length > 0) {
      contextData.push({
        type: 'active_alerts',
        description: 'Current system alerts and delays',
        data: alerts
      });
    }

    // Get all routes if route-related question
    if (q.includes('route') || routeMatch) {
      const { data: routes } = await supabase
        .from('routes')
        .select('*');

      if (routes) {
        contextData.push({
          type: 'routes',
          description: 'All bus routes in system',
          data: routes
        });
      }
    }

    // Get all buses if general fleet question
    if (q.includes('all bus') || q.includes('fleet') || q.includes('how many')) {
      const { data: allBuses } = await supabase
        .from('buses')
        .select('bus_id, status, routes(route_name)')
        .order('bus_id');

      if (allBuses) {
        contextData.push({
          type: 'fleet_overview',
          description: 'Complete fleet information',
          data: allBuses
        });
      }
    }

    // Convert to string for LLM
    return JSON.stringify(contextData, null, 2);
  }
}

export const dbRetriever = new DatabaseRetriever();
