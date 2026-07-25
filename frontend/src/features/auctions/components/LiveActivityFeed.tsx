import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

/**
 * Sanitized live feed: only bid *counts* / activity ticks from auction_activity.
 * Never shows other users' bid values (matches Phase 1 security design).
 */
type Activity = {
  id: string;
  event_type: string;
  total_bids: number;
  created_at: string;
};

export default function LiveActivityFeed({ auctionId }: { auctionId: string }) {
  const [items, setItems] = useState<Activity[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from('auction_activity')
        .select('id, event_type, total_bids, created_at')
        .eq('auction_id', auctionId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (!cancelled && data) setItems(data as Activity[]);
    };
    load();

    const channel = supabase
      .channel(`auction-activity-${auctionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'auction_activity',
          filter: `auction_id=eq.${auctionId}`,
        },
        (payload) => {
          setItems((prev) =>
            [payload.new as Activity, ...prev].slice(0, 30)
          );
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [auctionId]);

  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 h-64 overflow-y-auto">
      <h4 className="font-semibold mb-3 text-slate-700">Live activity</h4>
      {items.length === 0 ? (
        <p className="text-slate-500 text-sm italic">No activity yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li
              key={a.id}
              className="flex justify-between text-sm text-slate-700"
            >
              <span>
                {a.event_type === 'bid_placed'
                  ? 'A bid was placed'
                  : a.event_type === 'auction_closed'
                    ? 'Auction closed'
                    : a.event_type}
              </span>
              <span className="text-slate-500 font-mono text-xs">
                {a.total_bids} bids ·{' '}
                {new Date(a.created_at).toLocaleTimeString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
