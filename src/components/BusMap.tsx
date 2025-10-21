import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { BusData } from '@/types/bus';
import { Loader2 } from 'lucide-react';

interface BusMapProps {
  buses: BusData[];
  selectedBus: string | null;
  onSelectBus: (busNumber: string) => void;
}

// Google Maps types
declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

export function BusMap({ buses, selectedBus, onSelectBus }: BusMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const infoWindowRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize Google Maps
  useEffect(() => {
    const apiKey = 'AIzaSyBjsINSfNP8wIYt-5HfhjKxVvi4SADwGuc'; // You'll need to add your key
    
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
      script.async = true;
      script.defer = true;
      script.onload = initializeMap;
      script.onerror = () => {
        setError('Failed to load Google Maps. Please check your API key.');
        setIsLoading(false);
      };
      document.head.appendChild(script);
    } else {
      initializeMap();
    }
  }, []);

  const initializeMap = () => {
    if (!mapRef.current || !window.google) return;

    try {
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: 40.7128, lng: -74.0060 },
        zoom: 12,
        styles: [
          {
            elementType: 'geometry',
            stylers: [{ color: '#1e293b' }],
          },
          {
            elementType: 'labels.text.stroke',
            stylers: [{ color: '#0f172a' }],
          },
          {
            elementType: 'labels.text.fill',
            stylers: [{ color: '#94a3b8' }],
          },
          {
            featureType: 'water',
            elementType: 'geometry',
            stylers: [{ color: '#164e63' }],
          },
          {
            featureType: 'road',
            elementType: 'geometry',
            stylers: [{ color: '#334155' }],
          },
        ],
        disableDefaultUI: true,
        zoomControl: true,
      });

      mapInstanceRef.current = map;
      infoWindowRef.current = new window.google.maps.InfoWindow();
      setIsLoading(false);
    } catch (err) {
      setError('Failed to initialize map');
      setIsLoading(false);
    }
  };

  // Update markers when buses change
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return;

    const map = mapInstanceRef.current;
    const currentBusNumbers = new Set(buses.map((b) => b.bus_number));

    // Remove markers for buses that no longer exist
    markersRef.current.forEach((marker, busNumber) => {
      if (!currentBusNumbers.has(busNumber)) {
        marker.setMap(null);
        markersRef.current.delete(busNumber);
      }
    });

    // Add or update markers
    buses.forEach((bus) => {
      const position = { lat: bus.location.lat, lng: bus.location.lng };
      
      let marker = markersRef.current.get(bus.bus_number);
      
      if (marker) {
        // Update existing marker
        marker.setPosition(position);
      } else {
        // Create new marker
        const markerColor = 
          bus.operational_status === 'active' ? '#10b981' :
          bus.operational_status === 'idle' ? '#f59e0b' :
          '#ef4444';

        marker = new window.google.maps.Marker({
          position,
          map,
          title: bus.bus_number,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: markerColor,
            fillOpacity: 0.9,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });

        marker.addListener('click', () => {
          onSelectBus(bus.bus_number);
          
          const content = `
            <div style="color: #1e293b; padding: 8px;">
              <h3 style="font-weight: bold; margin-bottom: 8px;">${bus.bus_number}</h3>
              <p style="margin: 4px 0;"><strong>Route:</strong> ${bus.route_name}</p>
              <p style="margin: 4px 0;"><strong>Speed:</strong> ${bus.speed} km/h</p>
              <p style="margin: 4px 0;"><strong>Passengers:</strong> ${bus.passenger_count}/${bus.capacity}</p>
              <p style="margin: 4px 0;"><strong>Status:</strong> ${bus.operational_status}</p>
            </div>
          `;
          
          infoWindowRef.current.setContent(content);
          infoWindowRef.current.open(map, marker);
        });

        markersRef.current.set(bus.bus_number, marker);
      }

      // Highlight selected bus
      if (bus.bus_number === selectedBus) {
        marker.setAnimation(window.google.maps.Animation.BOUNCE);
        map.panTo(position);
        setTimeout(() => marker.setAnimation(null), 2000);
      }
    });
  }, [buses, selectedBus, onSelectBus]);

  if (error) {
    return (
      <Card className="flex items-center justify-center h-full bg-card border-border">
        <div className="text-center p-8">
          <p className="text-red-400 mb-2">{error}</p>
          <p className="text-sm text-muted-foreground">
            Add your Google Maps API key to see the map
          </p>
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center h-full bg-card border-border">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </Card>
    );
  }

  return (
    <Card className="h-full overflow-hidden border-border bg-card">
      <div ref={mapRef} className="w-full h-full" />
    </Card>
  );
}
