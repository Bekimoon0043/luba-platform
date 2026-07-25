import { Response, NextFunction } from 'express';
import { supabaseAdmin } from '../../config/supabase.js';
import { AuthRequest } from '../../middleware/auth.js';

export const getWallet = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const { data, error } = await supabaseAdmin
      .from('wallets')
      .select('id, credit_balance, updated_at')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return res.status(404).json({
        error: { code: 'WALLET_NOT_FOUND', message: 'Wallet not found' },
      });
    }

    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const getWalletTransactions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await supabaseAdmin
      .from('wallet_transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) return next(error);

    res.json({
      data,
      meta: { page, pageSize, total: count ?? 0 },
    });
  } catch (err) {
    next(err);
  }
};

export const listCreditPacks = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('credit_packs')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) return next(error);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
