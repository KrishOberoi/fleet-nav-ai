import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ponecvgchpqwxbsddcen.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbmVjdmdjaHBxd3hic2RkY2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMDg0NDQsImV4cCI6MjA3NjU4NDQ0NH0.U6iKFy-PM2ljPDTVWAOmIKErhADsm8G3KEfJ9pzHgaw";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export class ChatbotDataProvider {

  async handleQuery(query: string) {
    const q = query.toLowerCase().trim();

    console.log('🔍 Classifying query:', q);

    // Check for greetings first
    if (q.match(/^(hi|hello|hey|greetings|good morning|good afternoon|good evening)$/)) {
      return {
        message: "👋 Hello! I'm your bus fleet assistant. Ask me about:\n- Bus delays (e.g., 'Is bus DL001 delayed?')\n- Bus stops (e.g., 'What are DL001 stops?')\n- Fleet status (e.g., 'Which buses are delayed?')\n- Route analysis (e.g., 'What's the peak hour on Route Central Delhi Loop?')"
      };
    }

    // Bus stops query
    if (q.includes('stop') && (q.includes('how many') || q.includes('what are') || q.includes('list'))) {
      console.log('✅ Detected: bus_stops');
      return await this.getBusStops(query);
    }

    // Delay queries
    if ((q.includes('delay') || q.includes('late') || q.includes('taking more time')) && this.extractBusId(query)) {
      console.log('✅ Detected: bus_delay');
      return await this.getBusDelayInfo(query);
    }

    // Peak hours
    if (q.includes('peak') || q.includes('busiest')) {
      console.log('✅ Detected: peak_hours');
      return await this.getPeakHours(query);
    }

    // Which buses delayed
    if (q.includes('which') && (q.includes('delay') || q.includes('late'))) {
      console.log('✅ Detected: all_delays');
      return await this.getAllDelays();
    }

    // List all buses
    if ((q.includes('list') || q.includes('name') || q.includes('show') || q.includes('all')) && q.includes('bus')) {
      console.log('✅ Detected: list_buses');
      return await this.listAllBuses();
    }

    // Passenger info
    if (q.includes('passenger') || q.includes('crowded') || q.includes('full')) {
      console.log('✅ Detected: passenger_info');
      return await this.getPassengerInfo(query);
    }

    // Historical/trends
    if (q.includes('historical') || q.includes('performance') || q.includes('trend')) {
      console.log('✅ Detected: historical');
      return await this.getHistoricalPerformance(query);
    }

    // Default to general info
    console.log('⚠️ No specific intent detected, returning general info');
    return await this.getGeneralInsights();
  }

  async getBusDelayInfo(query: string) {
    const busId = this.extractBusId(query);
    if (!busId) return { error: 'Could not identify bus ID' };

    const { data: latest } = await supabase
      .from('bus_realtime_readings')
      .select('*, buses!inner(route_id), routes!inner(route_name)')
      .eq('bus_id', busId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (!latest) return { error: `No current data for bus ${busId}` };

    const hour = new Date(latest.timestamp).getHours();
    const day = new Date(latest.timestamp).getDay();

    // Try bus-specific baseline first
    let { data: baseline } = await supabase
      .from('hourly_baselines')
      .select('*')
      .eq('bus_id', busId)
      .eq('hour_of_day', hour)
      .eq('day_of_week', day)
      .maybeSingle();

    // Fallback to route-level baseline if bus-specific not found
    if (!baseline) {
      const { data: routeBaseline } = await supabase
        .from('hourly_baselines')
        .select('*')
        .eq('route_id', latest.route_id)
        .eq('hour_of_day', hour)
        .eq('day_of_week', day)
        .maybeSingle();

      baseline = routeBaseline;
    }

    if (!baseline) {
      return {
        busId,
        routeName: latest.routes.route_name,
        currentSpeed: latest.speed_kmh,
        currentPassengers: latest.passenger_count,
        message: `Bus ${busId} is currently traveling at ${latest.speed_kmh} km/h with ${latest.passenger_count} passengers. (No historical baseline available for this time/day yet)`
      };
    }

    const speedDeviation = ((baseline.avg_speed_kmh - latest.speed_kmh) / baseline.avg_speed_kmh * 100);
    const isDelayed = speedDeviation > 30;

    return {
      busId,
      routeName: latest.routes.route_name,
      isDelayed,
      currentSpeed: latest.speed_kmh,
      baselineSpeed: baseline.avg_speed_kmh,
      speedDeviation: speedDeviation.toFixed(1) + '%',
      currentPassengers: latest.passenger_count,
      baselinePassengers: baseline.avg_passenger_count,
      message: isDelayed
        ? `⚠️ Yes, bus ${busId} is delayed. Speed: ${latest.speed_kmh} km/h (${Math.abs(speedDeviation).toFixed(0)}% slower than baseline ${baseline.avg_speed_kmh.toFixed(1)} km/h)`
        : `✅ No, bus ${busId} is on schedule. Speed: ${latest.speed_kmh} km/h (baseline: ${baseline.avg_speed_kmh.toFixed(1)} km/h)`
    };
  }

  async getPeakHours(query: string) {
    const routeMatch = query.match(/route[- ]?([A-Z0-9]+)/i);
    const dayMatch = query.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);

    const routeName = routeMatch ? routeMatch[1] : null;
    const dayName = dayMatch ? dayMatch[1] : null;
    const dayOfWeek = this.dayNameToNumber(dayName);

    const { data: route } = await supabase
      .from('routes')
      .select('route_id, route_name')
      .ilike('route_name', `%${routeName}%`)
      .single();

    if (!route) return { error: `Route ${routeName} not found` };

    const { data: baselines } = await supabase
      .from('hourly_baselines')
      .select('*')
      .eq('route_id', route.route_id)
      .eq('day_of_week', dayOfWeek);

    const sortedByPassengers = [...baselines].sort((a, b) => b.avg_passenger_count - a.avg_passenger_count);
    const peakHours = sortedByPassengers.slice(0, 3);

    return {
      routeName: route.route_name,
      dayName: dayName || 'All days',
      peakHours: peakHours.map(h => ({
        hour: `${h.hour_of_day}:00`,
        passengers: h.avg_passenger_count.toFixed(0),
        speed: h.avg_speed_kmh.toFixed(1)
      })),
      message: `On ${dayName || 'typical days'}, Route ${routeName}'s peak hours are ${peakHours.map(h => `${h.hour_of_day}:00`).join(', ')}`
    };
  }

  async getAllDelays() {
    const currentHour = new Date().getHours();
    const dayOfWeek = new Date().getDay();

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: recentReadings } = await supabase
      .from('bus_realtime_readings')
      .select('*, buses!inner(route_id), routes!inner(route_name)')
      .gte('timestamp', fiveMinutesAgo)
      .order('timestamp', { ascending: false });

    if (!recentReadings || recentReadings.length === 0) {
      return {
        totalDelayed: 0,
        message: '⚠️ No recent bus data available. Buses may not be actively reporting.'
      };
    }

    const latestPerBus = new Map();
    for (const reading of recentReadings) {
      if (!latestPerBus.has(reading.bus_id)) {
        latestPerBus.set(reading.bus_id, reading);
      }
    }

    const delayedBuses = [];

    for (const [busId, reading] of latestPerBus) {
      const { data: baseline } = await supabase
        .from('hourly_baselines')
        .select('*')
        .eq('route_id', reading.route_id)
        .eq('hour_of_day', currentHour)
        .eq('day_of_week', dayOfWeek)
        .maybeSingle();

      if (baseline && reading.speed_kmh < baseline.avg_speed_kmh * 0.7) {
        const percentSlower = ((baseline.avg_speed_kmh - reading.speed_kmh) / baseline.avg_speed_kmh * 100);
        delayedBuses.push({
          busId: reading.bus_id,
          routeName: reading.routes.route_name,
          currentSpeed: reading.speed_kmh.toFixed(1),
          baselineSpeed: baseline.avg_speed_kmh.toFixed(1),
          percentSlower: percentSlower.toFixed(0) + '%'
        });
      }
    }

    return {
      totalDelayed: delayedBuses.length,
      totalActive: latestPerBus.size,
      delayedBuses,
      message: delayedBuses.length > 0
        ? `⚠️ ${delayedBuses.length} out of ${latestPerBus.size} active buses are delayed: ${delayedBuses.map(b => `${b.busId} (${b.percentSlower} slower)`).join(', ')}`
        : `✅ All ${latestPerBus.size} active buses are running on schedule.`
    };
  }

  dayNameToNumber(dayName: string): number {
    const days = { 'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6 };
    return days[dayName?.toLowerCase()] ?? new Date().getDay();
  }

  async getBusStops(query: string) {
    const busId = this.extractBusId(query);

    if (!busId) {
      return { error: 'Please specify a bus ID (e.g., DL001)' };
    }

    const { data: bus, error } = await supabase
      .from('buses')
      .select('*, routes(route_name, route_id)')
      .eq('bus_id', busId)
      .single();

    if (error || !bus) {
      return { error: `Bus ${busId} not found` };
    }

    const { data: stops } = await supabase
      .from('stops')
      .select('stop_name, stop_order, latitude, longitude')
      .eq('route_id', bus.routes.route_id)
      .order('stop_order');

    if (!stops || stops.length === 0) {
      return { error: `No stops found for bus ${busId}` };
    }

    return {
      busId,
      routeName: bus.routes?.route_name,
      stopCount: stops.length,
      stops: stops.map(s => ({
        name: s.stop_name,
        order: s.stop_order
      })),
      message: `Bus ${busId} on route "${bus.routes?.route_name}" has ${stops.length} stops: ${stops.map(s => s.stop_name).join(', ')}`
    };
  }

  extractBusId(query: string): string | null {
    const patterns = [
      /bus[- ]?(DL\d{3})/i,
      /bus[- ]?(DL[-]?\d{2}[-]?\d{4})/i,
      /(DL\d{3})/i,
      /(DL[-]?\d{2}[-]?\d{4})/i
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) return match[1].replace(/-+/g, '').toUpperCase();
    }

    return null;
  }

  async listAllBuses() {
    const { data: buses, error } = await supabase
      .from('buses')
      .select('bus_id, routes(route_name), status')
      .order('bus_id');

    if (error || !buses) {
      return { error: 'Failed to fetch bus list' };
    }

    const activeBuses = buses.filter(b => b.status === 'active');
    const maintenanceBuses = buses.filter(b => b.status === 'maintenance');

    const byRoute = {};
    for (const bus of activeBuses) {
      const routeName = bus.routes?.route_name || 'Unknown';
      if (!byRoute[routeName]) byRoute[routeName] = [];
      byRoute[routeName].push(bus.bus_id);
    }

    return {
      totalBuses: buses.length,
      activeBuses: activeBuses.length,
      maintenanceBuses: maintenanceBuses.length,
      busesByRoute: byRoute,
      allBusIds: activeBuses.map(b => b.bus_id),
      message: `Fleet has ${buses.length} buses (${activeBuses.length} active, ${maintenanceBuses.length} in maintenance). Active buses: ${activeBuses.map(b => b.bus_id).slice(0, 10).join(', ')}${activeBuses.length > 10 ? '...' : ''}`
    };
  }

  async getPassengerInfo(query: string) {
    const busId = this.extractBusId(query);

    if (busId) {
      const { data: latest } = await supabase
        .from('bus_realtime_readings')
        .select('*, buses!inner(route_id), routes!inner(route_name)')
        .eq('bus_id', busId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (!latest) return { error: `No current data for bus ${busId}` };

      return {
        busId,
        routeName: latest.routes.route_name,
        currentPassengers: latest.passenger_count,
        capacity: latest.buses.capacity || 50,
        utilizationPercent: ((latest.passenger_count / (latest.buses.capacity || 50)) * 100).toFixed(1),
        message: `Bus ${busId} currently has ${latest.passenger_count} passengers (${((latest.passenger_count / (latest.buses.capacity || 50)) * 100).toFixed(1)}% capacity).`
      };
    } else {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const { data: readings } = await supabase
        .from('bus_realtime_readings')
        .select('passenger_count, buses(capacity)')
        .gte('timestamp', fiveMinutesAgo);

      if (!readings || readings.length === 0) {
        return { error: 'No recent passenger data available' };
      }

      const totalPassengers = readings.reduce((sum, r) => sum + r.passenger_count, 0);
      const avgPassengers = totalPassengers / readings.length;
      const maxCapacity = readings.reduce((sum, r) => sum + (r.buses?.capacity || 50), 0);
      const utilizationPercent = ((totalPassengers / maxCapacity) * 100).toFixed(1);

      return {
        totalBuses: readings.length,
        totalPassengers,
        avgPassengers: avgPassengers.toFixed(1),
        utilizationPercent,
        message: `Fleet-wide: ${totalPassengers} passengers across ${readings.length} buses (${utilizationPercent}% of total capacity). Average ${avgPassengers.toFixed(1)} passengers per bus.`
      };
    }
  }

  async getHistoricalPerformance(query: string) {
    const busId = this.extractBusId(query);

    if (!busId) return { error: 'Could not identify bus ID' };

    const { data: bus } = await supabase
      .from('buses')
      .select('*, routes!inner(route_name)')
      .eq('bus_id', busId)
      .single();

    if (!bus) return { error: `Bus ${busId} not found` };

    const { data: baselines } = await supabase
      .from('hourly_baselines')
      .select('*')
      .eq('bus_id', busId)
      .order('hour_of_day');

    if (!baselines || baselines.length === 0) {
      return { error: `No historical data for bus ${busId}` };
    }

    const avgSpeed = baselines.reduce((sum, b) => sum + b.avg_speed_kmh, 0) / baselines.length;
    const avgPassengers = baselines.reduce((sum, b) => sum + b.avg_passenger_count, 0) / baselines.length;

    const peakHour = baselines.reduce((max, b) => b.avg_passenger_count > max.avg_passenger_count ? b : max);
    const fastestHour = baselines.reduce((max, b) => b.avg_speed_kmh > max.avg_speed_kmh ? b : max);

    return {
      busId,
      routeName: bus.routes.route_name,
      avgSpeed: avgSpeed.toFixed(1),
      avgPassengers: avgPassengers.toFixed(0),
      peakHour: `${peakHour.hour_of_day}:00 (${Math.round(peakHour.avg_passenger_count)} passengers)`,
      fastestHour: `${fastestHour.hour_of_day}:00 (${fastestHour.avg_speed_kmh.toFixed(1)} km/h)`,
      totalDataPoints: baselines.reduce((sum, b) => sum + b.sample_count, 0),
      message: `Bus ${busId} (${bus.routes.route_name}) historical performance: Avg speed ${avgSpeed.toFixed(1)} km/h, Avg passengers ${avgPassengers.toFixed(0)}. Peak hour: ${peakHour.hour_of_day}:00, Fastest: ${fastestHour.hour_of_day}:00`
    };
  }

  async getGeneralInsights() {
    const { data: alerts } = await supabase
      .from('delay_alerts')
      .select('*')
      .eq('resolved', false);

    const { data: buses } = await supabase
      .from('buses')
      .select('*');

    return {
      totalBuses: buses.length,
      activeAlerts: alerts.length,
      message: `Fleet status: ${buses.length} buses, ${alerts.length} active alerts. ${alerts.length === 0 ? 'All systems normal.' : 'Some delays detected.'}`
    };
  }
}
