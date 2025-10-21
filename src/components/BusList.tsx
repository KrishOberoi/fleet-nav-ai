import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, MapPin, Users, Gauge } from 'lucide-react';
import { BusData } from '@/types/bus';

interface BusListProps {
  buses: BusData[];
  selectedBus: string | null;
  onSelectBus: (busNumber: string) => void;
}

export function BusList({ buses, selectedBus, onSelectBus }: BusListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBuses = buses.filter(
    (bus) =>
      bus.bus_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bus.route_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'idle':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'maintenance':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="flex flex-col h-full bg-card border-border">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold mb-3">Fleet Overview</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search bus or route..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary border-border"
          />
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {filteredBuses.map((bus) => (
            <Card
              key={bus.bus_number}
              className={`p-4 cursor-pointer transition-all duration-200 hover:border-primary/50 ${
                selectedBus === bus.bus_number ? 'border-primary bg-primary/5' : 'border-border'
              }`}
              onClick={() => onSelectBus(bus.bus_number)}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-lg">{bus.bus_number}</h3>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <MapPin className="w-3 h-3" />
                    <span>{bus.route_name}</span>
                  </div>
                </div>
                <Badge className={getStatusColor(bus.operational_status)}>
                  {bus.operational_status}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-cyan-400" />
                  <div>
                    <p className="text-xs text-muted-foreground">Speed</p>
                    <p className="text-sm font-medium">{bus.speed} km/h</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-green-400" />
                  <div>
                    <p className="text-xs text-muted-foreground">Passengers</p>
                    <p className="text-sm font-medium">
                      {bus.passenger_count}/{bus.capacity}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Occupancy</span>
                  <span className="font-medium">{bus.avg_occupancy.toFixed(1)}%</span>
                </div>
                <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(bus.avg_occupancy, 100)}%` }}
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
