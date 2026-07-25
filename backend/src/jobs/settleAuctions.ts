import { supabaseAdmin } from '../config/supabase.js';

/**
 * Auto-settlement job for auctions that have passed ends_at.
 * Run via cron (Render Cron, GitHub Actions, or node-cron).
 *
 * Usage:
 *   npm run job:settle
 * or call settleClosedAuctions() from a scheduled endpoint.
 */
export async function settleClosedAuctions() {
  console.log('🔄 Running auction settlement job...');

  const { data: auctions, error } = await supabaseAdmin
    .from('auctions')
    .select('id, title')
    .eq('status', 'active')
    .lte('ends_at', new Date().toISOString());

  if (error) {
    console.error('Failed to fetch closed auctions:', error);
    return;
  }

  if (!auctions?.length) {
    console.log('No auctions ready to settle.');
    return;
  }

  for (const auction of auctions) {
    console.log(`Settling auction: ${auction.title} (${auction.id})`);
    const { data, error: settleError } = await supabaseAdmin.rpc(
      'fn_settle_auction',
      { p_auction_id: auction.id }
    );

    if (settleError) {
      console.error(`Failed to settle ${auction.id}:`, settleError);
    } else {
      const winner = Array.isArray(data) ? data[0] : data;
      console.log(
        `✅ Settled successfully. Winner:`,
        winner?.winner_user_id ?? 'none'
      );
      // TODO: dispatch win notification (email / in-app)
    }
  }
}

// Allow running as a standalone script
const isMain =
  process.argv[1]?.endsWith('settleAuctions.ts') ||
  process.argv[1]?.endsWith('settleAuctions.js');

if (isMain) {
  settleClosedAuctions()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
