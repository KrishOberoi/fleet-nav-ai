import { useState, useEffect } from 'react';
import { Bus } from 'lucide-react';
import { StatsPanel } from '@/components/StatsPanel';
import { BusMap } from '@/components/BusMap';
import { BusList } from '@/components/BusList';
import { AIInsightsPanel } from '@/components/AIInsightsPanel';
import { ChatBot } from '@/components/ChatBot';
import { generateBusData } from '@/lib/syntheticData';
import { BusData, FleetStats } from '@/types/bus';
import { supabase } from '@/integrations/supabase/client';

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

  // Generate and update bus data every 5 seconds
  useEffect(() => {
    const updateBusData = () => {
      const newBusData = generateBusData();
      setBuses(newBusData);
      calculateFleetStats(newBusData);
    };

    updateBusData();
    const interval = setInterval(updateBusData, 5000);

    return () => clearInterval(interval);
  }, []);

  // Store bus data in database every 2 minutes
  useEffect(() => {
    const storeBusData = async () => {
      if (buses.length === 0) return;

      const dataToStore = buses.map((bus) => ({
        bus_number: bus.bus_number,
        route_name: bus.route_name,
        location: bus.location as any,
        speed: bus.speed,
        avg_speed: bus.avg_speed,
        passenger_count: bus.passenger_count,
        capacity: bus.capacity,
        avg_occupancy: bus.avg_occupancy,
        total_journey_time: bus.total_journey_time,
        estimated_journey_time: bus.estimated_journey_time,
        is_under_maintenance: bus.is_under_maintenance,
        operational_status: bus.operational_status,
        total_moving_time: bus.total_moving_time,
        total_stopping_time: bus.total_stopping_time,
        delay_time: bus.delay_time,
      }));

      const { error } = await supabase.from('bus_data').insert(dataToStore);

      if (error) {
        console.error('Error storing bus data:', error);
      } else {
        console.log('Bus data stored successfully');
      }
    };

    const interval = setInterval(storeBusData, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [buses]);

  // Generate AI insights every 5 minutes
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

  const calculateFleetStats = (busData: BusData[]) => {
    const activeBuses = busData.filter((b) => b.operational_status === 'active').length;
    const totalPassengers = busData.reduce((sum, b) => sum + b.passenger_count, 0);
    const avgOccupancy = busData.length > 0
      ? busData.reduce((sum, b) => sum + b.avg_occupancy, 0) / busData.length
      : 0;
    const maintenanceBuses = busData.filter((b) => b.is_under_maintenance).length;

    setFleetStats({
      totalActiveBuses: activeBuses,
      totalPassengers,
      avgOccupancy: Math.round(avgOccupancy * 10) / 10,
      peakDemandTime: '9:00 AM',
      busesUnderMaintenance: maintenanceBuses,
    });
  };

  const fleetSnapshot = JSON.stringify(buses.slice(0, 5), null, 2);

  return (
    <div className="min-h-screen bg-background pb-96">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bus className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">SmartTransit</h1>
              <p className="text-sm text-muted-foreground">
                Intelligent Fleet Management System
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Panel */}
      <StatsPanel stats={fleetStats} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 h-[calc(100vh-250px)]">
        {/* Bus List */}
        <div className="lg:col-span-3 h-full">
          <BusList
            buses={buses}
            selectedBus={selectedBus}
            onSelectBus={setSelectedBus}
          />
        </div>

        {/* Map */}
        <div className="lg:col-span-6 h-full">
          <BusMap
            buses={buses}
            selectedBus={selectedBus}
            onSelectBus={setSelectedBus}
          />
        </div>

        {/* AI Insights */}
        <div className="lg:col-span-3 h-full">
          <AIInsightsPanel />
        </div>
      </div>

      {/* ChatBot */}
      <ChatBot currentFleetSnapshot={fleetSnapshot} />
    </div>
  );
};

export default Index;
