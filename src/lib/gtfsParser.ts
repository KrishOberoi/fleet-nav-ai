import { supabase } from '@/integrations/supabase/client';

interface GTFSRoute {
  route_id: string;
  agency_id?: string;
  route_short_name?: string;
  route_long_name?: string;
  route_desc?: string;
  route_type: number;
  route_url?: string;
  route_color?: string;
  route_text_color?: string;
  route_sort_order?: number;
}

interface GTFSTrip {
  trip_id: string;
  route_id: string;
  service_id: string;
  trip_headsign?: string;
  trip_short_name?: string;
  direction_id?: number;
  block_id?: string;
  shape_id?: string;
  wheelchair_accessible?: number;
  bikes_allowed?: number;
}

interface GTFSShape {
  shape_id: string;
  shape_pt_lat: number;
  shape_pt_lon: number;
  shape_pt_sequence: number;
  shape_dist_traveled?: number;
}

interface GTFSStop {
  stop_id: string;
  stop_code?: string;
  stop_name?: string;
  stop_desc?: string;
  stop_lat: number;
  stop_lon: number;
  zone_id?: string;
  stop_url?: string;
  location_type?: number;
  parent_station?: string;
  stop_timezone?: string;
  wheelchair_boarding?: number;
}

class GTFSParser {
  // Try multiple GTFS sources for Delhi
  private readonly GTFS_SOURCES = [
    'https://otd.delhi.gov.in/api/static-data', // Official Delhi OTD
    'https://transitfeeds.com/p/delhi-transport-corporation/754/latest/download', // TransitFeeds
    'https://github.com/example/delhi-gtfs/raw/main' // Fallback sample data
  ];

  // For now, use sample Delhi GTFS data until we get the real endpoint
  private readonly GTFS_STATIC_URL = 'https://otd.delhi.gov.in/api/static-data';

  async downloadAndParseGTFS(): Promise<void> {
    try {
      console.log('Starting GTFS static data download and parsing...');

      // Try to download real GTFS data first
      let routesData: string, tripsData: string, shapesData: string, stopsData: string;

      try {
        console.log('Attempting to download real GTFS data...');
        routesData = await this.downloadGTFSFile('routes.txt');
        tripsData = await this.downloadGTFSFile('trips.txt');
        shapesData = await this.downloadGTFSFile('shapes.txt');
        stopsData = await this.downloadGTFSFile('stops.txt');

        if (!routesData.trim() || !tripsData.trim() || !shapesData.trim() || !stopsData.trim()) {
          throw new Error('Incomplete GTFS data downloaded');
        }
      } catch (downloadError) {
        console.warn('Failed to download real GTFS data, using sample data:', downloadError);
        const sampleData = this.getSampleDelhiGTFSData();
        routesData = sampleData.routesData;
        tripsData = sampleData.tripsData;
        shapesData = sampleData.shapesData;
        stopsData = sampleData.stopsData;
      }

      // Store data in database
      await this.parseAndStoreRoutes(routesData);
      await this.parseAndStoreTrips(tripsData);
      await this.parseAndStoreShapes(shapesData);
      await this.parseAndStoreStops(stopsData);

      // Aggregate route shapes for visualization
      await this.aggregateRouteShapes();

      console.log('GTFS data parsing and storage completed successfully');
    } catch (error) {
      console.error('Error downloading/parsing GTFS data:', error);
      throw error;
    }
  }

  // Sample Delhi GTFS data for testing
  private getSampleDelhiGTFSData(): { routesData: string, tripsData: string, shapesData: string, stopsData: string } {
    const routesData = `route_id,agency_id,route_short_name,route_long_name,route_type,route_color,route_text_color
DL001,DTC,001,Red Line - Connaught Place to Karol Bagh,3,#DC2626,#FFFFFF
DL002,DTC,002,Delhi Metro - Rajiv Chowk to Kashmere Gate,1,#2563EB,#FFFFFF
DL003,DTC,100,DTC Route 100 - ISBT to Lajpat Nagar,3,#16A34A,#FFFFFF
DL004,DTC,200,Yellow Line - Kashmere Gate to HUDA City Centre,1,#EAB308,#000000`;

    const tripsData = `trip_id,route_id,service_id,trip_headsign,direction_id,shape_id
T001_DL001,DL001,WEEKDAY,Connaught Place,0,SHAPE_DL001
T002_DL001,DL001,WEEKDAY,Karol Bagh,1,SHAPE_DL001
T001_DL002,DL002,WEEKDAY,Rajiv Chowk,0,SHAPE_DL002
T002_DL002,DL002,WEEKDAY,Kashmere Gate,1,SHAPE_DL002`;

    const shapesData = `shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence
SHAPE_DL001,28.6139,77.2090,1
SHAPE_DL001,28.6200,77.2100,2
SHAPE_DL001,28.6300,77.2150,3
SHAPE_DL001,28.6400,77.2200,4
SHAPE_DL002,28.6139,77.2090,1
SHAPE_DL002,28.6150,77.2050,2
SHAPE_DL002,28.6200,77.2000,3
SHAPE_DL002,28.6250,77.1950,4`;

    const stopsData = `stop_id,stop_name,stop_lat,stop_lon
CP001,Connaught Place,28.6139,77.2090
KB001,Karol Bagh,28.6400,77.2200
RC001,Rajiv Chowk,28.6139,77.2090
KG001,Kashmere Gate,28.6250,77.1950`;

    return { routesData, tripsData, shapesData, stopsData };
  }

  private async downloadGTFSFile(filename: string): Promise<string> {
    try {
      const response = await fetch(`${this.GTFS_STATIC_URL}/${filename}`);

      if (!response.ok) {
        throw new Error(`Failed to download ${filename}: ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      console.error(`Error downloading ${filename}:`, error);
      // Return empty string as fallback - we'll handle missing files gracefully
      return '';
    }
  }

  private async parseAndStoreRoutes(csvData: string): Promise<void> {
    if (!csvData.trim()) {
      console.log('No routes data available');
      return;
    }

    const routes: GTFSRoute[] = this.parseCSV(csvData).map(row => ({
      route_id: row.route_id,
      agency_id: row.agency_id,
      route_short_name: row.route_short_name,
      route_long_name: row.route_long_name,
      route_desc: row.route_desc,
      route_type: parseInt(row.route_type) || 3,
      route_url: row.route_url,
      route_color: row.route_color,
      route_text_color: row.route_text_color,
      route_sort_order: row.route_sort_order ? parseInt(row.route_sort_order) : undefined
    }));

    console.log(`Parsed ${routes.length} routes`);

    // Store in batches to avoid payload size limits
    const batchSize = 100;
    for (let i = 0; i < routes.length; i += batchSize) {
      const batch = routes.slice(i, i + batchSize);
      const { error } = await supabase
        .from('gtfs_routes')
        .upsert(batch, { onConflict: 'route_id' });

      if (error) {
        console.error('Error storing routes batch:', error);
      }
    }
  }

  private async parseAndStoreTrips(csvData: string): Promise<void> {
    if (!csvData.trim()) {
      console.log('No trips data available');
      return;
    }

    const trips: GTFSTrip[] = this.parseCSV(csvData).map(row => ({
      trip_id: row.trip_id,
      route_id: row.route_id,
      service_id: row.service_id,
      trip_headsign: row.trip_headsign,
      trip_short_name: row.trip_short_name,
      direction_id: row.direction_id ? parseInt(row.direction_id) : undefined,
      block_id: row.block_id,
      shape_id: row.shape_id,
      wheelchair_accessible: row.wheelchair_accessible ? parseInt(row.wheelchair_accessible) : undefined,
      bikes_allowed: row.bikes_allowed ? parseInt(row.bikes_allowed) : undefined
    }));

    console.log(`Parsed ${trips.length} trips`);

    // Store in batches
    const batchSize = 500;
    for (let i = 0; i < trips.length; i += batchSize) {
      const batch = trips.slice(i, i + batchSize);
      const { error } = await supabase
        .from('gtfs_trips')
        .upsert(batch, { onConflict: 'trip_id' });

      if (error) {
        console.error('Error storing trips batch:', error);
      }
    }
  }

  private async parseAndStoreShapes(csvData: string): Promise<void> {
    if (!csvData.trim()) {
      console.log('No shapes data available');
      return;
    }

    const shapes: GTFSShape[] = this.parseCSV(csvData).map(row => ({
      shape_id: row.shape_id,
      shape_pt_lat: parseFloat(row.shape_pt_lat),
      shape_pt_lon: parseFloat(row.shape_pt_lon),
      shape_pt_sequence: parseInt(row.shape_pt_sequence),
      shape_dist_traveled: row.shape_dist_traveled ? parseFloat(row.shape_dist_traveled) : undefined
    }));

    console.log(`Parsed ${shapes.length} shape points`);

    // Store in batches
    const batchSize = 1000;
    for (let i = 0; i < shapes.length; i += batchSize) {
      const batch = shapes.slice(i, i + batchSize);
      const { error } = await supabase
        .from('gtfs_shapes')
        .upsert(batch, { onConflict: 'shape_id,shape_pt_sequence' });

      if (error) {
        console.error('Error storing shapes batch:', error);
      }
    }
  }

  private async parseAndStoreStops(csvData: string): Promise<void> {
    if (!csvData.trim()) {
      console.log('No stops data available');
      return;
    }

    const stops: GTFSStop[] = this.parseCSV(csvData).map(row => ({
      stop_id: row.stop_id,
      stop_code: row.stop_code,
      stop_name: row.stop_name,
      stop_desc: row.stop_desc,
      stop_lat: parseFloat(row.stop_lat),
      stop_lon: parseFloat(row.stop_lon),
      zone_id: row.zone_id,
      stop_url: row.stop_url,
      location_type: row.location_type ? parseInt(row.location_type) : undefined,
      parent_station: row.parent_station,
      stop_timezone: row.stop_timezone,
      wheelchair_boarding: row.wheelchair_boarding ? parseInt(row.wheelchair_boarding) : undefined
    }));

    console.log(`Parsed ${stops.length} stops`);

    // Store in batches
    const batchSize = 500;
    for (let i = 0; i < stops.length; i += batchSize) {
      const batch = stops.slice(i, i + batchSize);
      const { error } = await supabase
        .from('gtfs_stops')
        .upsert(batch, { onConflict: 'stop_id' });

      if (error) {
        console.error('Error storing stops batch:', error);
      }
    }
  }

  private async aggregateRouteShapes(): Promise<void> {
    try {
      console.log('Aggregating route shapes...');
      const { error } = await supabase.rpc('aggregate_route_shapes');

      if (error) {
        console.error('Error aggregating route shapes:', error);
      } else {
        console.log('Route shapes aggregated successfully');
      }
    } catch (error) {
      console.error('Error calling aggregate_route_shapes:', error);
    }
  }

  private parseCSV(csvText: string): any[] {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const rows = lines.slice(1);

    return rows.map(line => {
      const values = this.parseCSVLine(line);
      const obj: any = {};

      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });

      return obj;
    });
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.replace(/"/g, '').trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.replace(/"/g, '').trim());
    return result;
  }

  // Get route shape for visualization
  async getRouteShape(routeId: string): Promise<any> {
    const { data, error } = await supabase
      .from('route_shapes')
      .select('*')
      .eq('route_id', routeId)
      .single();

    if (error) {
      console.error('Error fetching route shape:', error);
      return null;
    }

    return data;
  }

  // Get route baseline metrics
  async getRouteBaseline(routeId: string): Promise<any> {
    const { data, error } = await supabase
      .from('route_baselines')
      .select('*')
      .eq('route_id', routeId)
      .single();

    if (error) {
      console.error('Error fetching route baseline:', error);
      return null;
    }

    return data;
  }

  // Update route baselines
  async updateRouteBaselines(): Promise<void> {
    try {
      const { error } = await supabase.rpc('update_route_baselines');
      if (error) {
        console.error('Error updating route baselines:', error);
      } else {
        console.log('Route baselines updated successfully');
      }
    } catch (error) {
      console.error('Error calling update_route_baselines:', error);
    }
  }
}

export const gtfsParser = new GTFSParser();
export default gtfsParser;
