import { Routes, Route, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from './lib/api';
import BidPanel from './features/auctions/components/BidPanel';

function Home() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['auctions'],
    queryFn: async () => {
      const res = await api.get('/auctions');
      return res.data;
    },
  });

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-bold text-xl tracking-tight text-blue-700">
            LUBA
          </Link>
          <nav className="flex gap-4 text-sm font-medium text-slate-600">
            <Link to="/" className="hover:text-blue-600">
              Auctions
            </Link>
            <Link to="/wallet" className="hover:text-blue-600">
              Wallet
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Live Auctions</h1>

        {isLoading && <p className="text-slate-500">Loading auctions…</p>}
        {error && (
          <p className="text-red-600">
            Could not load auctions. Is the backend running?
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.data ?? []).map((a: any) => (
            <Link
              key={a.id}
              to={`/auctions/${a.id}`}
              className="block bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                {a.status}
              </div>
              <h2 className="font-semibold text-slate-900 line-clamp-2">
                {a.title || a.product_title}
              </h2>
              <p className="text-sm text-slate-500 mt-2">
                {a.total_bids ?? 0} bids · ends{' '}
                {a.ends_at
                  ? new Date(a.ends_at).toLocaleString()
                  : '—'}
              </p>
            </Link>
          ))}
        </div>

        {!isLoading && !(data?.data?.length) && (
          <p className="text-slate-500">
            No auctions yet. Apply the schema and seed data in Supabase.
          </p>
        )}
      </main>
    </div>
  );
}

function AuctionDetail() {
  const id = window.location.pathname.split('/').pop() || '';
  const { data, isLoading } = useQuery({
    queryKey: ['auction', id],
    queryFn: async () => {
      const res = await api.get(`/auctions/${id}`);
      return res.data?.data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-slate-500">
        Loading…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <p className="text-red-600">Auction not found.</p>
        <Link to="/" className="text-blue-600 text-sm mt-2 inline-block">
          ← Back
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
          <Link to="/" className="text-sm text-blue-600 hover:underline">
            ← Back to auctions
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            {data.status}
          </div>
          <h1 className="text-2xl font-bold mt-1">
            {data.title || data.product_title}
          </h1>
          <p className="text-slate-500 mt-2">
            Range: ¢{data.min_price_cents} – ¢{data.max_price_cents} (step{' '}
            {data.price_increment_cents}) · {data.total_bids ?? 0} bids
          </p>
        </div>

        {data.status === 'active' && (
          <BidPanel
            auctionId={data.id}
            minPrice={data.min_price_cents}
            maxPrice={data.max_price_cents}
            increment={data.price_increment_cents}
          />
        )}

        {data.status === 'settled' && data.winning_bid_cents != null && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <p className="font-medium text-emerald-800">
              Winning bid: ¢{data.winning_bid_cents}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function WalletPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      const res = await api.get('/wallet');
      return res.data?.data;
    },
  });

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-bold text-xl text-blue-700">
            LUBA
          </Link>
          <Link to="/" className="text-sm text-slate-600 hover:text-blue-600">
            Auctions
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">My Wallet</h1>
        {isLoading && <p className="text-slate-500">Loading…</p>}
        {data && (
          <div className="bg-white border rounded-xl p-6">
            <p className="text-sm text-slate-500">Credit balance</p>
            <p className="text-4xl font-display font-bold text-blue-700 mt-1">
              ★ {data.credit_balance}
            </p>
          </div>
        )}
        {!isLoading && !data && (
          <p className="text-slate-500">
            Sign in to view your wallet (Supabase Auth required).
          </p>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/auctions/:id" element={<AuctionDetail />} />
      <Route path="/wallet" element={<WalletPage />} />
    </Routes>
  );
}
