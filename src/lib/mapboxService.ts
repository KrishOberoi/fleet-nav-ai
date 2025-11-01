interface MapboxRoute {
  geometry: {
    coordinates: number[][];
    type: string;
  };
  legs: Array<{
    distance: number;
    duration: number;
    steps: Array<{
      geometry: {
        coordinates: number[][];
      };
      distance: number;
      duration: number;
      maneuver: {
        type: string;
        instruction: string;
      };
    }>;
  }>;
  distance: number;
  duration: number;
  weight: number;
}

interface MapboxDirectionsResponse {
  routes: MapboxRoute[];
  waypoints: Array<{
    distance: number;
    name: string;
    location: number[];
  }>;
  code: string;
  uuid: string;
}

interface RouteVisualizerOptions {
  profile?: 'driving' | 'walking' | 'cycling';
  alternatives?: boolean;
  steps?: boolean;
  geometries?: 'geojson' | 'polyline' | 'polyline6';
  overview?: 'full' | 'simplified' | 'false';
  voice_instructions?: boolean;
  banner_instructions?: boolean;
  roundabout_exits?: boolean;
  voice_units?: 'imperial' | 'metric';
  exclude?: string;
}

class MapboxService {
  private readonly baseUrl = 'https://api.mapbox.com/directions/v5';
  private readonly accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Get driving directions between coordinates
   */
  async getDirections(
    coordinates: number[][],
    options: RouteVisualizerOptions = {}
  ): Promise<MapboxDirectionsResponse | null> {
    try {
      const {
        profile = 'driving',
        alternatives = false,
        steps = true,
        geometries = 'geojson',
        overview = 'full',
        voice_instructions = false,
        banner_instructions = false,
        roundabout_exits = true,
        voice_units = 'metric',
        exclude = ''
      } = options;

      // Convert coordinates to Mapbox format: lng,lat;lng,lat;...
      const coordinatesString = coordinates
        .map(coord => `${coord[0]},${coord[1]}`)
        .join(';');

      const params = new URLSearchParams({
        access_token: this.accessToken,
        alternatives: alternatives.toString(),
        steps: steps.toString(),
        geometries,
        overview,
        voice_instructions: voice_instructions.toString(),
        banner_instructions: banner_instructions.toString(),
        roundabout_exits: roundabout_exits.toString(),
        voice_units
      });

      if (exclude) {
        params.append('exclude', exclude);
      }

      const url = `${this.baseUrl}/${profile}/${coordinatesString}?${params}`;

      console.log('Fetching Mapbox directions:', url.replace(this.accessToken, '[TOKEN]'));

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mapbox API error: ${response.status} - ${errorText}`);
      }

      const data: MapboxDirectionsResponse = await response.json();

      if (data.code !== 'Ok') {
        throw new Error(`Mapbox routing error: ${data.code}`);
      }

      return data;
    } catch (error) {
      console.error('Error fetching directions from Mapbox:', error);
      return null;
    }
  }

  /**
   * Get optimized route for multiple stops
   */
  async getOptimizedRoute(
    coordinates: number[][],
    options: RouteVisualizerOptions = {}
  ): Promise<MapboxDirectionsResponse | null> {
    // For optimization, we'd use the Mapbox Optimization API
    // For now, just get directions for the first and last points
    if (coordinates.length < 2) {
      return null;
    }

    const startEndCoordinates = [coordinates[0], coordinates[coordinates.length - 1]];
    return this.getDirections(startEndCoordinates, options);
  }

  /**
   * Convert route geometry to GeoJSON format for Mapbox GL JS
   */
  routeToGeoJSON(route: MapboxRoute): GeoJSON.Feature<GeoJSON.LineString> {
    return {
      type: 'Feature',
      properties: {
        distance: route.distance,
        duration: route.duration,
        weight: route.weight
      },
      geometry: {
        type: 'LineString',
        coordinates: route.geometry.coordinates
      }
    };
  }

  /**
   * Calculate route statistics
   */
  calculateRouteStats(route: MapboxRoute): {
    distanceKm: number;
    durationMinutes: number;
    averageSpeedKmh: number;
  } {
    const distanceKm = route.distance / 1000; // Convert meters to km
    const durationMinutes = route.duration / 60; // Convert seconds to minutes
    const averageSpeedKmh = distanceKm / (durationMinutes / 60); // km/h

    return {
      distanceKm: Math.round(distanceKm * 100) / 100,
      durationMinutes: Math.round(durationMinutes * 100) / 100,
      averageSpeedKmh: Math.round(averageSpeedKmh * 100) / 100
    };
  }

  /**
   * Cache route data to avoid repeated API calls
   */
  private routeCache = new Map<string, { data: MapboxDirectionsResponse; timestamp: number }>();
  private readonly CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

  async getCachedDirections(
    coordinates: number[][],
    options: RouteVisualizerOptions = {}
  ): Promise<MapboxDirectionsResponse | null> {
    const cacheKey = JSON.stringify({ coordinates, options });
    const cached = this.routeCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      console.log('Using cached route data');
      return cached.data;
    }

    const data = await this.getDirections(coordinates, options);

    if (data) {
      this.routeCache.set(cacheKey, { data, timestamp: Date.now() });
    }

    return data;
  }

  /**
   * Clear route cache
   */
  clearCache(): void {
    this.routeCache.clear();
  }

  /**
   * Check if coordinates are valid
   */
  validateCoordinates(coordinates: number[][]): boolean {
    return coordinates.every(coord =>
      coord.length === 2 &&
      typeof coord[0] === 'number' &&
      typeof coord[1] === 'number' &&
      coord[0] >= -180 && coord[0] <= 180 && // longitude
      coord[1] >= -90 && coord[1] <= 90     // latitude
    );
  }
}

// Create singleton instance
let mapboxService: MapboxService | null = null;

export function getMapboxService(): MapboxService | null {
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

  if (!token) {
    console.warn('Mapbox access token not found in environment variables');
    return null;
  }

  if (!mapboxService) {
    mapboxService = new MapboxService(token);
  }

  return mapboxService;
}

export default MapboxService;
export type { MapboxRoute, MapboxDirectionsResponse, RouteVisualizerOptions };
