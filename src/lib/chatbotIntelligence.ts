import { BusData } from '@/types/bus';
import { supabase } from '@/integrations/supabase/client';
import { dataPipeline } from './dataPipeline';

export type ChatIntent =
  | 'track_vehicle'
  | 'check_delay'
  | 'eta_query'
  | 'passenger_count'
  | 'maintenance_status'
  | 'check_anomalies'
  | 'get_insights'
  | 'optimize_route'
  | 'weather_impact'
  | 'schedule_query'
  | 'fleet_status'
  | 'get_alerts'
  | 'help'
  | 'greeting'
  | 'goodbye'
  | 'performance_report'
  | 'unknown';

interface IntentResult {
  intent: ChatIntent;
  confidence: number;
  entities: Record<string, any>;
}

interface ChatContext {
  currentBuses: BusData[];
  userQuery: string;
  conversationHistory: any[];
}

class ChatbotIntelligence {
  // More flexible patterns that allow natural language
  private intentPatterns: Record<ChatIntent, RegExp[]> = {
    track_vehicle: [
      /track.*bus/i,
      /where.*bus/i,
      /find.*bus/i,
      /locate.*bus/i,
      /bus.*location/i,
      /bus.*position/i,
      /show.*bus/i,
      /bus.*moving/i
    ],
    check_delay: [
      /delay/i,
      /late/i,
      /behind.*schedule/i,
      /running.*late/i,
      /schedule.*delay/i,
      /slow/i,
      /going.*slow/i,
      /running.*slow/i,
      /traffic/i,
      /stuck/i
    ],
    eta_query: [
      /eta/i,
      /estimate.*time/i,
      /how.*long/i,
      /when.*arrive/i,
      /next.*stop/i,
      /time.*to.*stop/i,
      /arrival.*time/i
    ],
    passenger_count: [
      /passenger/i,
      /how.*many.*people/i,
      /occupancy/i,
      /crowded/i,
      /full/i,
      /empty/i,
      /busy/i,
      /people.*on/i
    ],
    maintenance_status: [
      /maintenance/i,
      /repair/i,
      /broken/i,
      /service/i,
      /out.*of.*order/i,
      /not.*working/i,
      /problem.*with/i
    ],
    check_anomalies: [
      /anomal/i,
      /unusual/i,
      /abnormal/i,
      /strange/i,
      /weird/i,
      /issue/i,
      /problem/i,
      /something.*wrong/i,
      /not.*normal/i
    ],
    get_insights: [
      /insight/i,
      /analysis/i,
      /trend/i,
      /pattern/i,
      /summary/i,
      /overview/i,
      /how.*doing/i,
      /performance/i
    ],
    optimize_route: [
      /optimize/i,
      /improve/i,
      /efficient/i,
      /better.*route/i,
      /route.*optimization/i,
      /make.*better/i,
      /increase.*frequency/i
    ],
    weather_impact: [
      /weather/i,
      /rain/i,
      /storm/i,
      /temperature/i,
      /condition/i,
      /raining/i,
      /sunny/i,
      /cloudy/i
    ],
    schedule_query: [
      /schedule/i,
      /timetable/i,
      /timing/i,
      /frequency/i,
      /next.*bus/i,
      /when.*next/i,
      /how.*often/i
    ],
    fleet_status: [
      /fleet.*status/i,
      /overall.*status/i,
      /system.*status/i,
      /how.*fleet/i,
      /everything.*ok/i,
      /status/i
    ],
    get_alerts: [
      /alert/i,
      /warning/i,
      /notification/i,
      /urgent/i,
      /any.*alerts/i,
      /what.*happening/i
    ],
    help: [
      /help/i,
      /what.*can.*do/i,
      /command/i,
      /function/i,
      /how.*work/i,
      /what.*commands/i
    ],
    greeting: [
      /hello/i,
      /hi/i,
      /hey/i,
      /good.*morning/i,
      /good.*afternoon/i,
      /good.*evening/i,
      /sup/i,
      /yo/i
    ],
    goodbye: [
      /bye/i,
      /goodbye/i,
      /see.*you/i,
      /exit/i,
      /quit/i,
      /later/i,
      /thanks/i
    ],
    performance_report: [
      /performance/i,
      /report/i,
      /statistics/i,
      /metrics/i,
      /efficiency/i,
      /numbers/i,
      /stats/i
    ],
    unknown: [
      // Empty array for unknown intents
    ]
  };

  async analyzeIntent(query: string): Promise<IntentResult> {
    const normalizedQuery = query.toLowerCase().trim();

    // Score each intent based on pattern matches
    const intentScores: Record<string, number> = {};

    for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(normalizedQuery)) {
          score += 1;
        }
      }
      if (score > 0) {
        intentScores[intent] = score;
      }
    }

    // Find the highest scoring intent
    const bestIntent = Object.entries(intentScores)
      .sort(([,a], [,b]) => b - a)[0];

    if (bestIntent && bestIntent[1] > 0) {
      return {
        intent: bestIntent[0] as ChatIntent,
        confidence: Math.min(bestIntent[1] * 0.3, 0.9), // Scale confidence
        entities: this.extractEntities(query, bestIntent[0] as ChatIntent)
      };
    }

    // Fallback: Try to infer intent from keywords
    return this.inferIntentFromKeywords(normalizedQuery);
  }

  private inferIntentFromKeywords(query: string): IntentResult {
    const entities = this.extractEntities(query, 'unknown');

    // Bus-related queries
    if (query.includes('bus') || entities.busNumber) {
      if (query.includes('where') || query.includes('location') || query.includes('track')) {
        return { intent: 'track_vehicle', confidence: 0.6, entities };
      }
      if (query.includes('slow') || query.includes('delay') || query.includes('late')) {
        return { intent: 'check_delay', confidence: 0.6, entities };
      }
      if (query.includes('passenger') || query.includes('crowded') || query.includes('full')) {
        return { intent: 'passenger_count', confidence: 0.6, entities };
      }
    }

    // Route-related queries
    if (query.includes('route') || entities.routeName) {
      if (query.includes('optimize') || query.includes('improve')) {
        return { intent: 'optimize_route', confidence: 0.7, entities };
      }
    }

    // General queries
    if (query.includes('status') || query.includes('how') || query.includes('doing')) {
      return { intent: 'fleet_status', confidence: 0.5, entities };
    }

    if (query.includes('anomal') || query.includes('problem') || query.includes('issue')) {
      return { intent: 'check_anomalies', confidence: 0.6, entities };
    }

    return {
      intent: 'unknown',
      confidence: 0,
      entities
    };
  }

  private extractEntities(query: string, intent: ChatIntent): Record<string, any> {
    const entities: Record<string, any> = {};

    // Extract bus numbers
    const busMatch = query.match(/bus\s*(\w+)/i) || query.match(/(\w+)\s*bus/i);
    if (busMatch) {
      entities.busNumber = busMatch[1].toUpperCase();
    }

    // Extract route names
    const routeMatch = query.match(/route\s*([\w\s]+)/i);
    if (routeMatch) {
      entities.routeName = routeMatch[1].trim();
    }

    // Extract time references
    const timeMatch = query.match(/(\d+)\s*(hour|minute|min)/i);
    if (timeMatch) {
      entities.timeValue = parseInt(timeMatch[1]);
      entities.timeUnit = timeMatch[2].toLowerCase();
    }

    return entities;
  }

  async generateResponse(context: ChatContext): Promise<string> {
    const { currentBuses, userQuery, conversationHistory } = context;

    const intentResult = await this.analyzeIntent(userQuery);
    const { intent, entities } = intentResult;

    switch (intent) {
      case 'track_vehicle':
        return this.handleTrackVehicle(currentBuses, entities);

      case 'check_delay':
        return this.handleCheckDelay(currentBuses, entities);

      case 'eta_query':
        return this.handleETAQuery(currentBuses, entities);

      case 'passenger_count':
        return this.handlePassengerCount(currentBuses, entities);

      case 'maintenance_status':
        return this.handleMaintenanceStatus(currentBuses, entities);

      case 'check_anomalies':
        return this.handleCheckAnomalies(currentBuses, entities);

      case 'get_insights':
        return this.handleGetInsights(currentBuses, entities);

      case 'optimize_route':
        return this.handleOptimizeRoute(currentBuses, entities);

      case 'weather_impact':
        return this.handleWeatherImpact(currentBuses, entities);

      case 'schedule_query':
        return this.handleScheduleQuery(currentBuses, entities);

      case 'fleet_status':
        return this.handleFleetStatus(currentBuses, entities);

      case 'get_alerts':
        return this.handleGetAlerts(currentBuses, entities);

      case 'help':
        return this.handleHelp();

      case 'greeting':
        return this.handleGreeting();

      case 'goodbye':
        return this.handleGoodbye();

      case 'performance_report':
        return this.handlePerformanceReport(currentBuses, entities);

      default:
        return this.handleUnknownQuery();
    }
  }

  private handleTrackVehicle(buses: BusData[], entities: any): string {
    if (entities.busNumber) {
      const bus = buses.find(b => b.bus_number.includes(entities.busNumber));
      if (bus) {
        return `🚍 Bus ${bus.bus_number} on route "${bus.route_name}" is currently at coordinates (${bus.location.lat.toFixed(4)}, ${bus.location.lng.toFixed(4)}) traveling at ${bus.speed} km/h with ${bus.passenger_count}/${bus.capacity} passengers.`;
      } else {
        return `❌ I couldn't find a bus with number "${entities.busNumber}". Please check the bus number and try again.`;
      }
    }

    const sampleBuses = buses.slice(0, 3);
    let response = "📍 Here are the current locations of some buses:\n\n";
    sampleBuses.forEach(bus => {
      response += `• ${bus.bus_number} (${bus.route_name}): ${bus.speed} km/h, ${bus.passenger_count}/${bus.capacity} passengers\n`;
    });
    response += "\nSpecify a bus number for detailed tracking.";
    return response;
  }

  private async handleCheckDelay(buses: BusData[], entities: any): Promise<string> {
    if (entities.busNumber) {
      // Check specific bus for delay
      const bus = buses.find(b => b.bus_number.includes(entities.busNumber));
      if (!bus) {
        return `❌ I couldn't find a bus with number "${entities.busNumber}".`;
      }

      const delayInfo = await dataPipeline.checkForDelays(bus.id);
      if (!delayInfo) {
        return `✅ Bus ${bus.bus_number} is running on schedule.`;
      }

      if (delayInfo.isDelayed) {
        return `⚠️ Bus ${bus.bus_number} is DELAYED by ${delayInfo.delayMinutes.toFixed(1)} minutes!\n\n• Expected arrival at ${delayInfo.nextStop}: ${delayInfo.expectedArrival.toLocaleTimeString()}\n• Current ETA: ${delayInfo.actualArrival.toLocaleTimeString()}\n• Current speed: ${bus.speed} km/h`;
      } else {
        return `✅ Bus ${bus.bus_number} is on schedule.\n\n• Next stop: ${delayInfo.nextStop}\n• ETA: ${delayInfo.expectedArrival.toLocaleTimeString()}\n• Current speed: ${bus.speed} km/h`;
      }
    }

    // Check all buses for delays
    const delayPromises = buses.map(bus => dataPipeline.checkForDelays(bus.id));
    const delayResults = await Promise.all(delayPromises);

    const delayedBuses = delayResults.filter(result => result?.isDelayed);
    const onTimeBuses = delayResults.filter(result => result && !result.isDelayed);

    if (delayedBuses.length === 0) {
      return `✅ All buses are running on schedule!\n\n• ${onTimeBuses.length} buses checked\n• No delays detected`;
    }

    let response = `⚠️ ${delayedBuses.length} bus(es) currently delayed:\n\n`;
    delayedBuses.slice(0, 5).forEach(delay => {
      if (delay) {
        response += `• ${delay.nextStop}: ${delay.delayMinutes.toFixed(1)} min delay\n`;
      }
    });

    if (delayedBuses.length > 5) {
      response += `\n... and ${delayedBuses.length - 5} more delayed buses`;
    }

    response += `\n\n✅ ${onTimeBuses.length} buses running on schedule`;

    return response;
  }

  private async handleETAQuery(buses: BusData[], entities: any): Promise<string> {
    if (entities.busNumber) {
      const bus = buses.find(b => b.bus_number.includes(entities.busNumber));
      if (!bus) {
        return `❌ I couldn't find a bus with number "${entities.busNumber}".`;
      }

      const eta = await dataPipeline.calculateETA(bus.id);
      if (!eta) {
        return `❌ Unable to calculate ETA for bus ${bus.bus_number}.`;
      }

      const arrivalTime = new Date(Date.now() + eta.estimatedTime * 60000);
      return `🕐 Bus ${bus.bus_number} ETA to next stop:\n\n• Next stop: ${eta.nextStopName}\n• Distance: ${eta.distanceToStop.toFixed(1)} km\n• ETA: ${eta.estimatedTime.toFixed(1)} minutes (${arrivalTime.toLocaleTimeString()})\n• Current speed: ${eta.currentSpeed} km/h\n• Historical avg speed: ${eta.historicalAvgSpeed} km/h${eta.isDelayed ? `\n⚠️ Delayed by ${eta.delayMinutes.toFixed(1)} minutes` : '\n✅ On schedule'}`;
    }

    return "🕐 Please specify a bus number for ETA information. For example: 'ETA for bus DL001' or 'when will DL005 arrive at next stop?'";
  }

  private handlePassengerCount(buses: BusData[], entities: any): string {
    if (entities.busNumber) {
      const bus = buses.find(b => b.bus_number.includes(entities.busNumber));
      if (bus) {
        const occupancyRate = bus.capacity ? ((bus.passenger_count / bus.capacity) * 100).toFixed(1) : '0.0';
        return `👥 Bus ${bus.bus_number} currently has ${bus.passenger_count}/${bus.capacity} passengers (${occupancyRate}% capacity).`;
      }
    }

    const totalPassengers = buses.reduce((sum, b) => sum + b.passenger_count, 0);
    const totalCapacity = buses.reduce((sum, b) => sum + (b.capacity || 0), 0);
    const avgOccupancy = totalCapacity > 0 ? ((totalPassengers / totalCapacity) * 100).toFixed(1) : '0.0';

    return `👥 Fleet Overview:\n• Total passengers: ${totalPassengers}\n• Average occupancy: ${avgOccupancy}%\n• Busiest bus: ${this.findBusiestBus(buses)}`;
  }

  private handleMaintenanceStatus(buses: BusData[], entities: any): string {
    // Since we don't have maintenance data, we'll simulate based on low speeds
    const potentiallyBroken = buses.filter(b => b.speed === 0);
    if (potentiallyBroken.length === 0) {
      return "✅ All buses appear to be operational. No maintenance issues detected.";
    }

    let response = "🔧 Potential maintenance issues:\n\n";
    potentiallyBroken.forEach(bus => {
      response += `• ${bus.bus_number} (${bus.route_name}): Stationary (may need maintenance)\n`;
    });

    return response;
  }

  private async handleCheckAnomalies(buses: BusData[], entities: any): Promise<string> {
    // For now, use real-time anomaly detection
    // TODO: Integrate with database anomalies table after migration
    const anomalies = this.detectRealtimeAnomalies(buses);
    if (anomalies.length === 0) {
      return "✅ No anomalies detected in current fleet operations.";
    }

    let response = "🚨 Real-time Anomalies Detected:\n\n";
    anomalies.forEach(anomaly => {
      response += `• ${anomaly}\n`;
    });

    return response;
  }

  private handleGetInsights(buses: BusData[], entities: any): string {
    const totalBuses = buses.length;
    const avgSpeed = buses.reduce((sum, b) => sum + b.speed, 0) / totalBuses;
    const totalPassengers = buses.reduce((sum, b) => sum + b.passenger_count, 0);
    const avgOccupancy = buses.reduce((sum, b) => sum + (b.capacity ? (b.passenger_count / b.capacity) * 100 : 0), 0) / totalBuses;

    const routeStats = this.getRouteStats(buses);

    let response = "📊 Fleet Insights:\n\n";
    response += `• Total buses: ${totalBuses}\n`;
    response += `• Average speed: ${avgSpeed.toFixed(1)} km/h\n`;
    response += `• Total passengers: ${totalPassengers}\n`;
    response += `• Average occupancy: ${avgOccupancy.toFixed(1)}%\n\n`;

    response += "🏆 Top Performing Routes:\n";
    routeStats.slice(0, 3).forEach(stat => {
      response += `• ${stat.route}: ${stat.avgOccupancy.toFixed(1)}% occupancy\n`;
    });

    return response;
  }

  private handleOptimizeRoute(buses: BusData[], entities: any): string {
    if (entities.routeName) {
      const routeBuses = buses.filter(b => b.route_name.toLowerCase().includes(entities.routeName.toLowerCase()));
      if (routeBuses.length === 0) {
        return `❌ No buses found for route "${entities.routeName}".`;
      }

      const avgOccupancy = routeBuses.reduce((sum, b) => sum + (b.capacity ? (b.passenger_count / b.capacity) * 100 : 0), 0) / routeBuses.length;
      const avgSpeed = routeBuses.reduce((sum, b) => sum + b.speed, 0) / routeBuses.length;

      let recommendations = [];

      if (avgOccupancy > 80) {
        recommendations.push("• Increase frequency - high demand detected");
      } else if (avgOccupancy < 30) {
        recommendations.push("• Consider reducing frequency - low utilization");
      }

      if (avgSpeed < 20) {
        recommendations.push("• Investigate traffic congestion on route");
      }

      return `🎯 Route Optimization for "${entities.routeName}":\n\nCurrent Metrics:\n• Average occupancy: ${avgOccupancy.toFixed(1)}%\n• Average speed: ${avgSpeed.toFixed(1)} km/h\n\nRecommendations:\n${recommendations.join('\n')}`;
    }

    return "🎯 Route Optimization:\n\nPlease specify a route name for optimization analysis. For example: 'optimize Red Line' or 'optimize route Delhi Metro'.";
  }

  private handleWeatherImpact(buses: BusData[], entities: any): string {
    // Simulate weather impact analysis
    const avgSpeed = buses.reduce((sum, b) => sum + b.speed, 0) / buses.length;
    const slowBuses = buses.filter(b => b.speed < 15).length;

    if (slowBuses > buses.length * 0.3) {
      return "🌧️ Weather Impact Detected:\n\n• High number of slow-moving buses suggests adverse weather conditions\n• Consider implementing weather-based speed limits\n• Monitor for increased delays on outdoor routes";
    } else {
      return "☀️ No significant weather impact detected:\n\n• Fleet operating at normal speeds\n• Weather conditions appear favorable for operations";
    }
  }

  private handleScheduleQuery(buses: BusData[], entities: any): string {
    // Since we don't have schedule data, provide frequency analysis
    const routeFrequency = this.analyzeRouteFrequency(buses);

    let response = "🕐 Schedule Analysis:\n\n";
    routeFrequency.forEach(route => {
      response += `• ${route.name}: ${route.busCount} buses active\n`;
    });

    response += "\n💡 For detailed schedules, please check the official Delhi Transport Corporation website.";

    return response;
  }

  private handleFleetStatus(buses: BusData[], entities: any): string {
    const totalBuses = buses.length;
    const activeBuses = buses.filter(b => b.speed > 0).length;
    const avgSpeed = buses.reduce((sum, b) => sum + b.speed, 0) / totalBuses;
    const totalPassengers = buses.reduce((sum, b) => sum + b.passenger_count, 0);

    const status = activeBuses > totalBuses * 0.8 ? "🟢 Excellent" :
                   activeBuses > totalBuses * 0.6 ? "🟡 Good" : "🔴 Needs Attention";

    return `${status} Fleet Status:\n\n• Active buses: ${activeBuses}/${totalBuses} (${((activeBuses/totalBuses)*100).toFixed(1)}%)\n• Average speed: ${avgSpeed.toFixed(1)} km/h\n• Total passengers: ${totalPassengers}\n• System health: ${activeBuses > totalBuses * 0.8 ? 'Optimal' : 'Monitor closely'}`;
  }

  private async handleGetAlerts(buses: BusData[], entities: any): Promise<string> {
    try {
      const { data: alerts } = await supabase
        .from('ai_insights')
        .select('*')
        .in('type', ['alert', 'forecast'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (alerts && alerts.length > 0) {
        let response = "🚨 Active Alerts:\n\n";
        alerts.forEach(alert => {
          response += `• ${alert.priority.toUpperCase()}: ${alert.title}\n`;
        });
        return response;
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }

    return "✅ No active alerts at this time.";
  }

  private handleHelp(): string {
    return `🤖 Fleet Assistant Commands:

🚍 VEHICLE TRACKING
• "Track bus DL001" - Locate specific bus
• "Where is bus DL005?" - Find bus location

🕐 ETA & SCHEDULES
• "ETA for bus DL001" - Time to next stop
• "When will DL005 arrive?" - Arrival estimates
• "Next stop for DL007" - Stop information

👥 PASSENGER INFO
• "Passenger count on Red Line" - Check occupancy
• "How crowded is the Delhi Metro?" - Occupancy analysis

⚠️ OPERATIONAL STATUS
• "Is bus DL001 delayed?" - Check specific delays
• "Check for delays" - Find all delayed buses
• "Maintenance status" - Check for issues
• "Any anomalies?" - Detect unusual activity

📊 ANALYTICS
• "Fleet insights" - Performance summary
• "Performance report" - Detailed metrics
• "Optimize Red Line" - Route optimization

🔔 ALERTS & STATUS
• "Fleet status" - Overall system health
• "Get alerts" - Active notifications
• "Weather impact" - Weather-related issues

💡 Try: "Which buses are at stops?" or "Show me route performance"`;
  }

  private handleGreeting(): string {
    return "👋 Hello! I'm your Fleet Assistant. I can help you track buses, analyze performance, detect anomalies, and optimize routes. What would you like to know about your Delhi transit fleet?";
  }

  private handleGoodbye(): string {
    return "👋 Goodbye! Your fleet is running smoothly. Feel free to ask me anything about transit operations anytime!";
  }

  private handlePerformanceReport(buses: BusData[], entities: any): string {
    const totalBuses = buses.length;
    const avgSpeed = buses.reduce((sum, b) => sum + b.speed, 0) / totalBuses;
    const totalPassengers = buses.reduce((sum, b) => sum + b.passenger_count, 0);
    const avgOccupancy = buses.reduce((sum, b) => sum + (b.capacity ? (b.passenger_count / b.capacity) * 100 : 0), 0) / totalBuses;

    const topRoutes = this.getRouteStats(buses).slice(0, 3);
    const speedDistribution = this.getSpeedDistribution(buses);

    let response = "📈 Performance Report - Delhi Transit Fleet\n\n";
    response += "🎯 OVERALL METRICS:\n";
    response += `• Fleet size: ${totalBuses} buses\n`;
    response += `• Average speed: ${avgSpeed.toFixed(1)} km/h\n`;
    response += `• Total passengers: ${totalPassengers}\n`;
    response += `• Average occupancy: ${avgOccupancy.toFixed(1)}%\n\n`;

    response += "🏆 TOP ROUTES:\n";
    topRoutes.forEach(route => {
      response += `• ${route.route}: ${route.avgOccupancy.toFixed(1)}% occupancy\n`;
    });

    response += "\n📊 SPEED DISTRIBUTION:\n";
    Object.entries(speedDistribution).forEach(([range, count]) => {
      response += `• ${range}: ${count} buses\n`;
    });

    return response;
  }

  private handleUnknownQuery(): string {
    return "🤔 I'm not sure what you're asking. Try one of these:\n\n• 'Track bus DL001' - Find a specific bus\n• 'Check for delays' - See if any buses are running late\n• 'Fleet status' - Get overall system health\n• 'Help' - See all available commands\n\nWhat would you like to know about your fleet?";
  }

  // Helper methods
  private findBusiestBus(buses: BusData[]): string {
    const busiest = buses.reduce((max, bus) =>
      (bus.passenger_count > max.passenger_count) ? bus : max
    );
    return `${busiest.bus_number} (${busiest.passenger_count} passengers)`;
  }

  private getRouteStats(buses: BusData[]): Array<{route: string, avgOccupancy: number, busCount: number}> {
    const routeGroups = buses.reduce((acc, bus) => {
      if (!acc[bus.route_name]) {
        acc[bus.route_name] = [];
      }
      acc[bus.route_name].push(bus);
      return acc;
    }, {} as Record<string, BusData[]>);

    return Object.entries(routeGroups).map(([route, routeBuses]) => ({
      route,
      avgOccupancy: routeBuses.reduce((sum, b) => sum + (b.capacity ? (b.passenger_count / b.capacity) * 100 : 0), 0) / routeBuses.length,
      busCount: routeBuses.length
    })).sort((a, b) => b.avgOccupancy - a.avgOccupancy);
  }

  private detectRealtimeAnomalies(buses: BusData[]): string[] {
    const anomalies: string[] = [];

    // Check for stationary buses
    const stationary = buses.filter(b => b.speed === 0);
    if (stationary.length > 0) {
      anomalies.push(`${stationary.length} buses are stationary (possible maintenance issues)`);
    }

    // Check for overcrowded buses
    const overcrowded = buses.filter(b => b.capacity && (b.passenger_count / b.capacity) > 1.2);
    if (overcrowded.length > 0) {
      anomalies.push(`${overcrowded.length} buses are over capacity`);
    }

    // Check for very slow buses
    const verySlow = buses.filter(b => b.speed < 5 && b.speed > 0);
    if (verySlow.length > 0) {
      anomalies.push(`${verySlow.length} buses moving very slowly (< 5 km/h)`);
    }

    return anomalies;
  }

  private analyzeRouteFrequency(buses: BusData[]): Array<{name: string, busCount: number}> {
    const routeGroups = buses.reduce((acc, bus) => {
      acc[bus.route_name] = (acc[bus.route_name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(routeGroups)
      .map(([name, busCount]) => ({ name, busCount }))
      .sort((a, b) => b.busCount - a.busCount);
  }

  private getSpeedDistribution(buses: BusData[]): Record<string, number> {
    const distribution = {
      '0-10 km/h': 0,
      '10-20 km/h': 0,
      '20-30 km/h': 0,
      '30-40 km/h': 0,
      '40+ km/h': 0
    };

    buses.forEach(bus => {
      if (bus.speed < 10) distribution['0-10 km/h']++;
      else if (bus.speed < 20) distribution['10-20 km/h']++;
      else if (bus.speed < 30) distribution['20-30 km/h']++;
      else if (bus.speed < 40) distribution['30-40 km/h']++;
      else distribution['40+ km/h']++;
    });

    return distribution;
  }
}

export const chatbotIntelligence = new ChatbotIntelligence();
export default chatbotIntelligence;
