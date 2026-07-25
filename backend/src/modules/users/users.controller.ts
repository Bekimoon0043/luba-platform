import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../../config/supabase.js';
import { AuthRequest } from '../../middleware/auth.js';

const updateProfileSchema = z.object({
  full_name: z.string().min(1).max(120).optional(),
  username: z.string().min(3).max(40).optional(),
  avatar_url: z.string().url().optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  locale: z.string().max(10).optional(),
});

export const getMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, username, avatar_url, phone, role, locale, is_active, created_at')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return res.status(404).json({
        error: { code: 'PROFILE_NOT_FOUND', message: 'Profile not found' },
      });
    }

    res.json({ data });
  } catch (err) {
    next(err);
  }
};

export const updateMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid profile data',
          details: parsed.error.flatten(),
        },
      });
    }

    // Explicitly never allow role updates from this endpoint
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(parsed.data)
      .eq('id', userId)
      .select('id, full_name, username, avatar_url, phone, role, locale, is_active, created_at')
      .single();

    if (error) return next(error);
    res.json({ data });
  } catch (err) {
    next(err);
  }
};
