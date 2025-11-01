import { BusData } from '@/types/bus';
import { RouteData, getRouteById, getPositionAtWaypoint, getRouteProgress } from './delhiRoutes';

export interface SimulatedBus extends BusData {
  routeId: string;
  currentWaypointIndex: number;
  direction: 1 | -1; // 1 for forward, -1 for reverse
  isStopped: boolean;
  stopTimeRemaining: number; // seconds
  baseSpeed: number; // km/h
  consecutiveZeroSpeedCount: number; // Track consecutive updates with speed 0
  currentStopName: string | null; // Name of the stop the bus is currently at
}

// Bus simulator class
export class BusSimulator {
  private buses: SimulatedBus[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private updateCallbacks: ((buses: BusData[]) => void)[] = [];
  private isRunning = false;

  constructor() {
    this.initializeBuses();
  }

  // Initialize 25 buses distributed across routes
  private initializeBuses(): void {
    const routes = ['route-1', 'route-2', 'route-3', 'route-4', 'route-5'];

    for (let i = 0; i < 25; i++) {
      const routeId = routes[i % routes.length];
      const route = getRouteById(routeId);

      if (!route) continue;

      // Distribute buses along the route
      const waypointIndex = Math.floor((i / 25) * route.waypoints.length);
      const position = getPositionAtWaypoint(routeId, waypointIndex);

      if (!position) continue;

      const bus: SimulatedBus = {
        id: `simulated-bus-${i + 1}`,
        bus_number: `DL${String(i + 1).padStart(3, '0')}`,
        route_name: route.name,
        routeId,
        location: {
          lat: position[1], // lat from [lng, lat]
          lng: position[0]  // lng from [lng, lat]
        },
        speed: 0,
        passenger_count: Math.floor(Math.random() * 40) + 10, // 10-50 passengers
        capacity: 60,
        timestamp: new Date().toISOString(),
        currentWaypointIndex: waypointIndex,
        direction: 1, // Start moving forward
        isStopped: false,
        stopTimeRemaining: 0,
        baseSpeed: 20 + Math.random() * 25, // 20-45 km/h base speed
        consecutiveZeroSpeedCount: 0,
        currentStopName: null
      };

      this.buses.push(bus);
    }
  }

  // Start the simulation
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.intervalId = setInterval(() => {
      this.updateBuses();
    }, 90000); // Update every 90 seconds

    console.log('Bus simulation started with', this.buses.length, 'buses');
  }

  // Stop the simulation
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('Bus simulation stopped');
  }

  // Update all buses
  private updateBuses(): void {
    const currentHour = new Date().getHours();
    const isPeakHour = (currentHour >= 8 && currentHour <= 10) || (currentHour >= 17 && currentHour <= 19);

    this.buses.forEach(bus => {
      this.updateBus(bus, isPeakHour);
    });

    // Notify callbacks with updated bus data
    this.notifyCallbacks();
  }

  // Update individual bus
  private updateBus(bus: SimulatedBus, isPeakHour: boolean): void {
    const route = getRouteById(bus.routeId);
    if (!route) return;

    // Handle stopped buses
    if (bus.isStopped) {
      bus.stopTimeRemaining -= 1; // 1 update cycle elapsed (90 seconds)

      if (bus.stopTimeRemaining <= 0) {
        bus.isStopped = false;
        bus.speed = bus.baseSpeed;

        // Update passenger count at stops (±5 passengers)
        const passengerChange = Math.floor(Math.random() * 11) - 5; // -5 to +5
        bus.passenger_count = Math.max(0, Math.min(bus.capacity || 60,
          bus.passenger_count + passengerChange));
      } else {
        bus.speed = 0;
      }

      // Update position even when stopped (slight drift)
      this.updateBusPosition(bus);
      return;
    }

    // Apply peak hour traffic effects
    let effectiveSpeed = bus.baseSpeed;
    if (isPeakHour) {
      effectiveSpeed *= 0.7; // 30% speed reduction during peak hours
    }

    // Add random speed variation (±10 km/h)
    const speedVariation = (Math.random() - 0.5) * 20; // -10 to +10
    effectiveSpeed += speedVariation;
    effectiveSpeed = Math.max(5, Math.min(60, effectiveSpeed)); // Clamp between 5-60 km/h

    const previousSpeed = bus.speed;
    bus.speed = Math.round(effectiveSpeed);

    // Track consecutive zero speeds for determining if bus is actually stopped
    if (bus.speed === 0) {
      bus.consecutiveZeroSpeedCount += 1;

      // Only flag as stopped after 2 consecutive zero-speed readings
      if (bus.consecutiveZeroSpeedCount >= 2 && !bus.isStopped) {
        bus.isStopped = true;
        bus.stopTimeRemaining = 1; // 1 update cycle stop (90 seconds)
      }
    } else {
      // Reset counter when speed becomes non-zero
      bus.consecutiveZeroSpeedCount = 0;
    }

    // Move bus along route (only if not stopped)
    if (!bus.isStopped) {
      this.moveBusAlongRoute(bus);
    }

    // Randomly stop buses (simulate stops, traffic lights, etc.) - very rare occurrence
    // Only non-stopped buses can be stopped, and only with very low probability
    if (!bus.isStopped && Math.random() < 0.008) { // 0.8% chance every 90 seconds (~1 stop per 3-4 minutes per bus)
      const stopDuration = Math.random() < 0.7 ? 1 : 2; // 70% chance for 90s stop, 30% chance for 180s stop
      bus.isStopped = true;
      bus.stopTimeRemaining = stopDuration;
      bus.speed = 0;
      console.log(`🛑 Bus ${bus.bus_number} stopped for ${stopDuration * 90} seconds`);
    }

    // Update timestamp
    bus.timestamp = new Date().toISOString();
  }

  // Move bus to next waypoint
  private moveBusAlongRoute(bus: SimulatedBus): void {
    const route = getRouteById(bus.routeId);
    if (!route) return;

    // Calculate next waypoint index
    let nextIndex = bus.currentWaypointIndex + bus.direction;

    // Handle route boundaries (reverse direction at ends)
    if (nextIndex >= route.waypoints.length) {
      nextIndex = route.waypoints.length - 2; // Go back one step
      bus.direction = -1; // Reverse direction
    } else if (nextIndex < 0) {
      nextIndex = 1; // Go forward one step
      bus.direction = 1; // Forward direction
    }

    bus.currentWaypointIndex = nextIndex;

    // Update position
    this.updateBusPosition(bus);
  }

  // Update bus position based on current waypoint
  private updateBusPosition(bus: SimulatedBus): void {
    const position = getPositionAtWaypoint(bus.routeId, bus.currentWaypointIndex);

    if (position) {
      // Add slight random movement to simulate GPS inaccuracy and smooth movement
      const jitterLat = (Math.random() - 0.5) * 0.0001; // ±5 meters
      const jitterLng = (Math.random() - 0.5) * 0.0001;

      bus.location.lat = position[1] + jitterLat;
      bus.location.lng = position[0] + jitterLng;

      // Check if bus is at a stop
      this.updateBusStopStatus(bus);
    }
  }

  // Check if bus is currently at or near a designated stop
  private updateBusStopStatus(bus: SimulatedBus): void {
    const route = getRouteById(bus.routeId);
    if (!route) return;

    // Find the closest stop to the bus's current position
    let closestStop: { name: string; distance: number } | null = null;

    for (const stop of route.stops) {
      const distance = this.calculateDistance(
        bus.location.lat, bus.location.lng,
        stop.lat, stop.lng
      );

      // Consider bus "at stop" if within 50 meters
      if (distance <= 0.05) { // 0.05 km = 50 meters
        if (!closestStop || distance < closestStop.distance) {
          closestStop = { name: stop.name, distance };
        }
      }
    }

    // Update current stop name
    bus.currentStopName = closestStop ? closestStop.name : null;
  }

  // Calculate distance between two points using Haversine formula
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Get current bus data (for external consumption)
  getBusData(): BusData[] {
    return this.buses.map(bus => ({
      id: bus.id,
      bus_number: bus.bus_number,
      route_name: bus.route_name,
      location: bus.location,
      speed: bus.speed,
      passenger_count: bus.passenger_count,
      capacity: bus.capacity,
      timestamp: bus.timestamp
    }));
  }

  // Get detailed bus info including route progress
  getBusDetails(busId: string): SimulatedBus | null {
    const bus = this.buses.find(b => b.id === busId);
    return bus || null;
  }

  // Get route progress for a bus
  getBusRouteProgress(busId: string): number {
    const bus = this.buses.find(b => b.id === busId);
    if (!bus) return 0;

    return getRouteProgress(bus.routeId, bus.currentWaypointIndex);
  }

  // Register callback for bus updates
  onUpdate(callback: (buses: BusData[]) => void): void {
    this.updateCallbacks.push(callback);
  }

  // Remove callback
  removeCallback(callback: (buses: BusData[]) => void): void {
    const index = this.updateCallbacks.indexOf(callback);
    if (index > -1) {
      this.updateCallbacks.splice(index, 1);
    }
  }

  // Notify all callbacks
  private notifyCallbacks(): void {
    const busData = this.getBusData();
    this.updateCallbacks.forEach(callback => {
      try {
        callback(busData);
      } catch (error) {
        console.error('Error in bus update callback:', error);
      }
    });
  }

  // Get simulation statistics
  getStats(): {
    totalBuses: number;
    activeBuses: number;
    stoppedBuses: number;
    averageSpeed: number;
    totalPassengers: number;
  } {
    const activeBuses = this.buses.filter(bus => !bus.isStopped);
    const stoppedBuses = this.buses.filter(bus => bus.isStopped);
    const averageSpeed = activeBuses.length > 0
      ? activeBuses.reduce((sum, bus) => sum + bus.speed, 0) / activeBuses.length
      : 0;
    const totalPassengers = this.buses.reduce((sum, bus) => sum + bus.passenger_count, 0);

    return {
      totalBuses: this.buses.length,
      activeBuses: activeBuses.length,
      stoppedBuses: stoppedBuses.length,
      averageSpeed: Math.round(averageSpeed * 10) / 10,
      totalPassengers
    };
  }

  // Cleanup
  destroy(): void {
    this.stop();
    this.updateCallbacks = [];
  }
}

// Singleton instance
export const busSimulator = new BusSimulator();
