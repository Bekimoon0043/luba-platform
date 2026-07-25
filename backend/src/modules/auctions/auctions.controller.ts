import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../../config/supabase.js';
import { AuthRequest } from '../../middleware/auth.js';

export const getAuctions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status, page = '1', pageSize = '20' } = req.query;
    let query = supabaseAdmin
      .from('v_auction_public')
      .select('*', { count: 'exact' });

    if (status && typeof status === 'string') {
      query = query.eq('status', status);
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const size = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const from = (pageNum - 1) * size;
    const to = from + size - 1;

    const { data, count, error } = await query
      .range(from, to)
      .order('ends_at', { ascending: true });

    if (error) return next(error);

    res.json({
      data,
      meta: { page: pageNum, pageSize: size, total: count ?? 0 },
    });
  } catch (err) {
    next(err);
  }
};

export const getAuctionById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { auctionId } = req.params;
    const { data, error } = await supabaseAdmin
      .from('v_auction_public')
      .select('*')
      .eq('id', auctionId)
      .single();

    if (error || !data) {
      return res.status(404).json({
        error: { code: 'AUCTION_NOT_FOUND', message: 'Auction not found' },
      });
    }

    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const settleAuction = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { auctionId } = req.params;
    const { data, error } = await supabaseAdmin.rpc('fn_settle_auction', {
      p_auction_id: auctionId,
    });

    if (error) {
      return res.status(400).json({
        error: { code: 'SETTLE_FAILED', message: error.message },
      });
    }

    res.json({ data, message: 'Auction settled successfully' });
  } catch (err) {
    next(err);
  }
};
