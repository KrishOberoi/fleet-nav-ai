import { useState, useEffect } from 'react';
import { Bus } from 'lucide-react';
import { StatsPanel } from '@/components/StatsPanel';
import { BusMap } from '@/components/BusMap';
import { BusList } from '@/components/BusList';
import { AIInsightsPanel } from '@/components/AIInsightsPanel';
import { ChatBot } from '@/components/ChatBot';
import { busSimulator } from '@/lib/busSimulator';
import { dataPipeline } from '@/lib/dataPipeline';
import { BusData, FleetStats } from '@/types/bus';

const Index = () => {
  const [buses, setBuses] = useState<BusData[]>([]);
  const [selectedBus, setSelectedBus] = useState<string | null>(null);
  const [fleetStats, setFleetStats] = useState<FleetStats>({
    totalActiveBuses: 0,
    totalPassengers: 0,
    avgOccupancy: 0,
    peakDemandTime: '9:00 AM',
    busesUnderMaintenance: 0,
  });

  // Initialize bus simulator and set up real-time updates
  useEffect(() => {
    console.log('Starting Delhi bus simulation...');

    // Start the simulator
    busSimulator.start();

    // Set initial bus data
    const initialBusData = busSimulator.getBusData();
    setBuses(initialBusData);
    calculateFleetStats(initialBusData);

    // Set up real-time updates from simulator
    const updateCallback = (updatedBuses: BusData[]) => {
      setBuses(updatedBuses);
      calculateFleetStats(updatedBuses);
    };

    busSimulator.onUpdate(updateCallback);

    // Cleanup on unmount
    return () => {
      busSimulator.removeCallback(updateCallback);
    };
  }, []);



  // Update historical baselines every hour (commented until migration is run)
  // useEffect(() => {
  //   const updateBaselines = async () => {
  //     try {
  //       console.log('Updating historical baselines...');
  //       const { error } = await supabase.rpc('update_historical_baselines');
  //       if (error) {
  //         console.error('Error updating baselines:', error);
  //       } else {
  //         console.log('Historical baselines updated');
  //       }
  //     } catch (error) {
  //       console.error('Error calling update_historical_baselines:', error);
  //     }
  //   };

  //   // Update immediately and then every hour
  //   updateBaselines();
  //   const interval = setInterval(updateBaselines, 3600000); // 1 hour

  //   return () => clearInterval(interval);
  // }, []);

  // Detect anomalies every 15 minutes (commented until migration is run)
  // useEffect(() => {
  //   const detectAnomalies = async () => {
  //     try {
  //       console.log('Detecting anomalies...');
  //       const { error } = await supabase.rpc('detect_anomalies');
  //     } catch (error) {
  //       console.error('Error detecting anomalies:', error);
  //     }
  //   };

  //   // Start detecting after 5 minutes and then every 15 minutes
  //   const initialTimeout = setTimeout(detectAnomalies, 300000); // 5 minutes
  //   const interval = setInterval(detectAnomalies, 900000); // 15 minutes

  //   return () => {
  //     clearTimeout(initialTimeout);
  //     clearInterval(interval);
  //   };
  // }, []);

  // Generate AI insights every 5 minutes (disabled due to CORS issues in development)
  // TODO: Re-enable when Supabase Edge Functions CORS is configured
  /*
  useEffect(() => {
    const generateInsights = async () => {
      if (buses.length === 0) return;

      try {
        const { error } = await supabase.functions.invoke('generate-insights', {
          body: { buses },
        });

        if (error) {
          console.error('Error generating insights:', error);
        }
      } catch (error) {
        console.error('Error calling insights function:', error);
      }
    };

    // Generate insights after initial load
    const initialTimeout = setTimeout(generateInsights, 10000);

    // Then every 5 minutes
    const interval = setInterval(generateInsights, 300000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [buses]);
  */

  const calculateFleetStats = (busData: BusData[]) => {
    const totalBuses = busData.length;
    const totalPassengers = busData.reduce((sum, b) => sum + b.passenger_count, 0);
    const avgOccupancy = busData.length > 0
      ? busData.reduce((sum, b) => sum + (b.capacity ? (b.passenger_count / b.capacity) * 100 : 0), 0) / busData.length
      : 0;

    setFleetStats({
      totalActiveBuses: totalBuses, // All buses are considered active since we only have ESP32 data
      totalPassengers,
      avgOccupancy: Math.round(avgOccupancy * 10) / 10,
      peakDemandTime: '9:00 AM',
      busesUnderMaintenance: 0, // Backend will manage maintenance status
    });
  };

  const fleetSnapshot = JSON.stringify(buses, null, 2);

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bus className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Delhi Bus Simulation</h1>
              <p className="text-sm text-muted-foreground">
                Realistic bus tracking simulation with road-following routes
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Panel */}
      <StatsPanel stats={fleetStats} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4" style={{ height: 'calc(100vh - 280px)' }}>
        {/* Bus List - Compact */}
        <div className="lg:col-span-2">
          <BusList
            buses={buses}
            selectedBus={selectedBus}
            onSelectBus={setSelectedBus}
          />
        </div>

        {/* Map - Expanded */}
        <div className="lg:col-span-8 h-full">
          <BusMap
            buses={buses}
            selectedBus={selectedBus}
            onSelectBus={setSelectedBus}
          />
        </div>

        {/* AI Insights */}
        <div className="lg:col-span-2 h-full">
          <AIInsightsPanel />
        </div>
      </div>

      {/* ChatBot - Compact */}
      <ChatBot currentFleetSnapshot={fleetSnapshot} />
    </div>
  );
};

export default Index;
