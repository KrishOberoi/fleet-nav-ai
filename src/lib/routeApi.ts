import routeVisualizer, { type RouteVisualization } from './routeVisualizer';
import { gtfsParser } from './gtfsParser';

interface RouteApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

interface RouteListResponse {
  routes: Array<{
    route_id: string;
    route_name: string;
    route_type?: number;
    agency_id?: string;
  }>;
  total: number;
}

interface RouteDetailsResponse extends RouteVisualization {}

class RouteApiService {
  private readonly API_BASE_URL = '/api/routes'; // For future backend integration

  /**
   * Get all available routes
   */
  async getAllRoutes(): Promise<RouteApiResponse<RouteListResponse>> {
    try {
      console.log('API: Fetching all routes');

      const routes = await routeVisualizer.getAllRoutes();

      // If no routes in database, try to initialize GTFS data
      if (routes.length === 0) {
        console.log('No routes found, attempting to initialize GTFS data');
        try {
          await gtfsParser.downloadAndParseGTFS();
          // Try again after initialization
          const updatedRoutes = await routeVisualizer.getAllRoutes();
          return {
            success: true,
            data: {
              routes: updatedRoutes,
              total: updatedRoutes.length
            },
            timestamp: new Date().toISOString()
          };
        } catch (initError) {
          console.error('Failed to initialize GTFS data:', initError);
        }
      }

      return {
        success: true,
        data: {
          routes,
          total: routes.length
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('API Error: Failed to fetch routes:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get route details by ID
   */
  async getRouteById(routeId: string): Promise<RouteApiResponse<RouteDetailsResponse>> {
    try {
      console.log(`API: Fetching route details for ${routeId}`);

      const routeVisualization = await routeVisualizer.getRouteVisualization(routeId);

      if (!routeVisualization) {
        return {
          success: false,
          error: `Route with ID ${routeId} not found`,
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        data: routeVisualization,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`API Error: Failed to fetch route ${routeId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get route details by name
   */
  async getRouteByName(routeName: string): Promise<RouteApiResponse<RouteDetailsResponse>> {
    try {
      console.log(`API: Fetching route details for name "${routeName}"`);

      const routeVisualization = await routeVisualizer.getRouteByName(routeName);

      if (!routeVisualization) {
        return {
          success: false,
          error: `Route with name "${routeName}" not found`,
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        data: routeVisualization,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`API Error: Failed to fetch route by name "${routeName}":`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Initialize GTFS data
   */
  async initializeGTFS(): Promise<RouteApiResponse<{ message: string; routesProcessed: number }>> {
    try {
      console.log('API: Initializing GTFS data');

      await gtfsParser.downloadAndParseGTFS();

      // Get count of processed routes
      const routes = await routeVisualizer.getAllRoutes();

      return {
        success: true,
        data: {
          message: 'GTFS data initialized successfully',
          routesProcessed: routes.length
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('API Error: Failed to initialize GTFS data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Update route baselines
   */
  async updateBaselines(): Promise<RouteApiResponse<{ message: string }>> {
    try {
      console.log('API: Updating route baselines');

      await gtfsParser.updateRouteBaselines();

      return {
        success: true,
        data: {
          message: 'Route baselines updated successfully'
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('API Error: Failed to update baselines:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Search routes by query
   */
  async searchRoutes(query: string, limit: number = 10): Promise<RouteApiResponse<RouteListResponse>> {
    try {
      console.log(`API: Searching routes with query "${query}"`);

      const allRoutes = await routeVisualizer.getAllRoutes();

      const filteredRoutes = allRoutes
        .filter(route =>
          route.route_name.toLowerCase().includes(query.toLowerCase()) ||
          route.route_id.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, limit);

      return {
        success: true,
        data: {
          routes: filteredRoutes,
          total: filteredRoutes.length
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('API Error: Failed to search routes:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get route statistics
   */
  async getRouteStats(): Promise<RouteApiResponse<{
    totalRoutes: number;
    routesByType: Record<number, number>;
    totalDistance: number;
    averageRouteLength: number;
  }>> {
    try {
      console.log('API: Fetching route statistics');

      const routes = await routeVisualizer.getAllRoutes();

      // This would ideally aggregate from the database
      // For now, return basic stats
      const stats = {
        totalRoutes: routes.length,
        routesByType: {
          3: routes.length // Assuming all are bus routes (type 3)
        },
        totalDistance: 0, // Would need to aggregate from database
        averageRouteLength: 0
      };

      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('API Error: Failed to fetch route stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Health check for the route API
   */
  async healthCheck(): Promise<RouteApiResponse<{ status: string; version: string }>> {
    return {
      success: true,
      data: {
        status: 'healthy',
        version: '1.0.0'
      },
      timestamp: new Date().toISOString()
    };
  }
}

// Create singleton instance
const routeApi = new RouteApiService();

export default routeApi;
export type { RouteApiResponse, RouteListResponse, RouteDetailsResponse };
