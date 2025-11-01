import { createClient } from '@supabase/supabase-js';
import { busSimulator } from '../lib/busSimulator';
import { passengerSimulator } from './passengerSimulator';

const SUPABASE_URL = "https://ponecvgchpqwxbsddcen.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbmVjdmdjaHBxd3hic2RkY2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMDg0NDQsImV4cCI6MjA3NjU4NDQ0NH0.U6iKFy-PM2ljPDTVWAOmIKErhADsm8G3KEfJ9pzHgaw";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Mapping from simulator route IDs to database UUIDs
const routeIdMapping: Record<string, string> = {
  'route-1': 'd6697226-e9a7-42ba-bed8-d670922bdaf7', // Central Delhi Loop
  'route-2': 'c2229e80-81f5-4c11-99b9-45ff45c20c86', // East Delhi Corridor
  'route-3': 'dafe766a-e6e1-4ef5-8fad-4089347ef80d', // West Delhi Line
  'route-4': '6f859452-d307-4892-9e23-453379679487', // South Delhi Route
  'route-5': '8f582d55-bb4a-4434-a5f4-8cb7bb6fb2d9'  // North Delhi Express
};

export class RealtimeDataInjector {

  async injectCurrentReadings() {
    const buses = busSimulator.getBusData(); // Get current bus states from simulator

    console.log(`📊 Injecting ${buses.length} bus readings...`);

    const readings = buses.map(bus => {
      // Get route_id from bus details and map to database UUID
      const busDetails = busSimulator.getBusDetails(bus.id);
      const simulatorRouteId = busDetails?.routeId;
      const routeId = routeIdMapping[simulatorRouteId] || simulatorRouteId;

      return {
        bus_id: bus.bus_number, // Use display bus number (DL001, DL002, etc.)
        route_id: routeId,
        timestamp: new Date().toISOString(),
        latitude: bus.location.lat,
        longitude: bus.location.lng,
        speed_kmh: bus.speed,
        passenger_count: bus.passenger_count,
        total_distance_traveled_km: 0 // Placeholder
      };
    });

    const { data, error } = await supabase
      .from('bus_realtime_readings')
      .insert(readings);

    if (error) {
      console.error('❌ Failed to inject readings:', error);
    } else {
      console.log(`✅ Injected ${readings.length} readings`);
    }

    // Simulate passenger boarding/deboarding and income generation
    const busesWithRoutes = buses.map(bus => {
      const busDetails = busSimulator.getBusDetails(bus.id);
      const simulatorRouteId = busDetails?.routeId;
      const routeId = routeIdMapping[simulatorRouteId] || simulatorRouteId;

      return {
        id: bus.bus_number,
        route_id: routeId,
        location: bus.location
      };
    });

    for (const bus of busesWithRoutes) {
      await passengerSimulator.simulateBoardingDeboarding(bus);
    }

    console.log(`💰 Income simulation completed for ${busesWithRoutes.length} buses`);
  }

  startAutoInjection() {
    // Inject immediately
    this.injectCurrentReadings();

    // Then every 90 seconds
    setInterval(() => {
      this.injectCurrentReadings();
    }, 90000);

    console.log('🔄 Auto-injection started (90s interval)');
  }
}

export const dataInjector = new RealtimeDataInjector();
