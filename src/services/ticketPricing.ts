export class TicketPricingService {

  // Base fare + per-km charges (Delhi bus pricing model)
  private BASE_FARE = 10; // ₹10 base fare
  private PER_KM_RATE = 1.5; // ₹1.50 per km
  private MIN_FARE = 10; // Minimum ₹10
  private MAX_FARE = 50; // Maximum ₹50 for longest routes

  calculateTicketPrice(distanceKm: number): number {
    const price = this.BASE_FARE + (distanceKm * this.PER_KM_RATE);
    return Math.min(Math.max(price, this.MIN_FARE), this.MAX_FARE);
  }

  calculateStopDistance(fromStop: any, toStop: any): number {
    // Haversine formula for distance
    const R = 6371; // Earth radius in km
    const dLat = (toStop.latitude - fromStop.latitude) * Math.PI / 180;
    const dLng = (toStop.longitude - fromStop.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(fromStop.latitude * Math.PI / 180) *
              Math.cos(toStop.latitude * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Calculate cumulative distance from route start to each stop
  calculateCumulativeDistances(stops: any[]): Map<string, number> {
    const distances = new Map<string, number>();
    let cumulative = 0;

    distances.set(stops[0].stop_id, 0);

    for (let i = 1; i < stops.length; i++) {
      const dist = this.calculateStopDistance(stops[i-1], stops[i]);
      cumulative += dist;
      distances.set(stops[i].stop_id, cumulative);
    }

    return distances;
  }
}

export const ticketPricing = new TicketPricingService();
