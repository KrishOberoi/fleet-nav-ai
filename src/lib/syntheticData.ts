import { BusData } from '@/types/bus';

// Actual bus routes around Manipal/Udupi area
const ROUTES = [
  'Manipal ↔ Udupi',
  'Manipal ↔ Mangalore',
  'Udupi ↔ Mangalore',
  'Manipal ↔ Bangalore',
  'Udupi ↔ Bangalore',
  'Manipal ↔ Kundapur',
  'Udupi ↔ Kundapur',
  'Manipal Local',
  'Udupi Local',
  'Manipal ↔ Shivamogga'
];
const BUSES_PER_ROUTE = 3;
const TOTAL_BUSES = ROUTES.length * BUSES_PER_ROUTE;

// Base coordinates for Manipal/Udupi region
const MANIPAL_LAT = 13.3525;
const MANIPAL_LNG = 74.7928;
const UDUPI_LAT = 13.3409;
const UDUPI_LNG = 74.7421;

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

  // Route-specific starting positions and directions
  const routeConfigs = [
    // Manipal ↔ Udupi (local route)
    { startLat: MANIPAL_LAT, startLng: MANIPAL_LNG, direction: 4.2 }, // West towards Udupi
    // Manipal ↔ Mangalore (south)
    { startLat: MANIPAL_LAT, startLng: MANIPAL_LNG, direction: 5.5 }, // Southwest
    // Udupi ↔ Mangalore (southwest)
    { startLat: UDUPI_LAT, startLng: UDUPI_LNG, direction: 5.2 }, // Southwest
    // Manipal ↔ Bangalore (east)
    { startLat: MANIPAL_LAT, startLng: MANIPAL_LNG, direction: 1.8 }, // East
    // Udupi ↔ Bangalore (east)
    { startLat: UDUPI_LAT, startLng: UDUPI_LNG, direction: 1.6 }, // East
    // Manipal ↔ Kundapur (north)
    { startLat: MANIPAL_LAT, startLng: MANIPAL_LNG, direction: 2.8 }, // North
    // Udupi ↔ Kundapur (north)
    { startLat: UDUPI_LAT, startLng: UDUPI_LNG, direction: 3.0 }, // North
    // Manipal Local (around Manipal)
    { startLat: MANIPAL_LAT, startLng: MANIPAL_LNG, direction: Math.random() * Math.PI * 2 },
    // Udupi Local (around Udupi)
    { startLat: UDUPI_LAT, startLng: UDUPI_LNG, direction: Math.random() * Math.PI * 2 },
    // Manipal ↔ Shivamogga (northeast)
    { startLat: MANIPAL_LAT, startLng: MANIPAL_LNG, direction: 0.8 }, // Northeast
  ];

  for (let i = 0; i < ROUTES.length; i++) {
    const routeConfig = routeConfigs[i];
    for (let j = 0; j < BUSES_PER_ROUTE; j++) {
      const busNumber = `BUS-${String(i * BUSES_PER_ROUTE + j + 1).padStart(3, '0')}`;
      const route = ROUTES[i];

      // Position buses along their routes with some variation
      const positionOffset = j * 0.008; // Spread buses along route
      const randomOffset = (Math.random() - 0.5) * 0.005; // Small random variation

      busStates.push({
        busNumber,
        route,
        basePosition: {
          lat: routeConfig.startLat + Math.cos(routeConfig.direction) * positionOffset + randomOffset,
          lng: routeConfig.startLng + Math.sin(routeConfig.direction) * positionOffset + randomOffset,
        },
        direction: routeConfig.direction + (Math.random() - 0.5) * 0.5, // Slight direction variation
        currentSpeed: 15 + Math.random() * 35, // More realistic speeds for Indian roads
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

    // ESP32 sensor data only
    buses.push({
      id: `${state.busNumber}-${Date.now()}-${index}`,
      bus_number: state.busNumber,
      route_name: state.route,
      location: {
        lat: state.basePosition.lat,
        lng: state.basePosition.lng,
      },
      speed: Math.round(state.currentSpeed),
      passenger_count: passengerCount,
      timestamp: currentTime,
      capacity, // Optional static config
    });
  });

  return buses;
}

export function resetBusStates() {
  busStates = [];
}
