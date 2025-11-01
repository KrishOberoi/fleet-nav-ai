import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { BusData } from '@/types/bus';
import { Loader2 } from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { busSimulator } from '@/lib/busSimulator';
import { getRouteById, getRouteProgress, delhiRoutes } from '@/lib/delhiRoutes';

// Add custom CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.3); opacity: 0.7; }
    100% { transform: scale(1); opacity: 1; }
  }
`;
document.head.appendChild(style);

interface BusMapProps {
  buses: BusData[];
  selectedBus: string | null;
  onSelectBus: (busNumber: string) => void;
}

export function BusMap({ buses, selectedBus, onSelectBus }: BusMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize Mapbox
  useEffect(() => {
    // You'll need to add your Mapbox access token
    const mapboxToken = 'pk.eyJ1Ijoia3Jpc2hvYmVyb2kiLCJhIjoiY21oYTVseTNmMWYzNDJpcGNzNHRsNWtubiJ9.1y4OKPXBtRxxSj7ULQ6M0Q';

    if (!mapboxToken || mapboxToken.includes('XXXXXXXXXXXXXXXX')) {
      setError('Mapbox access token not configured. Please add your Mapbox token.');
      setIsLoading(false);
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    if (mapRef.current) {
      try {
        console.log('Initializing Mapbox...');

        const map = new mapboxgl.Map({
          container: mapRef.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [77.2090, 28.6139], // Delhi [lng, lat]
          zoom: 11,
        });

        map.on('load', () => {
          console.log('Mapbox loaded successfully');
          mapInstanceRef.current = map;
          popupRef.current = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false
          });

          // Add bus route layers
          addBusRoutes(map);
          setIsLoading(false);
        });

        map.on('error', (e) => {
          console.error('Mapbox error:', e);
          setError('Failed to load Mapbox map');
          setIsLoading(false);
        });

      } catch (err) {
        console.error('Failed to initialize Mapbox:', err);
        setError('Failed to initialize Mapbox');
        setIsLoading(false);
      }
    }
  }, []);

  // Update markers when buses change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const currentBusNumbers = new Set(buses.map((b) => b.bus_number));

    // Remove markers for buses that no longer exist
    markersRef.current.forEach((marker, busNumber) => {
      if (!currentBusNumbers.has(busNumber)) {
        marker.remove();
        markersRef.current.delete(busNumber);
      }
    });

    // Add or update markers
    buses.forEach((bus) => {
      const position: [number, number] = [bus.location.lng, bus.location.lat];

      let marker = markersRef.current.get(bus.bus_number);

      if (marker) {
        // Update existing marker position
        marker.setLngLat(position);
      } else {
        // Create new marker
        const markerColor =
          bus.speed > 5 ? '#10b981' : // Active (green)
          bus.speed > 0 ? '#f59e0b' : // Idle (amber)
          '#ef4444'; // Stopped (red)

        // Create custom marker element
        const el = document.createElement('div');
        el.className = 'bus-marker';
        el.style.backgroundColor = markerColor;
        el.style.width = '20px';
        el.style.height = '20px';
        el.style.borderRadius = '50%';
        el.style.border = '3px solid white';
        el.style.boxShadow = '0 0 6px rgba(0,0,0,0.5)';
        el.style.cursor = 'pointer';

        marker = new mapboxgl.Marker(el)
          .setLngLat(position)
          .addTo(map);

        // Add click handler
        el.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent map click
          onSelectBus(bus.bus_number);

          const status = bus.speed > 5 ? 'Active' : bus.speed > 0 ? 'Idle' : 'Stopped';
          const busDetails = busSimulator.getBusDetails(bus.id);
          const stopInfo = busDetails?.currentStopName && bus.speed === 0
            ? `<p style="margin: 4px 0; font-size: 12px;"><strong>🛑 Stopped at:</strong> ${busDetails.currentStopName}</p>`
            : '';

          const popupContent = `
            <div style="color: #1e293b; padding: 8px; font-family: system-ui, sans-serif;">
              <h3 style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">${bus.bus_number}</h3>
              <p style="margin: 4px 0; font-size: 12px;"><strong>Route:</strong> ${bus.route_name}</p>
              <p style="margin: 4px 0; font-size: 12px;"><strong>Speed:</strong> ${bus.speed} km/h</p>
              <p style="margin: 4px 0; font-size: 12px;"><strong>Passengers:</strong> ${bus.passenger_count}/${bus.capacity}</p>
              <p style="margin: 4px 0; font-size: 12px;"><strong>Status:</strong> ${status}</p>
              ${stopInfo}
            </div>
          `;

          // Remove existing popup
          if (popupRef.current) {
            popupRef.current.remove();
          }

          // Create new popup
          popupRef.current = new mapboxgl.Popup({
            closeButton: true,
            closeOnClick: false
          })
            .setLngLat(position)
            .setHTML(popupContent)
            .addTo(map);
        });

        markersRef.current.set(bus.bus_number, marker);
      }

      // Highlight selected bus
      if (bus.bus_number === selectedBus) {
        // Add pulsing animation to selected marker
        const el = marker.getElement();
        el.style.animation = 'pulse 2s infinite';
        el.style.transform = 'scale(1.2)';
        el.style.zIndex = '9999'; // Ensure marker is on top

        // Pan to selected bus
        map.flyTo({
          center: position,
          zoom: 13,
          duration: 2000
        });

        // Show route for selected bus
        showBusRoute(bus, map);

        // Also show bus info popup when selected from list
        const status = bus.speed > 5 ? 'Active' : bus.speed > 0 ? 'Idle' : 'Stopped';
        const popupContent = `
          <div style="color: #1e293b; padding: 8px; font-family: system-ui, sans-serif;">
            <h3 style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">${bus.bus_number}</h3>
            <p style="margin: 4px 0; font-size: 12px;"><strong>Route:</strong> ${bus.route_name}</p>
            <p style="margin: 4px 0; font-size: 12px;"><strong>Speed:</strong> ${bus.speed} km/h</p>
            <p style="margin: 4px 0; font-size: 12px;"><strong>Passengers:</strong> ${bus.passenger_count}/${bus.capacity}</p>
            <p style="margin: 4px 0; font-size: 12px;"><strong>Status:</strong> ${status}</p>
          </div>
        `;

        // Remove existing popup
        if (popupRef.current) {
          popupRef.current.remove();
        }

        // Create bus info popup
        popupRef.current = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: false,
          offset: [0, -20]
        })
          .setLngLat(position)
          .setHTML(popupContent)
          .addTo(map);

        // Remove animation after 2 seconds
        setTimeout(() => {
          el.style.animation = '';
          el.style.transform = '';
          el.style.zIndex = '';
        }, 2000);
      } else {
        // Ensure non-selected markers have normal z-index
        const el = marker.getElement();
        el.style.zIndex = '100';
      }
    });
  }, [buses, selectedBus, onSelectBus]);

  // Function to add bus route visualizations
  const addBusRoutes = (map: mapboxgl.Map) => {
    // Simple route visualization - just show route lines between stops
    delhiRoutes.forEach((route: any, index: number) => {
      const routeId = `background-route-${route.id}`;

      // Create simple line between stops (not interpolated waypoints)
      const coordinates = route.stops.map((stop: any) => [stop.lng, stop.lat]);

      // Create GeoJSON for the route
      const routeGeoJSON = {
        type: 'Feature' as const,
        properties: {
          routeId: route.id,
          routeName: route.name
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: coordinates
        }
      };

      // Add route source
      map.addSource(routeId, {
        type: 'geojson',
        data: routeGeoJSON
      });

      // Add route layer with route-specific colors
      map.addLayer({
        id: routeId,
        type: 'line',
        source: routeId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': route.color,
          'line-width': 3,
          'line-opacity': 0.6
        }
      });

      console.log(`✅ Added background route: ${route.name}`);
    });
  };

  // Fallback function for sample routes
  const addSampleRoutes = (map: mapboxgl.Map) => {
    const routePaths = {
      'Red Line': [
        [77.1025, 28.7041],
        [77.2090, 28.6139],
        [77.3163, 28.5673],
      ],
      'Delhi Metro': [
        [77.1211, 28.6183],
        [77.2090, 28.6139],
        [77.2975, 28.6091],
      ],
      'DTC Route 100': [
        [77.1025, 28.7041],
        [77.2090, 28.6139],
        [77.3159, 28.5673],
      ]
    };

    Object.entries(routePaths).forEach(([routeName, coordinates]) => {
      const routeId = `route-${routeName.toLowerCase().replace(/\s+/g, '-')}`;

      map.addSource(routeId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: coordinates
          }
        }
      });

      map.addLayer({
        id: routeId,
        type: 'line',
        source: routeId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 3,
          'line-opacity': 0.7
        }
      });
    });
  };

  // Function to show route for selected bus
  const showBusRoute = (bus: BusData, map: mapboxgl.Map) => {
    try {
      // Remove existing route layers
      const existingLayers = map.getStyle().layers?.filter(layer =>
        layer.id.startsWith('selected-route-') ||
        layer.id.startsWith('route-stops-')
      ) || [];

      existingLayers.forEach(layer => {
        if (map.getLayer(layer.id)) {
          map.removeLayer(layer.id);
        }
        if (map.getSource(layer.id)) {
          map.removeSource(layer.id);
        }
      });

      // Get route data from delhiRoutes
      const route = delhiRoutes.find((r: any) => r.name === bus.route_name);

      if (route) {
        const routeId = `selected-route-${bus.bus_number}`;
        const stopsId = `route-stops-${bus.bus_number}`;

        // Create GeoJSON for the complete route
        const routeGeoJSON = {
          type: 'Feature' as const,
          properties: {
            routeId: route.id,
            routeName: route.name
          },
          geometry: {
            type: 'LineString' as const,
            coordinates: route.waypoints
          }
        };

        // Add route geometry as blue line
        map.addSource(routeId, {
          type: 'geojson',
          data: routeGeoJSON
        });

        map.addLayer({
          id: routeId,
          type: 'line',
          source: routeId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#2563eb', // Blue for selected route
            'line-width': 6,
            'line-opacity': 0.9
          }
        });

        // Add major stops as small circular markers
        const stopsGeoJSON = {
          type: 'FeatureCollection' as const,
          features: route.stops.map((stop: any, index: number) => ({
            type: 'Feature' as const,
            geometry: {
              type: 'Point' as const,
              coordinates: [stop.lng, stop.lat]
            },
            properties: {
              stop_id: `stop-${index}`,
              stop_name: stop.name,
              stop_sequence: index
            }
          }))
        };

        map.addSource(stopsId, {
          type: 'geojson',
          data: stopsGeoJSON
        });

        map.addLayer({
          id: stopsId,
          type: 'circle',
          source: stopsId,
          paint: {
            'circle-radius': 8,
            'circle-color': '#ffffff',
            'circle-stroke-color': '#2563eb',
            'circle-stroke-width': 3
          }
        });

        // Add click handler for bus stops to show stop names
        map.on('click', stopsId, (e) => {
          if (e.features && e.features[0]) {
            const stop = e.features[0];
            const stopName = stop.properties?.stop_name || 'Unknown Stop';
            const stopSequence = stop.properties?.stop_sequence || 0;

            // Remove existing popup
            if (popupRef.current) {
              popupRef.current.remove();
            }

            // Create stop info popup
            const stopPopupContent = `
              <div style="color: #1e293b; padding: 8px; font-family: system-ui, sans-serif;">
                <h3 style="font-weight: bold; margin-bottom: 4px; font-size: 14px;">🛑 Bus Stop</h3>
                <p style="margin: 4px 0; font-size: 12px;"><strong>Name:</strong> ${stopName}</p>
                <p style="margin: 4px 0; font-size: 12px;"><strong>Stop #:</strong> ${stopSequence + 1}</p>
              </div>
            `;

            popupRef.current = new mapboxgl.Popup({
              closeButton: true,
              closeOnClick: false,
              offset: [0, -10]
            })
              .setLngLat(e.lngLat)
              .setHTML(stopPopupContent)
              .addTo(map);
          }
        });

        // Change cursor on hover for stops
        map.on('mouseenter', stopsId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', stopsId, () => {
          map.getCanvas().style.cursor = '';
        });

        console.log(`✅ Displayed route for ${bus.bus_number}: ${route.name}`);
        console.log(`📊 Route stats: ${route.distance}km, ${route.estimatedTime}min`);
      } else {
        console.log(`❌ No route data available for ${bus.bus_number}: ${bus.route_name}`);
      }

    } catch (error) {
      console.error('Error showing bus route:', error);
    }
  };

  return (
    <Card className="h-full overflow-hidden border-border bg-card relative">
      <div ref={mapRef} className="w-full h-full" />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur-sm">
          <div className="text-center p-8">
            <p className="text-red-400 mb-2">{error}</p>
            <p className="text-sm text-muted-foreground">
              Add your Mapbox access token to see the map
            </p>
          </div>
        </div>
      )}
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/80 backdrop-blur-sm">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}
    </Card>
  );
}
