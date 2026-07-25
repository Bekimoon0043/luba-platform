import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../../config/supabase.js';
import { AuthRequest } from '../../middleware/auth.js';

// In-memory idempotency cache (replace with Redis in production)
const idempotencyCache = new Map<string, unknown>();

const placeBidSchema = z.object({
  bidValueCents: z.number().int().positive(),
});

export const placeBid = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const { auctionId } = req.params;
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

    if (!idempotencyKey) {
      return res.status(400).json({
        error: {
          code: 'MISSING_IDEMPOTENCY_KEY',
          message: 'Idempotency-Key header required',
        },
      });
    }

    const cacheKey = `${userId}:${idempotencyKey}`;
    if (idempotencyCache.has(cacheKey)) {
      return res.status(200).json({
        data: idempotencyCache.get(cacheKey),
        idempotent: true,
      });
    }

    const parsed = placeBidSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid bid payload',
          details: parsed.error.flatten(),
        },
      });
    }

    const { bidValueCents } = parsed.data;

    // Atomic, race-safe placement via SECURITY DEFINER function
    const { data, error } = await supabaseAdmin.rpc('fn_place_bid', {
      p_auction_id: auctionId,
      p_user_id: userId,
      p_bid_value_cents: bidValueCents,
    });

    if (error) {
      const codeMap: Record<string, string> = {
        P0001: 'AUCTION_NOT_FOUND',
        P0002: 'AUCTION_NOT_ACTIVE',
        P0003: 'AUCTION_OUTSIDE_WINDOW',
        P0004: 'BID_VALUE_INVALID',
        P0005: 'BID_SLOT_TAKEN',
        P0006: 'WALLET_NOT_FOUND',
        P0007: 'INSUFFICIENT_CREDITS',
      };
      const code = codeMap[error.code] || 'BID_FAILED';
      return res.status(400).json({
        error: {
          code,
          message: error.message,
          details: error.details,
        },
      });
    }

    // Cache successful result for 24h
    idempotencyCache.set(cacheKey, data);
    setTimeout(
      () => idempotencyCache.delete(cacheKey),
      24 * 60 * 60 * 1000
    );

    res.status(201).json({ data });
  } catch (err) {
    next(err);
  }
};
