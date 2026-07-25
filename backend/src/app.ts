import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requireAuth, requireAdmin } from './middleware/auth.js';
import { placeBid } from './modules/bids/bids.controller.js';
import {
  getAuctions,
  getAuctionById,
  settleAuction,
} from './modules/auctions/auctions.controller.js';
import {
  getWallet,
  getWalletTransactions,
  listCreditPacks,
} from './modules/wallet/wallet.controller.js';
import { getMe, updateMe } from './modules/users/users.controller.js';
import { settleClosedAuctions } from './jobs/settleAuctions.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
  })
);
app.use(express.json());

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

app.get('/api/v1/ready', async (_req, res) => {
  try {
    // Lightweight DB check via service role
    const { error } = await (
      await import('./config/supabase.js')
    ).supabaseAdmin.from('credit_packs').select('id').limit(1);
    if (error) throw error;
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not_ready' });
  }
});

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------
app.get('/api/v1/auctions', getAuctions);
app.get('/api/v1/auctions/:auctionId', getAuctionById);
app.get('/api/v1/credit-packs', listCreditPacks);

// ---------------------------------------------------------------------------
// Authenticated
// ---------------------------------------------------------------------------
app.get('/api/v1/users/me', requireAuth, getMe);
app.patch('/api/v1/users/me', requireAuth, updateMe);
app.get('/api/v1/wallet', requireAuth, getWallet);
app.get('/api/v1/wallet/transactions', requireAuth, getWalletTransactions);
app.post(
  '/api/v1/auctions/:auctionId/bids',
  requireAuth,
  placeBid
);

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
app.post(
  '/api/v1/auctions/:auctionId/settle',
  requireAuth,
  requireAdmin,
  settleAuction
);

// Optional: protect with a shared secret header in production
app.post('/api/v1/jobs/settle-auctions', async (_req, res, next) => {
  try {
    await settleClosedAuctions();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(err.status || 500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: err.message || 'Something went wrong',
      },
    });
  }
);

export default app;
