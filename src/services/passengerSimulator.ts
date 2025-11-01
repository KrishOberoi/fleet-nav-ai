import { createClient } from '@supabase/supabase-js';
import { ticketPricing } from './ticketPricing';

const SUPABASE_URL = "https://ponecvgchpqwxbsddcen.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbmVjdmdjaHBxd3hic2RkY2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMDg0NDQsImV4cCI6MjA3NjU4NDQ0NH0.U6iKFy-PM2ljPDTVWAOmIKErhADsm8G3KEfJ9pzHgaw";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export class PassengerSimulator {

  async simulateBoardingDeboarding(bus: any) {
    // Only generate income when bus is at a stop (speed = 0)
    if (bus.speed > 0) {
      return; // Bus is moving, no income generation
    }

    // Get route stops
    const { data: stops } = await supabase
      .from('stops')
      .select('*')
      .eq('route_id', bus.route_id)
      .order('stop_order');

    if (!stops || stops.length < 2) return;

    // Calculate distances between all stops
    const distances = ticketPricing.calculateCumulativeDistances(stops);

    // Find current bus position (nearest stop)
    const currentStopIndex = this.findNearestStopIndex(bus.location, stops);
    const currentStop = stops[currentStopIndex];

    // Check if bus is actually at the stop (within 50 meters)
    const distanceToStop = ticketPricing.calculateStopDistance(
      bus.location,
      { latitude: currentStop.latitude, longitude: currentStop.longitude }
    );

    if (distanceToStop > 0.05) { // 50 meters
      return; // Bus is not at a stop, no income generation
    }

    // Simulate boarding at current stop
    const boardingPassengers = this.generateBoardingCount(bus, currentStop);

    if (boardingPassengers > 0) {
      // Generate deboarding stops (where passengers will get off)
      const deboardingStops = this.generateDeboardingStops(
        currentStopIndex,
        stops,
        boardingPassengers
      );

      // Create ticket transactions
      for (const [deboardStopId, count] of deboardingStops.entries()) {
        const deboardStop = stops.find(s => s.stop_id === deboardStopId);

        const fromDist = distances.get(currentStop.stop_id) || 0;
        const toDist = distances.get(deboardStopId) || 0;
        const distance = Math.abs(toDist - fromDist);

        const ticketPrice = ticketPricing.calculateTicketPrice(distance);
        const totalIncome = ticketPrice * count;

        await supabase.from('ticket_transactions').insert({
          bus_id: bus.id,
          route_id: bus.route_id,
          boarding_stop_id: currentStop.stop_id,
          deboarding_stop_id: deboardStopId,
          passenger_count: count,
          distance_km: distance,
          ticket_price: ticketPrice,
          total_income: totalIncome
        });

        // Update stop pair income aggregates
        await this.updateStopPairIncome(
          bus.route_id,
          currentStop.stop_id,
          deboardStopId,
          count,
          totalIncome,
          distance
        );
      }

      console.log(`💰 Bus ${bus.id} generated income from ${boardingPassengers} passengers`);
    }
  }

  findNearestStopIndex(busLocation: any, stops: any[]): number {
    let minDist = Infinity;
    let nearestIndex = 0;

    for (let i = 0; i < stops.length; i++) {
      const dist = ticketPricing.calculateStopDistance(
        busLocation,
        { latitude: stops[i].latitude, longitude: stops[i].longitude }
      );
      if (dist < minDist) {
        minDist = dist;
        nearestIndex = i;
      }
    }

    return nearestIndex;
  }

  generateBoardingCount(bus: any, stop: any): number {
    const hour = new Date().getHours();
    const isPeakHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);

    // More passengers during peak hours
    const baseCount = isPeakHour ? 8 : 3;
    const variance = isPeakHour ? 5 : 2;

    return Math.floor(baseCount + Math.random() * variance);
  }

  generateDeboardingStops(currentIndex: number, stops: any[], passengerCount: number): Map<string, number> {
    const deboarding = new Map<string, number>();

    for (let i = 0; i < passengerCount; i++) {
      // Passengers more likely to travel short distances
      const maxStopsAhead = Math.min(stops.length - currentIndex - 1, 5);
      const stopsAhead = Math.ceil(Math.random() * Math.random() * maxStopsAhead) + 1;
      const deboardIndex = Math.min(currentIndex + stopsAhead, stops.length - 1);
      const deboardStopId = stops[deboardIndex].stop_id;

      deboarding.set(deboardStopId, (deboarding.get(deboardStopId) || 0) + 1);
    }

    return deboarding;
  }

  async updateStopPairIncome(routeId: string, fromStopId: string, toStopId: string, passengers: number, income: number, distance: number) {
    const { data: existing } = await supabase
      .from('stop_pair_income')
      .select('*')
      .eq('route_id', routeId)
      .eq('from_stop_id', fromStopId)
      .eq('to_stop_id', toStopId)
      .maybeSingle();

    if (existing) {
      const newTotalPassengers = existing.total_passengers + passengers;
      const newTotalIncome = existing.total_income + income;

      await supabase
        .from('stop_pair_income')
        .update({
          total_passengers: newTotalPassengers,
          total_income: newTotalIncome,
          avg_ticket_price: newTotalIncome / newTotalPassengers,
          last_updated: new Date().toISOString()
        })
        .eq('pair_id', existing.pair_id);
    } else {
      await supabase.from('stop_pair_income').insert({
        route_id: routeId,
        from_stop_id: fromStopId,
        to_stop_id: toStopId,
        total_passengers: passengers,
        total_income: income,
        avg_ticket_price: income / passengers,
        distance_km: distance
      });
    }
  }
}

export const passengerSimulator = new PassengerSimulator();
