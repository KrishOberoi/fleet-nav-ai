export interface RouteStop {
  name: string;
  lat: number;
  lng: number;
}

export interface RouteData {
  id: string;
  name: string;
  color: string;
  waypoints: [number, number][]; // [lng, lat][] for Mapbox
  stops: RouteStop[];
  distance: number; // km
  estimatedTime: number; // minutes
}

// Interpolation function to create smooth road-like paths
function interpolateRoute(stops: RouteStop[], pointsPerSegment: number = 8): [number, number][] {
  const waypoints: [number, number][] = [];

  for (let i = 0; i < stops.length - 1; i++) {
    const start = stops[i];
    const end = stops[i + 1];

    for (let j = 0; j < pointsPerSegment; j++) {
      const t = j / pointsPerSegment;

      // Linear interpolation
      const lat = start.lat + (end.lat - start.lat) * t;
      const lng = start.lng + (end.lng - start.lng) * t;

      // Add small random offset to simulate road curves (±0.001 degrees ≈ 100m)
      const offsetLat = (Math.random() - 0.5) * 0.001;
      const offsetLng = (Math.random() - 0.5) * 0.001;

      waypoints.push([lng + offsetLng, lat + offsetLat]);
    }
  }

  // Add the final stop
  const lastStop = stops[stops.length - 1];
  waypoints.push([lastStop.lng, lastStop.lat]);

  return waypoints;
}

// Calculate approximate distance between two points using Haversine formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Calculate total route distance
function calculateRouteDistance(waypoints: [number, number][]): number {
  let totalDistance = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const [lng1, lat1] = waypoints[i];
    const [lng2, lat2] = waypoints[i + 1];
    totalDistance += calculateDistance(lat1, lng1, lat2, lng2);
  }
  return Math.round(totalDistance * 10) / 10; // Round to 1 decimal
}

// Estimate travel time based on distance (assuming average speed of 25 km/h in city)
function estimateTravelTime(distance: number): number {
  const avgSpeedKmh = 25;
  const timeHours = distance / avgSpeedKmh;
  return Math.round(timeHours * 60); // Convert to minutes
}

// Define the 5 major Delhi bus routes with realistic stops
const routeDefinitions: Omit<RouteData, 'waypoints' | 'distance' | 'estimatedTime'>[] = [
  {
    id: 'route-1',
    name: 'Central Delhi Loop',
    color: '#FF5733',
    stops: [
      { name: 'Kashmere Gate', lat: 28.6672, lng: 77.2297 },
      { name: 'Red Fort', lat: 28.6562, lng: 77.2410 },
      { name: 'Chandni Chowk', lat: 28.6507, lng: 77.2340 },
      { name: 'Connaught Place', lat: 28.6328, lng: 77.2177 },
      { name: 'India Gate', lat: 28.6129, lng: 77.2295 },
      { name: 'Nehru Place', lat: 28.5494, lng: 77.2502 }
    ]
  },
  {
    id: 'route-2',
    name: 'East Delhi Corridor',
    color: '#33FF57',
    stops: [
      { name: 'ISBT', lat: 28.6692, lng: 77.2307 },
      { name: 'ITO', lat: 28.6289, lng: 77.2502 },
      { name: 'Mayur Vihar', lat: 28.6100, lng: 77.3000 },
      { name: 'Preet Vihar', lat: 28.6200, lng: 77.3200 },
      { name: 'Laxmi Nagar', lat: 28.6300, lng: 77.3300 }
    ]
  },
  {
    id: 'route-3',
    name: 'West Delhi Line',
    color: '#3357FF',
    stops: [
      { name: 'Dwarka', lat: 28.5921, lng: 77.0469 },
      { name: 'Rajouri Garden', lat: 28.6410, lng: 77.1211 },
      { name: 'Karol Bagh', lat: 28.6519, lng: 77.1905 },
      { name: 'Chandni Chowk', lat: 28.6507, lng: 77.2340 }
    ]
  },
  {
    id: 'route-4',
    name: 'South Delhi Route',
    color: '#FF33F5',
    stops: [
      { name: 'Nehru Place', lat: 28.5494, lng: 77.2502 },
      { name: 'Kalkaji', lat: 28.5600, lng: 77.2550 },
      { name: 'AIIMS', lat: 28.5672, lng: 77.2090 },
      { name: 'INA', lat: 28.5745, lng: 77.2108 },
      { name: 'Connaught Place', lat: 28.6328, lng: 77.2177 }
    ]
  },
  {
    id: 'route-5',
    name: 'North Delhi Express',
    color: '#F5FF33',
    stops: [
      { name: 'Jahangirpuri', lat: 28.7000, lng: 77.2500 },
      { name: 'Azadpur', lat: 28.6950, lng: 77.2550 },
      { name: 'Model Town', lat: 28.6900, lng: 77.2600 },
      { name: 'Kashmere Gate', lat: 28.6672, lng: 77.2297 }
    ]
  }
];

// Generate complete route data with interpolated waypoints
export const delhiRoutes: RouteData[] = routeDefinitions.map(route => {
  const waypoints = interpolateRoute(route.stops, 12); // 12 points per segment for smoother curves
  const distance = calculateRouteDistance(waypoints);
  const estimatedTime = estimateTravelTime(distance);

  return {
    ...route,
    waypoints,
    distance,
    estimatedTime
  };
});

// Helper functions for route management
export function getRouteById(id: string): RouteData | undefined {
  return delhiRoutes.find(route => route.id === id);
}

export function getAllRoutes(): RouteData[] {
  return delhiRoutes;
}

export function getRouteStops(routeId: string): RouteStop[] {
  const route = getRouteById(routeId);
  return route ? route.stops : [];
}

export function getRouteWaypoints(routeId: string): [number, number][] {
  const route = getRouteById(routeId);
  return route ? route.waypoints : [];
}

// Get a random route for bus assignment
export function getRandomRoute(): RouteData {
  return delhiRoutes[Math.floor(Math.random() * delhiRoutes.length)];
}

// Calculate progress percentage along route
export function getRouteProgress(routeId: string, waypointIndex: number): number {
  const route = getRouteById(routeId);
  if (!route) return 0;

  return Math.round((waypointIndex / route.waypoints.length) * 100);
}

// Get position at specific waypoint index
export function getPositionAtWaypoint(routeId: string, waypointIndex: number): [number, number] | null {
  const route = getRouteById(routeId);
  if (!route || waypointIndex < 0 || waypointIndex >= route.waypoints.length) {
    return null;
  }

  return route.waypoints[waypointIndex];
}
