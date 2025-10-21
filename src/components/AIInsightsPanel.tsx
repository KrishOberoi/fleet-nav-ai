import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Lightbulb, AlertTriangle, TrendingUp, Zap } from 'lucide-react';
import { AIInsight } from '@/types/bus';
import { supabase } from '@/integrations/supabase/client';

export function AIInsightsPanel() {
  const [insights, setInsights] = useState<AIInsight[]>([]);

  useEffect(() => {
    fetchInsights();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('ai_insights_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_insights',
        },
        () => {
          fetchInsights();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchInsights = async () => {
    const { data, error } = await supabase
      .from('ai_insights')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (data && !error) {
      setInsights(data as AIInsight[]);
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'recommendation':
        return Lightbulb;
      case 'alert':
        return AlertTriangle;
      case 'forecast':
        return TrendingUp;
      case 'optimization':
        return Zap;
      default:
        return Lightbulb;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'recommendation':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'alert':
        return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'forecast':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
      case 'optimization':
        return 'text-green-400 bg-green-500/10 border-green-500/30';
      default:
        return 'text-muted-foreground';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'low':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="flex flex-col h-full bg-card border-border">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold">AI Insights</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time recommendations powered by AI
        </p>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {insights.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Lightbulb className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>AI insights will appear here</p>
              <p className="text-xs mt-1">Analyzing fleet data...</p>
            </div>
          ) : (
            insights.map((insight) => {
              const Icon = getInsightIcon(insight.type);
              return (
                <Card
                  key={insight.id}
                  className="p-4 border-border hover:border-primary/50 transition-all duration-200"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${getTypeColor(insight.type)}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-sm">{insight.title}</h3>
                        <Badge className={getPriorityColor(insight.priority)}>
                          {insight.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {insight.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs capitalize">
                          {insight.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(insight.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
