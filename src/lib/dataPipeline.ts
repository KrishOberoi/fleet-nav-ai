import { supabase } from '@/integrations/supabase/client';
import { BusData } from '@/types/bus';
import { busSimulator } from './busSimulator';
import { getRouteById, RouteData } from './delhiRoutes';

export interface ETACalculation {
  busId: string;
  nextStopName: string;
  distanceToStop: number; // km
  estimatedTime: number; // minutes
  currentSpeed: number;
  historicalAvgSpeed: number;
  isDelayed: boolean;
  delayMinutes: number;
}

export interface BusMetrics {
  busId: string;
  routeName: string;
  currentSpeed: number;
  avgSpeed: number;
  occupancy: number;
  etaToNextStop?: ETACalculation;
  status: 'active' | 'idle' | 'stopped' | 'delayed';
  lastUpdated: Date;
}

export class DataPipeline {
  private isRunning = false;
  private dataCollectionInterval: NodeJS.Timeout | null = null;
  private baselineComputationInterval: NodeJS.Timeout | null = null;
  private anomalyDetectionInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeDataPipeline();
  }

  // Initialize the complete data pipeline
  private async initializeDataPipeline() {
    console.log('🚀 Initializing Bus Fleet Data Pipeline...');

    // Start collecting data every 90 seconds
    this.startDataCollection();

    // Start baseline computation every hour
    this.startBaselineComputation();

    // Start anomaly detection every 15 minutes
    this.startAnomalyDetection();

    console.log('✅ Data Pipeline initialized successfully');
  }

  // Start collecting bus data every 90 seconds
  private startDataCollection() {
    this.isRunning = true;
    console.log('📊 Starting data collection every 90 seconds...');

    // Collect initial data
    this.collectBusData();

    // Set up interval for continuous collection
    this.dataCollectionInterval = setInterval(() => {
      this.collectBusData();
    }, 90000); // 90 seconds
  }

  // Collect and store current bus data
  private async collectBusData() {
    try {
      const busData = busSimulator.getBusData();
      const fleetStats = busSimulator.getStats();

      // Prepare data for Supabase
      const records = busData.map(bus => {
        const busDetails = busSimulator.getBusDetails(bus.id);
        const route = getRouteById(busDetails?.routeId || '');

        return {
          bus_number: bus.bus_number,
          route_name: bus.route_name,
          location: bus.location as any, // Convert Location to Json
          speed: bus.speed,
          avg_speed: fleetStats.averageSpeed,
          passenger_count: bus.passenger_count,
          capacity: bus.capacity,
          avg_occupancy: fleetStats.totalPassengers > 0 ?
            (fleetStats.totalPassengers / (busData.length * 60)) * 100 : 0,
          total_journey_time: route?.estimatedTime || 0,
          estimated_journey_time: route?.estimatedTime || 0,
          operational_status: bus.speed > 5 ? 'active' :
                             bus.speed > 0 ? 'idle' : 'maintenance',
          total_moving_time: bus.speed > 0 ? 1.5 : 0, // 90 seconds in minutes
          total_stopping_time: bus.speed === 0 ? 1.5 : 0,
          delay_time: 0, // Will be calculated based on ETA
          timestamp: bus.timestamp
        };
      });

      // Store in Supabase
      const { error } = await supabase
        .from('bus_data')
        .insert(records);

      if (error) {
        console.error('❌ Error storing bus data:', error);
        console.log('💡 This might be because the Supabase migrations haven\'t been run yet.');
        console.log('💡 Check that the bus_data table exists in your Supabase database.');
      } else {
        console.log(`✅ Stored ${records.length} bus records`);
      }

    } catch (error) {
      console.error('❌ Error in data collection:', error);
    }
  }

  // Start hourly baseline computation
  private startBaselineComputation() {
    console.log('📈 Starting hourly baseline computation...');

    // Compute initial baselines
    this.computeBaselines();

    // Set up hourly computation
    this.baselineComputationInterval = setInterval(() => {
      this.computeBaselines();
    }, 3600000); // 1 hour
  }

  // Compute historical baselines (simplified for now)
  private async computeBaselines() {
    try {
      console.log('🔄 Computing historical baselines...');

      // For now, just log that baseline computation would happen
      // In a full implementation, this would compute averages from bus_data table
      console.log('✅ Historical baselines computation placeholder');
    } catch (error) {
      console.error('❌ Error in baseline computation:', error);
    }
  }

  // Start anomaly detection every 15 minutes
  private startAnomalyDetection() {
    console.log('🔍 Starting anomaly detection...');

    // Run initial detection
    this.detectAnomalies();

    // Set up 15-minute interval
    this.anomalyDetectionInterval = setInterval(() => {
      this.detectAnomalies();
    }, 900000); // 15 minutes
  }

  // Detect anomalies using historical data (simplified for now)
  private async detectAnomalies() {
    try {
      console.log('🔍 Detecting anomalies...');

      // For now, just log that anomaly detection would happen
      // In a full implementation, this would analyze bus_data for anomalies
      console.log('✅ Anomaly detection placeholder');
    } catch (error) {
      console.error('❌ Error in anomaly detection:', error);
    }
  }

  // Calculate ETA for a bus to reach next stop
  async calculateETA(busId: string): Promise<ETACalculation | null> {
    try {
      const busDetails = busSimulator.getBusDetails(busId);
      if (!busDetails) return null;

      const route = getRouteById(busDetails.routeId);
      if (!route) return null;

      // Find next stop (first stop after current position)
      const currentWaypointIndex = busDetails.currentWaypointIndex;
      let nextStop: { name: string; lat: number; lng: number; distance: number } | null = null;

      for (const stop of route.stops) {
        const distance = this.calculateDistance(
          busDetails.location.lat, busDetails.location.lng,
          stop.lat, stop.lng
        );

        if (distance > 0.05) { // Not at current stop
          if (!nextStop || distance < nextStop.distance) {
            nextStop = { name: stop.name, lat: stop.lat, lng: stop.lng, distance };
          }
        }
      }

      if (!nextStop) return null;

      // Use default historical average speed for now (will be enhanced with real historical data later)
      const historicalAvgSpeed = 25; // Default 25 km/h for Delhi traffic
      const currentSpeed = busDetails.speed > 0 ? busDetails.speed : historicalAvgSpeed;

      // Calculate ETA
      const estimatedTime = (nextStop.distance / currentSpeed) * 60; // Convert to minutes
      const historicalETA = (nextStop.distance / historicalAvgSpeed) * 60;
      const delayMinutes = estimatedTime - historicalETA;
      const isDelayed = delayMinutes > 5; // Consider delayed if more than 5 minutes

      return {
        busId,
        nextStopName: nextStop.name,
        distanceToStop: nextStop.distance,
        estimatedTime,
        currentSpeed,
        historicalAvgSpeed,
        isDelayed,
        delayMinutes
      };

    } catch (error) {
      console.error('❌ Error calculating ETA:', error);
      return null;
    }
  }

  // Get comprehensive bus metrics including ETA
  async getBusMetrics(busId: string): Promise<BusMetrics | null> {
    try {
      const busDetails = busSimulator.getBusDetails(busId);
      if (!busDetails) return null;

      const busData = busSimulator.getBusData().find(b => b.id === busId);
      if (!busData) return null;

      const eta = await this.calculateETA(busId);

      // Determine status
      let status: 'active' | 'idle' | 'stopped' | 'delayed' = 'active';
      if (busData.speed === 0) {
        status = 'stopped';
      } else if (busData.speed <= 5) {
        status = 'idle';
      } else if (eta?.isDelayed) {
        status = 'delayed';
      }

      return {
        busId,
        routeName: busData.route_name,
        currentSpeed: busData.speed,
        avgSpeed: busSimulator.getStats().averageSpeed,
        occupancy: busData.capacity > 0 ? (busData.passenger_count / busData.capacity) * 100 : 0,
        etaToNextStop: eta || undefined,
        status,
        lastUpdated: new Date(busData.timestamp)
      };

    } catch (error) {
      console.error('❌ Error getting bus metrics:', error);
      return null;
    }
  }

  // Query historical data for chatbot (simplified for now)
  async queryHistoricalData(query: {
    metric: 'speed' | 'occupancy' | 'delay';
    routeName?: string;
    busNumber?: string;
    hoursBack?: number;
  }) {
    try {
      // For now, return mock historical data
      // In a full implementation, this would query the historical_baselines table
      const mockData = [
        {
          metric_name: query.metric,
          route_name: query.routeName || 'All Routes',
          period_start: new Date(Date.now() - 3600000).toISOString(),
          avg_value: query.metric === 'speed' ? 25 : query.metric === 'occupancy' ? 65 : 2,
          sample_count: 25
        }
      ];

      console.log('📊 Returning mock historical data for:', query);
      return mockData;

    } catch (error) {
      console.error('❌ Error in historical data query:', error);
      return null;
    }
  }

  // Check for delays by comparing current ETA with historical averages
  async checkForDelays(busId: string): Promise<{
    isDelayed: boolean;
    delayMinutes: number;
    nextStop: string;
    expectedArrival: Date;
    actualArrival: Date;
  } | null> {
    try {
      const eta = await this.calculateETA(busId);
      if (!eta) return null;

      const expectedArrival = new Date(Date.now() + eta.estimatedTime * 60000);
      const actualArrival = new Date(Date.now() + eta.estimatedTime * 60000);

      return {
        isDelayed: eta.isDelayed,
        delayMinutes: eta.delayMinutes,
        nextStop: eta.nextStopName,
        expectedArrival,
        actualArrival
      };

    } catch (error) {
      console.error('❌ Error checking for delays:', error);
      return null;
    }
  }

  // Calculate distance between two points (Haversine formula)
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

  // Stop the data pipeline
  stop() {
    this.isRunning = false;

    if (this.dataCollectionInterval) {
      clearInterval(this.dataCollectionInterval);
      this.dataCollectionInterval = null;
    }

    if (this.baselineComputationInterval) {
      clearInterval(this.baselineComputationInterval);
      this.baselineComputationInterval = null;
    }

    if (this.anomalyDetectionInterval) {
      clearInterval(this.anomalyDetectionInterval);
      this.anomalyDetectionInterval = null;
    }

    console.log('🛑 Data Pipeline stopped');
  }

  // Get pipeline status
  getStatus() {
    return {
      isRunning: this.isRunning,
      dataCollectionActive: this.dataCollectionInterval !== null,
      baselineComputationActive: this.baselineComputationInterval !== null,
      anomalyDetectionActive: this.anomalyDetectionInterval !== null
    };
  }
}

// Singleton instance
export const dataPipeline = new DataPipeline();
