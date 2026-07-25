import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { Users, Gavel, Hash } from 'lucide-react';

export default function AdminDashboard() {
  const queryClient = useQueryClient();

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await api.get('/admin/stats');
      return res.data?.data;
    },
  });

  const { data: auctions } = useQuery({
    queryKey: ['admin-auctions'],
    queryFn: async () => {
      const res = await api.get('/admin/auctions');
      return res.data?.data ?? [];
    },
  });

  const settleMutation = useMutation({
    mutationFn: (id: string) => api.post(`/auctions/${id}/settle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-auctions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['auctions'] });
    },
  });

  if (isLoading) {
    return <div className="p-8 text-slate-500">Loading dashboard…</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-600">
          Admin access required (role = admin). Sign in as an admin user.
        </p>
        <Link to="/" className="text-blue-600 text-sm mt-2 inline-block">
          ← Home
        </Link>
      </div>
    );
  }

  const cards = [
    {
      title: 'Total users',
      value: stats?.totalUsers ?? 0,
      icon: Users,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Active auctions',
      value: stats?.activeAuctions ?? 0,
      icon: Gavel,
      color: 'bg-purple-100 text-purple-600',
    },
    {
      title: 'Total bids',
      value: stats?.totalBids ?? 0,
      icon: Hash,
      color: 'bg-emerald-100 text-emerald-600',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-lg text-blue-700">Admin</span>
          <Link to="/" className="text-sm text-slate-600 hover:text-blue-600">
            ← Back to site
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Platform overview</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {cards.map((c) => (
            <div
              key={c.title}
              className="bg-white p-5 rounded-xl border shadow-sm flex items-center gap-4"
            >
              <div className={`p-3 rounded-full ${c.color}`}>
                <c.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{c.title}</p>
                <p className="text-2xl font-bold">{c.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="text-lg font-bold mb-4">Auctions</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-slate-500 border-b">
                <tr>
                  <th className="py-2 pr-4">Title</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Bids</th>
                  <th className="py-2 pr-4">Ends</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(auctions ?? []).map((a: any) => (
                  <tr key={a.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-medium">{a.title}</td>
                    <td className="py-3 pr-4 uppercase text-xs">{a.status}</td>
                    <td className="py-3 pr-4">{a.total_bids}</td>
                    <td className="py-3 pr-4 text-slate-500">
                      {a.ends_at
                        ? new Date(a.ends_at).toLocaleString()
                        : '—'}
                    </td>
                    <td className="py-3">
                      {a.status === 'active' && (
                        <button
                          type="button"
                          disabled={settleMutation.isPending}
                          onClick={() => settleMutation.mutate(a.id)}
                          className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded hover:bg-amber-200"
                        >
                          Force settle
                        </button>
                      )}
                      {a.status === 'settled' && a.winning_bid_cents != null && (
                        <span className="text-xs text-emerald-700">
                          Won @ ¢{a.winning_bid_cents}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!auctions?.length && (
              <p className="text-slate-500 py-4">No auctions found.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
