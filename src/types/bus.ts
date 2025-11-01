export interface Location {
  lat: number;
  lng: number;
}

export interface BusData {
  // ESP32 sensor data only
  id: string;
  bus_number: string;
  route_name: string;
  location: Location;
  speed: number;
  passenger_count: number;
  timestamp: string;
  capacity?: number; // Optional static config
  
  // Optional fields for database
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
