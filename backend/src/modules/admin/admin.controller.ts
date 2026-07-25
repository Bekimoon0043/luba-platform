import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../../config/supabase.js';
import { AuthRequest } from '../../middleware/auth.js';

export const getPlatformStats = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const [
      { count: totalUsers },
      { count: activeAuctions },
      { count: totalBids },
      { data: purchaseTxs },
    ] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true }),
      supabaseAdmin
        .from('auctions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabaseAdmin
        .from('bids')
        .select('*', { count: 'exact', head: true }),
      supabaseAdmin
        .from('wallet_transactions')
        .select('amount')
        .eq('type', 'credit_purchase'),
    ]);

    const creditsSold =
      purchaseTxs?.reduce((sum, t) => sum + (t.amount > 0 ? t.amount : 0), 0) ||
      0;

    res.json({
      data: {
        totalUsers: totalUsers ?? 0,
        activeAuctions: activeAuctions ?? 0,
        totalBids: totalBids ?? 0,
        creditsSold,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const listUsers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

    let query = supabaseAdmin
      .from('profiles')
      .select(
        'id, full_name, username, role, is_active, created_at',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (q) {
      query = query.or(`username.ilike.%${q}%,full_name.ilike.%${q}%`);
    }

    const { data, count, error } = await query;
    if (error) return next(error);

    res.json({
      data,
      meta: { page, pageSize, total: count ?? 0 },
    });
  } catch (err) {
    next(err);
  }
};

export const listAuctionsAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status } = req.query;
    let query = supabaseAdmin
      .from('auctions')
      .select(
        'id, title, status, total_bids, starts_at, ends_at, winner_user_id, winning_bid_cents, product_id'
      )
      .order('ends_at', { ascending: true })
      .limit(50);

    if (status && typeof status === 'string') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) return next(error);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
