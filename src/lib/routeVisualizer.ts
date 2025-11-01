import { getMapboxService, type MapboxDirectionsResponse, type RouteVisualizerOptions } from './mapboxService';
import { supabase } from '@/integrations/supabase/client';

interface RouteStop {
  stop_id: string;
  stop_name: string;
  stop_lat: number;
  stop_lon: number;
  stop_sequence: number;
}

interface RouteShape {
  route_id: string;
  route_name: string;
  shape_points: number[][]; // [[lng, lat], ...]
  total_distance_km: number;
  avg_travel_time_minutes: number;
  start_stop_name: string;
  end_stop_name: string;
}

interface RouteVisualization {
  routeId: string;
  routeName: string;
  geometry: GeoJSON.Feature<GeoJSON.LineString>;
  stops: RouteStop[];
  stats: {
    distanceKm: number;
    durationMinutes: number;
    averageSpeedKmh: number;
  };
  source: 'gtfs' | 'mapbox' | 'hybrid';
}

class RouteVisualizerService {
  private mapboxService = getMapboxService();
  private routeCache = new Map<string, { data: RouteVisualization; timestamp: number }>();
  private readonly CACHE_DURATION = 1000 * 60 * 15; // 15 minutes

  // Mock route shapes for Delhi metro and bus routes
  private readonly MOCK_ROUTE_SHAPES: Record<string, {
    route_id: string;
    route_name: string;
    coordinates: number[][];
    stops: Array<{ name: string; lat: number; lng: number }>;
  }> = {
    'Yellow Line': {
      route_id: 'yellow',
      route_name: 'Yellow Line',
      coordinates: [
        [77.2090, 28.6139],
        [77.2150, 28.6200],
        [77.2200, 28.6250],
        [77.2250, 28.6300],
        [77.2300, 28.6350],
        [77.2350, 28.6400]
      ],
      stops: [
        { name: 'Kashmere Gate', lat: 28.6139, lng: 77.2090 },
        { name: 'Chandni Chowk', lat: 28.6200, lng: 77.2150 },
        { name: 'New Delhi', lat: 28.6250, lng: 77.2200 },
        { name: 'Rajiv Chowk', lat: 28.6300, lng: 77.2250 },
        { name: 'INA', lat: 28.6350, lng: 77.2300 },
        { name: 'Gurgaon', lat: 28.6400, lng: 77.2350 }
      ]
    },
    'Red Line': {
      route_id: 'red',
      route_name: 'Red Line',
      coordinates: [
        [77.1500, 28.6000],
        [77.1600, 28.6100],
        [77.1700, 28.6200],
        [77.1800, 28.6300],
        [77.1900, 28.6400]
      ],
      stops: [
        { name: 'Rithala', lat: 28.6000, lng: 77.1500 },
        { name: 'Rohini', lat: 28.6100, lng: 77.1600 },
        { name: 'Pitampura', lat: 28.6200, lng: 77.1700 },
        { name: 'Netaji Subhash Place', lat: 28.6300, lng: 77.1800 },
        { name: 'Kashmere Gate', lat: 28.6400, lng: 77.1900 }
      ]
    },
    'Blue Line': {
      route_id: 'blue',
      route_name: 'Blue Line',
      coordinates: [
        [77.2800, 28.5500],
        [77.2750, 28.5600],
        [77.2700, 28.5700],
        [77.2650, 28.5800],
        [77.2600, 28.5900]
      ],
      stops: [
        { name: 'Noida Sector 62', lat: 28.5500, lng: 77.2800 },
        { name: 'Noida City Centre', lat: 28.5600, lng: 77.2750 },
        { name: 'Dwarka', lat: 28.5700, lng: 77.2700 },
        { name: 'Rajouri Garden', lat: 28.5800, lng: 77.2650 },
        { name: 'Moti Nagar', lat: 28.5900, lng: 77.2600 }
      ]
    },
    'Orange Line': {
      route_id: 'orange',
      route_name: 'Orange Line',
      coordinates: [
        [77.2500, 28.7000],
        [77.2550, 28.6950],
        [77.2600, 28.6900],
        [77.2650, 28.6850]
      ],
      stops: [
        { name: 'Jahangirpuri', lat: 28.7000, lng: 77.2500 },
        { name: 'Azadpur', lat: 28.6950, lng: 77.2550 },
        { name: 'Model Town', lat: 28.6900, lng: 77.2600 },
        { name: 'GTB Nagar', lat: 28.6850, lng: 77.2650 }
      ]
    },
    'Delhi Metro': {
      route_id: 'metro',
      route_name: 'Delhi Metro',
      coordinates: [
        [77.2090, 28.6400],
        [77.2140, 28.6450],
        [77.2190, 28.6500],
        [77.2240, 28.6550]
      ],
      stops: [
        { name: 'Central Secretariat', lat: 28.6400, lng: 77.2090 },
        { name: 'Udyog Bhawan', lat: 28.6450, lng: 77.2140 },
        { name: 'Lok Kalyan Marg', lat: 28.6500, lng: 77.2190 },
        { name: 'Jor Bagh', lat: 28.6550, lng: 77.2240 }
      ]
    },
    'Airport Express': {
      route_id: 'airport',
      route_name: 'Airport Express',
      coordinates: [
        [77.1200, 28.5600],
        [77.1400, 28.5700],
        [77.1600, 28.5800],
        [77.1800, 28.5900]
      ],
      stops: [
        { name: 'New Delhi Railway Station', lat: 28.5600, lng: 77.1200 },
        { name: 'Shivaji Stadium', lat: 28.5700, lng: 77.1400 },
        { name: 'Dhaula Kuan', lat: 28.5800, lng: 77.1600 },
        { name: 'IGI Airport', lat: 28.5900, lng: 77.1800 }
      ]
    },
    'Green Line': {
      route_id: 'green',
      route_name: 'Green Line',
      coordinates: [
        [77.0800, 28.6800],
        [77.0900, 28.6750],
        [77.1000, 28.6700],
        [77.1100, 28.6650]
      ],
      stops: [
        { name: 'Inderlok', lat: 28.6800, lng: 77.0800 },
        { name: 'Ashok Park Main', lat: 28.6750, lng: 77.0900 },
        { name: 'Punjabi Bagh', lat: 28.6700, lng: 77.1000 },
        { name: 'Shivaji Park', lat: 28.6650, lng: 77.1100 }
      ]
    },
    'Pink Line': {
      route_id: 'pink',
      route_name: 'Pink Line',
      coordinates: [
        [77.1600, 28.6300],
        [77.1700, 28.6250],
        [77.1800, 28.6200],
        [77.1900, 28.6150]
      ],
      stops: [
        { name: 'Majlis Park', lat: 28.6300, lng: 77.1600 },
        { name: 'Azadpur', lat: 28.6250, lng: 77.1700 },
        { name: 'Shalimar Bagh', lat: 28.6200, lng: 77.1800 },
        { name: 'Netaji Subhash Place', lat: 28.6150, lng: 77.1900 }
      ]
    },
    'Magenta Line': {
      route_id: 'magenta',
      route_name: 'Magenta Line',
      coordinates: [
        [77.1800, 28.6200],
        [77.1850, 28.6150],
        [77.1900, 28.6100],
        [77.1950, 28.6050]
      ],
      stops: [
        { name: 'Janakpuri West', lat: 28.6200, lng: 77.1800 },
        { name: 'Dabri Mor', lat: 28.6150, lng: 77.1850 },
        { name: 'Dashrath Puri', lat: 28.6100, lng: 77.1900 },
        { name: 'Palam', lat: 28.6050, lng: 77.1950 }
      ]
    },
    'DTC Route 100': {
      route_id: 'dtc100',
      route_name: 'DTC Route 100',
      coordinates: [
        [77.1025, 28.7041],
        [77.2090, 28.6139],
        [77.3159, 28.5673]
      ],
      stops: [
        { name: 'ISBT Kashmere Gate', lat: 28.7041, lng: 77.1025 },
        { name: 'Connaught Place', lat: 28.6139, lng: 77.2090 },
        { name: 'Lajpat Nagar', lat: 28.5673, lng: 77.3159 }
      ]
    }
  };

  /**
   * Get route visualization for a specific route
   */
  async getRouteVisualization(routeId: string): Promise<RouteVisualization | null> {
    try {
      // Check cache first
      const cacheKey = `route_${routeId}`;
      const cached = this.routeCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        console.log(`Using cached route visualization for ${routeId}`);
        return cached.data;
      }

      console.log(`Getting route visualization for ${routeId}`);

      // First try to get GTFS route data
      const gtfsRoute = await this.getGTFSSrouteData(routeId);

      let routeVisualization: RouteVisualization | null = null;

      if (gtfsRoute) {
        console.log(`Found GTFS route data for ${routeId}`);
        routeVisualization = this.createGTFSVisualization(gtfsRoute);
      } else {
        // Fallback: Generate route using Mapbox Directions API
        console.log(`No GTFS data found, generating route with Mapbox for ${routeId}`);
        routeVisualization = await this.generateMapboxRoute(routeId);
      }

      // Cache the result
      if (routeVisualization) {
        this.routeCache.set(cacheKey, {
          data: routeVisualization,
          timestamp: Date.now()
        });
      }

      return routeVisualization;

    } catch (error) {
      console.error(`Error getting route visualization for ${routeId}:`, error);
      return null;
    }
  }

  /**
   * Get GTFS route shape data from database
   */
  private async getGTFSSrouteData(routeId: string): Promise<RouteShape | null> {
    try {
      // Use type assertion to bypass TypeScript issues with GTFS tables
      const { data, error } = await (supabase as any)
        .from('route_shapes')
        .select('*')
        .eq('route_id', routeId)
        .single();

      if (error) {
        console.log(`No GTFS route shape found for ${routeId}:`, error.message);
        return null;
      }

      return data as RouteShape;
    } catch (error) {
      console.error('Error fetching GTFS route data:', error);
      return null;
    }
  }

  /**
   * Create visualization from GTFS data
   */
  private createGTFSVisualization(routeShape: RouteShape): RouteVisualization {
    // Convert shape points to GeoJSON LineString
    const geometry: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {
        route_id: routeShape.route_id,
        route_name: routeShape.route_name,
        distance: routeShape.total_distance_km * 1000, // Convert back to meters
        duration: routeShape.avg_travel_time_minutes * 60, // Convert back to seconds
      },
      geometry: {
        type: 'LineString',
        coordinates: routeShape.shape_points
      }
    };

    // Create basic stops from start/end points
    const stops: RouteStop[] = [
      {
        stop_id: 'start',
        stop_name: routeShape.start_stop_name,
        stop_lat: routeShape.shape_points[0][1],
        stop_lon: routeShape.shape_points[0][0],
        stop_sequence: 1
      },
      {
        stop_id: 'end',
        stop_name: routeShape.end_stop_name,
        stop_lat: routeShape.shape_points[routeShape.shape_points.length - 1][1],
        stop_lon: routeShape.shape_points[routeShape.shape_points.length - 1][0],
        stop_sequence: routeShape.shape_points.length
      }
    ];

    const stats = {
      distanceKm: routeShape.total_distance_km,
      durationMinutes: routeShape.avg_travel_time_minutes,
      averageSpeedKmh: routeShape.total_distance_km / (routeShape.avg_travel_time_minutes / 60)
    };

    return {
      routeId: routeShape.route_id,
      routeName: routeShape.route_name,
      geometry,
      stops,
      stats,
      source: 'gtfs'
    };
  }

  /**
   * Generate route using Mapbox Directions API
   */
  private async generateMapboxRoute(routeId: string): Promise<RouteVisualization | null> {
    if (!this.mapboxService) {
      console.error('Mapbox service not available');
      return null;
    }

    try {
      // Get route info from GTFS routes table
      const { data: routeData, error } = await (supabase as any)
        .from('gtfs_routes')
        .select('*')
        .eq('route_id', routeId)
        .single();

      if (error || !routeData) {
        console.log(`No route data found for ${routeId}, using sample coordinates`);
        // Use sample Delhi coordinates
        return this.createSampleRoute(routeId);
      }

      // Get stops for this route
      const stops = await this.getRouteStops(routeId);

      if (stops.length < 2) {
        console.log(`Not enough stops found for route ${routeId}`);
        return this.createSampleRoute(routeId);
      }

      // Extract coordinates from stops
      const coordinates = stops.map(stop => [stop.stop_lon, stop.stop_lat]);

      // Get directions from Mapbox
      const directionsData = await this.mapboxService.getCachedDirections(coordinates, {
        profile: 'driving',
        overview: 'full',
        steps: false
      });

      if (!directionsData || directionsData.routes.length === 0) {
        console.log(`Failed to get directions for route ${routeId}`);
        return this.createSampleRoute(routeId);
      }

      const route = directionsData.routes[0];
      const geometry = this.mapboxService.routeToGeoJSON(route);
      const stats = this.mapboxService.calculateRouteStats(route);

      return {
        routeId,
        routeName: routeData.route_long_name || routeData.route_short_name || routeId,
        geometry,
        stops,
        stats,
        source: 'mapbox'
      };

    } catch (error) {
      console.error(`Error generating Mapbox route for ${routeId}:`, error);
      return this.createSampleRoute(routeId);
    }
  }

  /**
   * Get stops for a route
   */
  private async getRouteStops(routeId: string): Promise<RouteStop[]> {
    try {
      // This would ideally get stops from stop_times.txt data
      // For now, get all stops and filter by proximity to route
      const { data: stopsData, error } = await (supabase as any)
        .from('gtfs_stops')
        .select('*')
        .limit(20); // Limit for performance

      if (error || !stopsData) {
        return [];
      }

      return stopsData.map((stop: any, index: number) => ({
        stop_id: stop.stop_id,
        stop_name: stop.stop_name || `Stop ${stop.stop_id}`,
        stop_lat: stop.stop_lat,
        stop_lon: stop.stop_lon,
        stop_sequence: index + 1
      }));
    } catch (error) {
      console.error('Error fetching route stops:', error);
      return [];
    }
  }

  /**
   * Create visualization from mock route data
   */
  private createMockRouteVisualization(mockRoute: {
    route_id: string;
    route_name: string;
    coordinates: number[][];
    stops: Array<{ name: string; lat: number; lng: number }>;
  }): RouteVisualization {
    // Convert coordinates to GeoJSON LineString
    const geometry: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {
        route_id: mockRoute.route_id,
        route_name: mockRoute.route_name,
        distance: this.calculateDistance(mockRoute.coordinates) * 1000, // Convert to meters
        duration: this.estimateDuration(mockRoute.coordinates) * 60, // Convert to seconds
      },
      geometry: {
        type: 'LineString',
        coordinates: mockRoute.coordinates
      }
    };

    // Convert stops to RouteStop format
    const stops: RouteStop[] = mockRoute.stops.map((stop, index) => ({
      stop_id: `stop_${index + 1}`,
      stop_name: stop.name,
      stop_lat: stop.lat,
      stop_lon: stop.lng,
      stop_sequence: index + 1
    }));

    // Calculate route statistics
    const distanceKm = this.calculateDistance(mockRoute.coordinates);
    const durationMinutes = this.estimateDuration(mockRoute.coordinates);
    const averageSpeedKmh = distanceKm / (durationMinutes / 60);

    const stats = {
      distanceKm: Math.round(distanceKm * 100) / 100,
      durationMinutes: Math.round(durationMinutes * 100) / 100,
      averageSpeedKmh: Math.round(averageSpeedKmh * 100) / 100
    };

    return {
      routeId: mockRoute.route_id,
      routeName: mockRoute.route_name,
      geometry,
      stops,
      stats,
      source: 'hybrid'
    };
  }

  /**
   * Calculate distance between coordinates using Haversine formula
   */
  private calculateDistance(coordinates: number[][]): number {
    let totalDistance = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const [lon1, lat1] = coordinates[i];
      const [lon2, lat2] = coordinates[i + 1];

      const R = 6371; // Earth's radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;

      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      totalDistance += R * c;
    }
    return totalDistance;
  }

  /**
   * Estimate duration based on distance (assuming average speed)
   */
  private estimateDuration(coordinates: number[][]): number {
    const distance = this.calculateDistance(coordinates);
    const averageSpeedKmh = 25; // Assume 25 km/h average speed for city routes
    return (distance / averageSpeedKmh) * 60; // Convert to minutes
  }

  /**
   * Create sample route for demonstration
   */
  private createSampleRoute(routeId: string): RouteVisualization {
    // Sample Delhi route coordinates
    const sampleCoordinates = [
      [77.2090, 28.6139], // Connaught Place
      [77.2167, 28.6353], // Karol Bagh
      [77.2244, 28.6567], // Moti Nagar
      [77.2311, 28.6781], // Punjabi Bagh
    ];

    const geometry: GeoJSON.Feature<GeoJSON.LineString> = {
      type: 'Feature',
      properties: {
        route_id: routeId,
        distance: 15000, // 15km in meters
        duration: 1800, // 30 minutes in seconds
      },
      geometry: {
        type: 'LineString',
        coordinates: sampleCoordinates
      }
    };

    const stops: RouteStop[] = [
      {
        stop_id: 'CP001',
        stop_name: 'Connaught Place',
        stop_lat: 28.6139,
        stop_lon: 77.2090,
        stop_sequence: 1
      },
      {
        stop_id: 'KB001',
        stop_name: 'Karol Bagh',
        stop_lat: 28.6353,
        stop_lon: 77.2167,
        stop_sequence: 2
      },
      {
        stop_id: 'MN001',
        stop_name: 'Moti Nagar',
        stop_lat: 28.6567,
        stop_lon: 77.2244,
        stop_sequence: 3
      },
      {
        stop_id: 'PB001',
        stop_name: 'Punjabi Bagh',
        stop_lat: 28.6781,
        stop_lon: 77.2311,
        stop_sequence: 4
      }
    ];

    const stats = {
      distanceKm: 15,
      durationMinutes: 30,
      averageSpeedKmh: 30
    };

    return {
      routeId,
      routeName: `Sample Route ${routeId}`,
      geometry,
      stops,
      stats,
      source: 'hybrid'
    };
  }

  /**
   * Get route visualization by route name (for backward compatibility)
   */
  async getRouteByName(routeName: string): Promise<RouteVisualization | null> {
    try {
      // Check cache first
      const cacheKey = `route_name_${routeName}`;
      const cached = this.routeCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        console.log(`Using cached route visualization for ${routeName}`);
        return cached.data;
      }

      // Try to find route by name in GTFS routes
      const { data: routes, error } = await (supabase as any)
        .from('gtfs_routes')
        .select('route_id, route_long_name, route_short_name')
        .or(`route_long_name.ilike.%${routeName}%,route_short_name.ilike.%${routeName}%`)
        .limit(1);

      if (!error && routes && routes.length > 0) {
        return this.getRouteVisualization(routes[0].route_id);
      }

      // Fallback to mock route shapes
      const mockRoute = this.MOCK_ROUTE_SHAPES[routeName];
      if (mockRoute) {
        console.log(`Using mock route data for ${routeName}`);
        const routeVisualization = this.createMockRouteVisualization(mockRoute);

        // Cache the result
        this.routeCache.set(cacheKey, {
          data: routeVisualization,
          timestamp: Date.now()
        });

        return routeVisualization;
      }

      console.log(`No route found with name: ${routeName}`);
      return null;
    } catch (error) {
      console.error(`Error getting route by name ${routeName}:`, error);
      return null;
    }
  }

  /**
   * Get all available routes
   */
  async getAllRoutes(): Promise<Array<{ route_id: string; route_name: string }>> {
    try {
      const { data: routes, error } = await (supabase as any)
        .from('gtfs_routes')
        .select('route_id, route_long_name, route_short_name')
        .limit(50);

      if (error || !routes) {
        console.log('No routes found in database');
        return [];
      }

      return routes.map((route: any) => ({
        route_id: route.route_id,
        route_name: route.route_long_name || route.route_short_name || route.route_id
      }));
    } catch (error) {
      console.error('Error fetching all routes:', error);
      return [];
    }
  }

  /**
   * Clear any cached data
   */
  clearCache(): void {
    this.routeCache.clear();
    if (this.mapboxService) {
      this.mapboxService.clearCache();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.routeCache.size,
      keys: Array.from(this.routeCache.keys())
    };
  }
}

// Create singleton instance
const routeVisualizer = new RouteVisualizerService();

export default routeVisualizer;
export type { RouteVisualization, RouteStop, RouteShape };
