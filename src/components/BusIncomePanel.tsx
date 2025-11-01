import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ponecvgchpqwxbsddcen.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbmVjdmdjaHBxd3hic2RkY2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMDg0NDQsImV4cCI6MjA3NjU4NDQ0NH0.U6iKFy-PM2ljPDTVWAOmIKErhADsm8G3KEfJ9pzHgaw";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export function BusIncomePanel({ selectedBusId }: { selectedBusId: string | null }) {
  const [incomeData, setIncomeData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedBusId) {
      fetchIncomeData(selectedBusId);
    }
  }, [selectedBusId]);

  const fetchIncomeData = async (busId: string) => {
    setLoading(true);

    try {
      // Get today's income
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: todayTransactions } = await supabase
        .from('ticket_transactions')
        .select('total_income, passenger_count, ticket_price')
        .eq('bus_id', busId)
        .gte('timestamp', today.toISOString());

      const todayIncome = todayTransactions?.reduce((sum, t) => sum + t.total_income, 0) || 0;
      const todayPassengers = todayTransactions?.reduce((sum, t) => sum + t.passenger_count, 0) || 0;
      const avgTicket = todayPassengers > 0 ? todayIncome / todayPassengers : 0;

      // Get last 7 days income
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const { data: weekTransactions } = await supabase
        .from('ticket_transactions')
        .select('total_income')
        .eq('bus_id', busId)
        .gte('timestamp', weekAgo.toISOString());

      const weekIncome = weekTransactions?.reduce((sum, t) => sum + t.total_income, 0) || 0;

      // Get top earning stop pairs
      const { data: topPairs } = await supabase
        .from('ticket_transactions')
        .select('boarding_stop_id, deboarding_stop_id, total_income, stops!boarding_stop_id(stop_name), stops!deboarding_stop_id(stop_name)')
        .eq('bus_id', busId)
        .order('total_income', { ascending: false })
        .limit(5);

      setIncomeData({
        todayIncome,
        todayPassengers,
        avgTicket,
        weekIncome,
        topPairs
      });
    } catch (error) {
      console.error('Error fetching income:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedBusId) {
    return (
      <div style={{ padding: '20px', color: '#888' }}>
        Select a bus to view income details
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  if (!incomeData) return null;

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      border: '1px solid #e0e0e0'
    }}>
      <h3 style={{ marginTop: 0 }}>💰 Income Summary - {selectedBusId}</h3>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
          ₹{incomeData.todayIncome.toFixed(2)}
        </div>
        <div style={{ fontSize: '12px', color: '#666' }}>Today's Income</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{incomeData.todayPassengers}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>Passengers Today</div>
        </div>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>₹{incomeData.avgTicket.toFixed(2)}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>Avg Ticket Price</div>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>₹{incomeData.weekIncome.toFixed(2)}</div>
        <div style={{ fontSize: '12px', color: '#666' }}>Last 7 Days Income</div>
      </div>

      {incomeData.topPairs && incomeData.topPairs.length > 0 && (
        <div>
          <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>Top Earning Routes</h4>
          {incomeData.topPairs.map((pair: any, idx: number) => (
            <div key={idx} style={{
              fontSize: '12px',
              padding: '8px',
              backgroundColor: '#fff',
              marginBottom: '5px',
              borderRadius: '4px',
              border: '1px solid #e0e0e0'
            }}>
              <div style={{ fontWeight: 'bold' }}>
                {pair.stops?.stop_name || 'Unknown'} → {pair.stops?.stop_name || 'Unknown'}
              </div>
              <div style={{ color: '#28a745' }}>₹{pair.total_income.toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
