import { supabaseAdmin } from '../config/supabase.js';

/**
 * Notify winners of recently settled auctions (in-app notification row).
 */
export async function notifyRecentWinners() {
  console.log('🔔 Checking for recent winners to notify...');

  const lookback = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: auctions, error } = await supabaseAdmin
    .from('auctions')
    .select('id, title, winner_user_id, winning_bid_cents, settled_at')
    .eq('status', 'settled')
    .not('winner_user_id', 'is', null)
    .gte('settled_at', lookback);

  if (error) {
    console.error('Failed to fetch settled auctions:', error);
    return;
  }

  if (!auctions?.length) {
    console.log('No recent winners to notify.');
    return;
  }

  for (const auction of auctions) {
    if (!auction.winner_user_id) continue;

    const { data: existing } = await supabaseAdmin
      .from('notifications')
      .select('id')
      .eq('user_id', auction.winner_user_id)
      .contains('metadata', { auction_id: auction.id, type: 'auction_won' })
      .limit(1);

    if (existing && existing.length > 0) continue;

    const cents = auction.winning_bid_cents ?? 0;
    const { error: insertError } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: auction.winner_user_id,
        channel: 'in_app',
        title: 'You won an auction!',
        body: `Congratulations — you won "${auction.title}" at ¢${cents}.`,
        status: 'sent',
        metadata: {
          type: 'auction_won',
          auction_id: auction.id,
          winning_bid_cents: cents,
        },
      });

    if (insertError) {
      console.error(`Notify failed for ${auction.id}:`, insertError);
    } else {
      console.log(`✅ Notified winner of ${auction.title} (${auction.id})`);
    }
  }
}

const isMain =
  process.argv[1]?.endsWith('notifyWinners.ts') ||
  process.argv[1]?.endsWith('notifyWinners.js');

if (isMain) {
  notifyRecentWinners()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
