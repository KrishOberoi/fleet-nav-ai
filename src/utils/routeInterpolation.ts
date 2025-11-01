import { RouteData, getRouteById } from '@/lib/delhiRoutes';

export interface InterpolatedPosition {
  lat: number;
  lng: number;
  bearing?: number; // Direction in degrees (0-360)
}

// Calculate bearing between two points
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;

  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360; // Normalize to 0-360 degrees
}

// Calculate distance between two points in meters
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Interpolate position between two waypoints based on time and speed
export function interpolatePosition(
  startPos: [number, number], // [lng, lat]
  endPos: [number, number],   // [lng, lat]
  progress: number,           // 0-1 (0 = start, 1 = end)
  speedKmh: number           // Current speed in km/h
): InterpolatedPosition {
  const [startLng, startLat] = startPos;
  const [endLng, endLat] = endPos;

  // Smooth interpolation using easing function for more natural movement
  const easedProgress = easeInOutQuad(progress);

  // Linear interpolation
  const lat = startLat + (endLat - startLat) * easedProgress;
  const lng = startLng + (endLng - startLng) * easedProgress;

  // Calculate bearing (direction)
  const bearing = calculateBearing(startLat, startLng, endLat, endLng);

  return {
    lat,
    lng,
    bearing
  };
}

// Easing function for smooth acceleration/deceleration
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Calculate time to travel between two waypoints at given speed
export function calculateTravelTime(
  startPos: [number, number],
  endPos: [number, number],
  speedKmh: number
): number {
  const distance = calculateDistance(startPos[1], startPos[0], endPos[1], endPos[0]);
  const distanceKm = distance / 1000;
  const timeHours = distanceKm / speedKmh;
  return timeHours * 3600; // Convert to seconds
}

// Get smooth position for bus based on current waypoint and progress
export function getSmoothBusPosition(
  routeId: string,
  currentWaypointIndex: number,
  progressToNext: number, // 0-1 progress to next waypoint
  speedKmh: number
): InterpolatedPosition | null {
  const route = getRouteById(routeId);
  if (!route) return null;

  const waypoints = route.waypoints;

  // If at the last waypoint, return its position
  if (currentWaypointIndex >= waypoints.length - 1) {
    const [lng, lat] = waypoints[waypoints.length - 1];
    return { lat, lng };
  }

  // If at the first waypoint and progress is 0, return its position
  if (currentWaypointIndex === 0 && progressToNext === 0) {
    const [lng, lat] = waypoints[0];
    return { lat, lng };
  }

  const currentPos = waypoints[currentWaypointIndex];
  const nextPos = waypoints[currentWaypointIndex + 1];

  if (!currentPos || !nextPos) return null;

  return interpolatePosition(currentPos, nextPos, progressToNext, speedKmh);
}

// Calculate progress along route segment based on time elapsed and speed
export function calculateSegmentProgress(
  startPos: [number, number],
  endPos: [number, number],
  timeElapsed: number, // seconds
  speedKmh: number
): number {
  const totalTime = calculateTravelTime(startPos, endPos, speedKmh);
  if (totalTime === 0) return 1;

  const progress = timeElapsed / totalTime;
  return Math.min(1, Math.max(0, progress));
}

// Smooth transition between waypoints with time-based interpolation
export class RouteInterpolator {
  private lastUpdateTime: number = Date.now();
  private currentSegmentStartTime: number = Date.now();
  private segmentProgress: number = 0;

  // Update interpolation state
  update(currentWaypointIndex: number, speedKmh: number, routeId: string): InterpolatedPosition | null {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000; // seconds
    this.lastUpdateTime = now;

    const route = getRouteById(routeId);
    if (!route) return null;

    const waypoints = route.waypoints;

    // Reset segment progress when moving to new waypoint
    if (currentWaypointIndex !== Math.floor(this.segmentProgress)) {
      this.currentSegmentStartTime = now;
      this.segmentProgress = currentWaypointIndex;
    }

    // Calculate progress within current segment
    const segmentTimeElapsed = (now - this.currentSegmentStartTime) / 1000;
    const currentPos = waypoints[Math.floor(this.segmentProgress)];
    const nextPos = waypoints[Math.ceil(this.segmentProgress)];

    if (!currentPos || !nextPos) {
      // At end of route
      const [lng, lat] = waypoints[waypoints.length - 1];
      return { lat, lng };
    }

    const progress = calculateSegmentProgress(currentPos, nextPos, segmentTimeElapsed, speedKmh);
    this.segmentProgress = currentWaypointIndex + progress;

    return interpolatePosition(currentPos, nextPos, progress, speedKmh);
  }

  // Reset interpolator state
  reset(): void {
    this.lastUpdateTime = Date.now();
    this.currentSegmentStartTime = Date.now();
    this.segmentProgress = 0;
  }
}

// Utility function to create smooth path for visualization
export function createSmoothPath(waypoints: [number, number][], smoothingFactor: number = 0.5): [number, number][] {
  if (waypoints.length < 3) return waypoints;

  const smoothed: [number, number][] = [];
  smoothed.push(waypoints[0]); // Keep first point

  for (let i = 1; i < waypoints.length - 1; i++) {
    const prev = waypoints[i - 1];
    const curr = waypoints[i];
    const next = waypoints[i + 1];

    // Apply smoothing
    const smoothedLng = curr[0] + smoothingFactor * ((prev[0] + next[0]) / 2 - curr[0]);
    const smoothedLat = curr[1] + smoothingFactor * ((prev[1] + next[1]) / 2 - curr[1]);

    smoothed.push([smoothedLng, smoothedLat]);
  }

  smoothed.push(waypoints[waypoints.length - 1]); // Keep last point
  return smoothed;
}

// Calculate optimal speed for smooth movement between waypoints
export function calculateOptimalSpeed(
  startPos: [number, number],
  endPos: [number, number],
  desiredUpdateInterval: number = 3 // seconds
): number {
  const distance = calculateDistance(startPos[1], startPos[0], endPos[1], endPos[0]);
  const distanceKm = distance / 1000;
  const timeHours = desiredUpdateInterval / 3600;
  return distanceKm / timeHours;
}
