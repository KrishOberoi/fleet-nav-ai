import { createClient } from '@supabase/supabase-js';
import { busSimulator } from '../lib/busSimulator';

// Create Supabase client for services
const SUPABASE_URL = "https://ponecvgchpqwxbsddcen.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbmVjdmdjaHBxd3hic2RkY2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMDg0NDQsImV4cCI6MjA3NjU4NDQ0NH0.U6iKFy-PM2ljPDTVWAOmIKErhADsm8G3KEfJ9pzHgaw";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export class BusDataCollector {

  async collectAndStoreReadings() {
    const buses = busSimulator.getBusData(); // Get from your existing simulator

    for (const bus of buses) {
      // Get route_id from bus details
      const busDetails = busSimulator.getBusDetails(bus.id);
      const routeId = busDetails?.routeId;

      if (!routeId) continue;

      await supabase.from('bus_realtime_readings').insert({
        bus_id: bus.bus_number, // Use display bus number (DL001, DL002, etc.)
        route_id: routeId,
        timestamp: new Date().toISOString(),
        latitude: bus.location.lat,
        longitude: bus.location.lng,
        speed_kmh: bus.speed,
        passenger_count: bus.passenger_count,
        total_distance_traveled_km: 0 // Placeholder
      });
    }

    console.log(`✅ Collected readings for ${buses.length} buses`);
  }
}

// Run every 90 seconds
setInterval(() => new BusDataCollector().collectAndStoreReadings(), 90000);
