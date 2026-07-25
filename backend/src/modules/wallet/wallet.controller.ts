import { Response, NextFunction } from 'express';
import { z } from 'zod';
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

const purchaseSchema = z.object({
  creditPackId: z.string().uuid(),
});

/**
 * Credit-pack purchase.
 * Production: Stripe Checkout + webhook before calling fn_add_credits.
 * Demo: credits immediately via fn_add_credits.
 */
export const purchaseCredits = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const parsed = purchaseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'creditPackId (uuid) required',
          details: parsed.error.flatten(),
        },
      });
    }

    const { creditPackId } = parsed.data;

    const { data: pack, error: packError } = await supabaseAdmin
      .from('credit_packs')
      .select('id, name, credits, price_cents, is_active')
      .eq('id', creditPackId)
      .eq('is_active', true)
      .single();

    if (packError || !pack) {
      return res.status(404).json({
        error: { code: 'PACK_NOT_FOUND', message: 'Credit pack not found' },
      });
    }

    const { data, error } = await supabaseAdmin.rpc('fn_add_credits', {
      p_user_id: userId,
      p_credits: pack.credits,
      p_description: `Credit Pack: ${pack.name}`,
      p_provider_ref: `demo-${Date.now()}`,
    });

    if (error) {
      return res.status(400).json({
        error: { code: 'TOPUP_FAILED', message: error.message },
      });
    }

    const row = Array.isArray(data) ? data[0] : data;
    res.json({
      data: {
        newBalance: row?.new_balance,
        txId: row?.tx_id,
        pack,
      },
      message: 'Credits added successfully (demo mode — no real payment)',
    });
  } catch (err) {
    next(err);
  }
};
