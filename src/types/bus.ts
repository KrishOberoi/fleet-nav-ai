export interface Location {
  lat: number;
  lng: number;
}

export interface BusData {
  id: string;
  timestamp: string;
  bus_number: string;
  route_name: string;
  location: Location;
  speed: number;
  avg_speed: number;
  passenger_count: number;
  capacity: number;
  avg_occupancy: number;
  total_journey_time: number;
  estimated_journey_time: number;
  is_under_maintenance: boolean;
  operational_status: 'active' | 'idle' | 'maintenance';
  total_moving_time: number;
  total_stopping_time: number;
  delay_time: number;
  embedding?: number[];
  created_at?: string;
}

export interface AIInsight {
  id: string;
  type: 'recommendation' | 'alert' | 'forecast' | 'optimization';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  created_at: string;
}

export interface FleetStats {
  totalActiveBuses: number;
  totalPassengers: number;
  avgOccupancy: number;
  peakDemandTime: string;
  busesUnderMaintenance: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
