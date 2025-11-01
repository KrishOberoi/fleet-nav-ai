import { createClient } from '@supabase/supabase-js';
import { SyntheticHistoryGenerator } from '../src/services/syntheticHistoryGenerator';
import { SyntheticIncomeGenerator } from '../src/services/syntheticIncomeGenerator';
import { BusDataCollector } from '../src/services/dataCollector';
import { BaselineCalculator } from '../src/services/baselineCalculator';
import { DelayDetector } from '../src/services/delayDetector';
import { delhiRoutes } from '../src/lib/delhiRoutes';
import { busSimulator } from '../src/lib/busSimulator';

// Create Supabase client for scripts (not using Vite's import.meta.env)
const SUPABASE_URL = "https://ponecvgchpqwxbsddcen.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbmVjdmdjaHBxd3hic2RkY2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMDg0NDQsImV4cCI6MjA3NjU4NDQ0NH0.U6iKFy-PM2ljPDTVWAOmIKErhADsm8G3KEfJ9pzHgaw";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function initializeSystem() {
  console.log('🚀 Initializing fleet management system...');

  try {
    // Insert routes from simulation
    console.log('📍 Inserting routes...');
    const { data: insertedRoutes, error: routesError } = await supabase
      .from('routes')
      .insert(delhiRoutes.map(route => ({
        route_name: route.name,
        route_color: route.color,
        total_distance_km: route.distance || 15,
        waypoints: route.waypoints
      })))
      .select();

    if (routesError) {
      console.error('Error inserting routes:', routesError);
      return;
    }

    console.log(`✅ Inserted ${insertedRoutes.length} routes`);

    // Insert stops for each route
    console.log('🛑 Inserting stops...');
    for (const route of delhiRoutes) {
      const routeRecord = insertedRoutes.find(r => r.route_name === route.name);
      if (!routeRecord) continue;

      const stops = route.stops.map((stop, idx) => ({
        stop_name: stop.name,
        latitude: stop.lat,
        longitude: stop.lng,
        stop_order: idx,
        route_id: routeRecord.route_id
      }));

      const { error: stopsError } = await supabase
        .from('stops')
        .insert(stops);

      if (stopsError) {
        console.error(`Error inserting stops for route ${route.name}:`, stopsError);
      }
    }

    console.log('✅ Stops inserted');

    // Insert buses
    console.log('🚌 Inserting buses...');
    const buses = busSimulator.getBusData().map(b => ({
      bus_id: b.bus_number, // Use display bus number (DL001, DL002, etc.)
      route_id: insertedRoutes.find(r => r.route_name === b.route_name)?.route_id,
      capacity: b.capacity,
      status: 'active'
    }));

    const { error: busesError } = await supabase
      .from('buses')
      .insert(buses);

    if (busesError) {
      console.error('Error inserting buses:', busesError);
      return;
    }

    console.log(`✅ Inserted ${buses.length} buses`);

    // Generate synthetic history
    console.log('📊 Generating synthetic historical data...');
    await new SyntheticHistoryGenerator().generate10DaysHistory();

    // Generate synthetic income history
    console.log('💰 Generating synthetic income historical data...');
    await new SyntheticIncomeGenerator().generate10DaysIncomeHistory();

    // Start services
    console.log('⚙️ Starting background services...');

    // Start bus simulation
    busSimulator.start();

    // Start data collection every 90 seconds
    setInterval(() => new BusDataCollector().collectAndStoreReadings(), 90000);

    // Start baseline calculation every hour
    setInterval(() => new BaselineCalculator().computeHourlyBaselines(), 60 * 60 * 1000);

    // Start delay detection every 2 minutes
    setInterval(() => new DelayDetector().detectDelays(), 2 * 60 * 1000);

    console.log('✅ System initialization complete!');
    console.log('🎯 Services running:');
    console.log('   • Real-time data collection (every 90s)');
    console.log('   • Baseline calculation (every hour)');
    console.log('   • Delay detection (every 2 minutes)');
    console.log('   • Bus simulation (continuous)');

  } catch (error) {
    console.error('❌ Initialization failed:', error);
  }
}

// Run initialization
initializeSystem();
