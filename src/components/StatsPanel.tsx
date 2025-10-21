import { Card } from '@/components/ui/card';
import { Bus, Users, TrendingUp, Clock, Wrench } from 'lucide-react';
import { FleetStats } from '@/types/bus';

interface StatsPanelProps {
  stats: FleetStats;
}

export function StatsPanel({ stats }: StatsPanelProps) {
  const statCards = [
    {
      title: 'Active Buses',
      value: stats.totalActiveBuses,
      icon: Bus,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
    },
    {
      title: 'Total Passengers',
      value: stats.totalPassengers,
      icon: Users,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Avg Occupancy',
      value: `${stats.avgOccupancy}%`,
      icon: TrendingUp,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Peak Demand',
      value: stats.peakDemandTime,
      icon: Clock,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: 'Under Maintenance',
      value: stats.busesUnderMaintenance,
      icon: Wrench,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 p-4">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title} className="p-4 bg-card border-border hover:border-primary/50 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
              <div className={`${stat.bgColor} ${stat.color} p-3 rounded-lg`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
