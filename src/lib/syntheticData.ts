import { BusData } from '@/types/bus';

const ROUTES = ['Route A', 'Route B', 'Route C', 'Route D', 'Route E'];
const BUSES_PER_ROUTE = 4;
const TOTAL_BUSES = ROUTES.length * BUSES_PER_ROUTE;

// Base coordinates for bus routes (around a city center)
const BASE_LAT = 40.7128;
const BASE_LNG = -74.0060;

interface BusState {
  busNumber: string;
  route: string;
  basePosition: { lat: number; lng: number };
  direction: number; // angle in radians
  currentSpeed: number;
  passengerTrend: number;
}

let busStates: BusState[] = [];

function initializeBusStates() {
  busStates = [];
  for (let i = 0; i < ROUTES.length; i++) {
    for (let j = 0; j < BUSES_PER_ROUTE; j++) {
      const busNumber = `BUS-${String(i * BUSES_PER_ROUTE + j + 1).padStart(3, '0')}`;
      const route = ROUTES[i];
      
      // Distribute buses across different areas
      const routeOffset = i * 0.02;
      const busOffset = j * 0.015;
      
      busStates.push({
        busNumber,
        route,
        basePosition: {
          lat: BASE_LAT + routeOffset + (Math.random() - 0.5) * 0.01,
          lng: BASE_LNG + busOffset + (Math.random() - 0.5) * 0.01,
        },
        direction: Math.random() * Math.PI * 2,
        currentSpeed: 20 + Math.random() * 30,
        passengerTrend: Math.random(),
      });
    }
  }
}

export function generateBusData(): BusData[] {
  if (busStates.length === 0) {
    initializeBusStates();
  }

  const currentTime = new Date().toISOString();
  const buses: BusData[] = [];

  busStates.forEach((state, index) => {
    // Update position - simulate movement along route
    const speedFactor = state.currentSpeed / 100;
    const movementDistance = 0.0005 * speedFactor;
    
    state.basePosition.lat += Math.cos(state.direction) * movementDistance;
    state.basePosition.lng += Math.sin(state.direction) * movementDistance;
    
    // Occasionally change direction (simulate turns)
    if (Math.random() < 0.1) {
      state.direction += (Math.random() - 0.5) * Math.PI / 4;
    }
    
    // Vary speed realistically
    state.currentSpeed += (Math.random() - 0.5) * 10;
    state.currentSpeed = Math.max(0, Math.min(70, state.currentSpeed));
    
    // Simulate passenger boarding/alighting
    state.passengerTrend += (Math.random() - 0.5) * 0.1;
    state.passengerTrend = Math.max(0, Math.min(1, state.passengerTrend));

    const capacity = 50;
    const passengerCount = Math.floor(state.passengerTrend * capacity);
    const avgOccupancy = (passengerCount / capacity) * 100;
    
    // 10% chance of maintenance
    const isUnderMaintenance = Math.random() < 0.05;
    const operationalStatus = isUnderMaintenance 
      ? 'maintenance' 
      : state.currentSpeed < 5 
        ? 'idle' 
        : 'active';

    const avgSpeed = state.currentSpeed * 0.85; // Historical average slightly lower
    const totalJourneyTime = 60 + Math.random() * 40;
    const estimatedJourneyTime = 70 + Math.random() * 30;
    const delayTime = Math.max(0, totalJourneyTime - estimatedJourneyTime);

    buses.push({
      id: `${state.busNumber}-${Date.now()}-${index}`,
      timestamp: currentTime,
      bus_number: state.busNumber,
      route_name: state.route,
      location: {
        lat: state.basePosition.lat,
        lng: state.basePosition.lng,
      },
      speed: Math.round(state.currentSpeed),
      avg_speed: Math.round(avgSpeed),
      passenger_count: passengerCount,
      capacity,
      avg_occupancy: Math.round(avgOccupancy * 100) / 100,
      total_journey_time: Math.round(totalJourneyTime),
      estimated_journey_time: Math.round(estimatedJourneyTime),
      is_under_maintenance: isUnderMaintenance,
      operational_status: operationalStatus as 'active' | 'idle' | 'maintenance',
      total_moving_time: Math.round(totalJourneyTime * 0.7),
      total_stopping_time: Math.round(totalJourneyTime * 0.3),
      delay_time: Math.round(delayTime),
    });
  });

  return buses;
}

export function resetBusStates() {
  busStates = [];
}
