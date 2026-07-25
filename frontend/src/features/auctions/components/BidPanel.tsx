import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';

type BidPanelProps = {
  auctionId: string;
  minPrice: number;
  maxPrice: number;
  increment: number;
};

export default function BidPanel({
  auctionId,
  minPrice,
  maxPrice,
  increment,
}: BidPanelProps) {
  const [bidValue, setBidValue] = useState(minPrice);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const bidMutation = useMutation({
    mutationFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Please log in to bid');

      const idempotencyKey = `${session.user.id}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

      return api.post(
        `/auctions/${auctionId}/bids`,
        { bidValueCents: bidValue },
        { headers: { 'Idempotency-Key': idempotencyKey } }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['auction', auctionId] });
      queryClient.invalidateQueries({ queryKey: ['my-bids', auctionId] });
      setError(null);
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.error?.message ||
        err.message ||
        'Bid failed. Please try again.';
      setError(msg);
    },
  });

  const handleBid = () => {
    if (
      bidValue < minPrice ||
      bidValue > maxPrice ||
      (bidValue - minPrice) % increment !== 0
    ) {
      setError(
        `Bid must be between ${minPrice} and ${maxPrice}, in steps of ${increment}`
      );
      return;
    }
    bidMutation.mutate();
  };

  return (
    <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-lg font-semibold mb-1">Place Your Bid</h3>
      <p className="text-sm text-slate-500 mb-4">Cost: 1 credit per bid</p>

      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">
            ¢
          </span>
          <input
            type="number"
            value={bidValue}
            onChange={(e) => setBidValue(Number(e.target.value))}
            className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2.5 text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            step={increment}
            min={minPrice}
            max={maxPrice}
          />
        </div>
        <button
          onClick={handleBid}
          disabled={bidMutation.isPending}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {bidMutation.isPending ? 'Bidding…' : 'Bid Now'}
        </button>
      </div>

      {error && (
        <p className="text-red-600 text-sm" role="alert">
          {error}
        </p>
      )}
      {bidMutation.isSuccess && !error && (
        <p className="text-emerald-600 text-sm">Bid placed successfully!</p>
      )}
    </div>
  );
}
