import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { buses } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Calculate fleet statistics
    const routeStats: any = {};
    buses.forEach((bus: any) => {
      if (!routeStats[bus.route_name]) {
        routeStats[bus.route_name] = {
          totalBuses: 0,
          avgOccupancy: 0,
          avgSpeed: 0,
          totalPassengers: 0,
        };
      }
      routeStats[bus.route_name].totalBuses++;
      routeStats[bus.route_name].avgOccupancy += bus.avg_occupancy;
      routeStats[bus.route_name].avgSpeed += bus.speed;
      routeStats[bus.route_name].totalPassengers += bus.passenger_count;
    });

    // Average the stats
    Object.keys(routeStats).forEach((route) => {
      const count = routeStats[route].totalBuses;
      routeStats[route].avgOccupancy = (routeStats[route].avgOccupancy / count).toFixed(1);
      routeStats[route].avgSpeed = (routeStats[route].avgSpeed / count).toFixed(1);
    });

    const summary = JSON.stringify(routeStats, null, 2);

    console.log('Generating insights for fleet data');

    // Call AI to generate insights
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an AI fleet analyst. Analyze the following bus route statistics and generate 3 actionable insights. Each insight should be categorized as 'recommendation', 'alert', 'forecast', or 'optimization' with a priority level of 'low', 'medium', or 'high'.

Format your response as a JSON array with this structure:
[
  {
    "type": "recommendation|alert|forecast|optimization",
    "priority": "low|medium|high",
    "title": "Brief title (max 60 chars)",
    "description": "Detailed description (max 200 chars)"
  }
]

Route Statistics:
${summary}`,
          },
          {
            role: 'user',
            content: 'Generate 3 insights based on this fleet data.',
          },
        ],
        temperature: 0.8,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    let insights = [];

    try {
      const content = data.choices[0].message.content;
      // Try to parse JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      // Fallback insights
      insights = [
        {
          type: 'recommendation',
          priority: 'medium',
          title: 'Optimize Route Allocation',
          description: 'Consider adjusting bus frequency based on current occupancy patterns.',
        },
      ];
    }

    // Store insights in database
    const { error: insertError } = await supabase
      .from('ai_insights')
      .insert(insights);

    if (insertError) {
      console.error('Error inserting insights:', insertError);
    } else {
      console.log('Insights stored successfully');
    }

    return new Response(
      JSON.stringify({ success: true, insights }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Generate insights error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
