import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { Wallet } from 'lucide-react';

type Pack = {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  currency: string;
};

export default function WalletPanel() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      const res = await api.get('/wallet');
      return res.data?.data;
    },
  });

  const { data: packs } = useQuery({
    queryKey: ['credit-packs'],
    queryFn: async () => {
      const res = await api.get('/credit-packs');
      return (res.data?.data ?? []) as Pack[];
    },
  });

  const selected =
    packs?.find((p) => p.id === selectedId) ?? packs?.[0] ?? null;

  const topupMutation = useMutation({
    mutationFn: () =>
      api.post('/wallet/purchase', { creditPackId: selected!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-tx'] });
    },
  });

  return (
    <div className='p-6 bg-white rounded-xl shadow-sm border border-slate-200 max-w-2xl mx-auto'>
      <div className='flex items-center gap-3 mb-6'>
        <div className='p-2 rounded-full bg-blue-50'>
          <Wallet className='w-7 h-7 text-blue-600' />
        </div>
        <div>
          <h2 className='text-xl font-bold'>Your Wallet</h2>
          <p className='text-3xl font-mono text-blue-700'>
            {walletLoading ? '…' : `★ ${wallet?.credit_balance ?? 0}`}
            <span className='text-sm font-sans text-slate-500 ml-2'>credits</span>
          </p>
        </div>
      </div>

      <h3 className='text-lg font-semibold mb-3'>Buy credits (1 credit = 1 bid)</h3>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6'>
        {(packs ?? []).map((pack) => {
          const active = (selected?.id ?? '') === pack.id;
          return (
            <button
              key={pack.id}
              type='button'
              onClick={() => setSelectedId(pack.id)}
              className={
                'p-4 rounded-lg border-2 text-left transition-all ' +
                (active
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-slate-200 hover:border-blue-300')
              }
            >
              <div className='font-bold'>{pack.name}</div>
              <div className='text-2xl font-mono my-1'>{pack.credits}</div>
              <div className='text-slate-600 text-sm'>
                ${(pack.price_cents / 100).toFixed(2)} {pack.currency}
              </div>
            </button>
          );
        })}
      </div>

      {!packs?.length && (
        <p className='text-sm text-slate-500 mb-4'>
          No credit packs yet — run seed.sql in Supabase.
        </p>
      )}

      <button
        type='button'
        onClick={() => selected && topupMutation.mutate()}
        disabled={!selected || topupMutation.isPending}
        className='w-full bg-emerald-600 text-white py-3 rounded-lg font-semibold text-lg hover:bg-emerald-700 disabled:opacity-50'
      >
        {topupMutation.isPending
          ? 'Processing…'
          : selected
            ? `Get ${selected.credits} credits (demo — no real charge)`
            : 'Select a pack'}
      </button>

      {topupMutation.isSuccess && (
        <p className='text-emerald-600 text-sm mt-3'>Credits added.</p>
      )}
      {topupMutation.isError && (
        <p className='text-red-600 text-sm mt-3'>
          {(topupMutation.error as any)?.response?.data?.error?.message ||
            'Purchase failed'}
        </p>
      )}
    </div>
  );
}
