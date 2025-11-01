import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, Users, Gauge, DollarSign } from 'lucide-react';
import { BusData } from '@/types/bus';
import { busSimulator } from '@/lib/busSimulator';
import { getRouteById } from '@/lib/delhiRoutes';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ponecvgchpqwxbsddcen.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbmVjdmdjaHBxd3hic2RkY2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMDg0NDQsImV4cCI6MjA3NjU4NDQ0NH0.U6iKFy-PM2ljPDTVWAOmIKErhADsm8G3KEfJ9pzHgaw";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Haversine distance calculation
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

interface BusListProps {
  buses: BusData[];
  selectedBus: string | null;
  onSelectBus: (busNumber: string) => void;
}

export function BusList({ buses, selectedBus, onSelectBus }: BusListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [busIncome, setBusIncome] = useState<Record<string, number>>({});

  // Fetch today's income for all buses
  useEffect(() => {
    const fetchIncomeData = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: incomeData } = await supabase
          .from('ticket_transactions')
          .select('bus_id, total_income')
          .gte('timestamp', today.toISOString());

        if (incomeData) {
          const incomeMap: Record<string, number> = {};
          incomeData.forEach(item => {
            incomeMap[item.bus_id] = (incomeMap[item.bus_id] || 0) + item.total_income;
          });
          setBusIncome(incomeMap);
        }
      } catch (error) {
        console.error('Error fetching income data:', error);
      }
    };

    fetchIncomeData();

    // Refresh income data every 30 seconds
    const interval = setInterval(fetchIncomeData, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredBuses = buses.filter(
    (bus) =>
      bus.bus_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bus.route_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (speed: number) => {
    if (speed > 5) {
      return 'bg-green-500/20 text-green-400 border-green-500/30'; // Active
    } else if (speed > 0) {
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30'; // Idle
    } else {
      return 'bg-red-500/20 text-red-400 border-red-500/30'; // Stopped
    }
  };

  return (
    <Card className="flex flex-col bg-card border-border" style={{ height: '600px' }}>
      <div className="p-3 border-b border-border">
        <h2 className="text-base font-semibold mb-2">Fleet Overview</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search bus..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary border-border text-sm h-8"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {filteredBuses.map((bus) => (
            <Card
              key={bus.bus_number}
              className={`p-3 cursor-pointer transition-all duration-200 hover:border-primary/50 ${
                selectedBus === bus.bus_number ? 'border-primary bg-primary/5' : 'border-border'
              }`}
              onClick={() => onSelectBus(bus.bus_number)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{bus.bus_number}</h3>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{bus.route_name}</span>
                  </div>
                </div>
                <Badge className={`${getStatusColor(bus.speed)} text-xs px-2 py-0.5`}>
                  {bus.speed > 5 ? 'Active' : bus.speed > 0 ? 'Idle' : 'Stopped'}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="flex items-center gap-1.5">
                  <Gauge className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Speed</p>
                    <p className="text-xs font-medium">{bus.speed} km/h</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Users className="w-3 h-3 text-green-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Passengers</p>
                    <p className="text-xs font-medium">
                      {bus.passenger_count}/{bus.capacity}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <DollarSign className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Income</p>
                    <p className="text-xs font-medium">
                      ₹{(busIncome[bus.bus_number] || 0).toFixed(0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Show stop information if bus is at a stop */}
              {(() => {
                const busDetails = busSimulator.getBusDetails(bus.id);
                const isAtStop = busDetails?.currentStopName && bus.speed === 0;

                return isAtStop ? (
                  <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-1 text-xs text-blue-700 dark:text-blue-300">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="font-medium">At {busDetails.currentStopName}</span>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Show ETA information */}
              {(() => {
                // Accurate ETA calculation based on route progress to next stop
                const busDetails = busSimulator.getBusDetails(bus.id);
                if (!busDetails || bus.speed === 0) return null;

                // Get route information
                const route = getRouteById(busDetails.routeId);
                if (!route) return null;

                // Find the next stop based on route progression (not just geographic distance)
                const currentWaypointIndex = busDetails.currentWaypointIndex;
                let nextStopIndex = -1;

                // Look for the next stop ahead on the route
                for (let i = 0; i < route.stops.length; i++) {
                  // Estimate which waypoint this stop is closest to
                  const stopWaypointIndex = Math.floor((i / route.stops.length) * route.waypoints.length);
                  if (stopWaypointIndex > currentWaypointIndex) {
                    nextStopIndex = i;
                    break;
                  }
                }

                // If no stop ahead found, wrap around to beginning (route loop)
                if (nextStopIndex === -1 && route.stops.length > 0) {
                  nextStopIndex = 0;
                }

                if (nextStopIndex === -1) return null;

                const nextStop = route.stops[nextStopIndex];
                if (!nextStop) return null;

                // Calculate actual distance to the next stop
                const distance = calculateDistance(
                  busDetails.location.lat,
                  busDetails.location.lng,
                  nextStop.lat,
                  nextStop.lng
                );

                // Ensure minimum reasonable distance (at least 0.1km to avoid showing 0 minutes)
                const effectiveDistance = Math.max(distance, 0.1);

                // Calculate ETA based on distance and current speed
                const estimatedTime = Math.max(1, Math.round((effectiveDistance / bus.speed) * 60));

                return (
                  <div className="mt-1 text-xs text-muted-foreground">
                    <span>ETA: ~{estimatedTime} min to {nextStop.name}</span>
                  </div>
                );
              })()}

              <div className="mt-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Occupancy</span>
                  <span className="font-medium">
                    {bus.capacity ? ((bus.passenger_count / bus.capacity) * 100).toFixed(1) : '0.0'}%
                  </span>
                </div>
                <div className="h-1 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(bus.capacity ? (bus.passenger_count / bus.capacity) * 100 : 0, 100)}%`
                    }}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
