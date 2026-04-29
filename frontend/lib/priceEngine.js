// In-memory price engine supporting BOTH:
//   - OTC synthetic assets (Geometric Brownian Motion ticks every 250ms)
//   - LIVE assets (prices pushed in via onLiveTick from Finnhub WS / REST poller)
// Aggregates candles per interval (5s/15s/60s) for both kinds and broadcasts ticks
// to SSE streamers.

import { LIVE_ASSETS, OTC_TO_LIVE } from './liveAssetsConfig';

// OTC synthetic markets. Only XAUUSD anchors to a real live feed; the rest
// are pure synthetic exotic forex pairs that don't have free public live
// quotes available, so they run as standalone GBM markets with reasonable
// realistic mid-market base rates.
const OTC_ASSETS = {
  // Gold OTC — anchored to live XAU/USD
  XAUUSD:  { name: 'Gold (OTC)',     display: 'XAU/USD',     price: 2350.0, vol: 0.05,  drift: 0.0, decimals: 3, payout: 0.85 },
  // Exotic forex pairs (pure synthetic, anchored only to hardcoded base price)
  USDPHP:  { name: 'USD/PHP (OTC)',  display: 'USD/PHP',     price: 56.40,  vol: 0.04,  drift: 0.0, decimals: 4, payout: 0.95 },
  USDARS:  { name: 'USD/ARS (OTC)',  display: 'USD/ARS',     price: 1010.0, vol: 0.06,  drift: 0.0, decimals: 3, payout: 0.94 },
  USDBDT:  { name: 'USD/BDT (OTC)',  display: 'USD/BDT',     price: 110.30, vol: 0.04,  drift: 0.0, decimals: 4, payout: 0.93 },
  USDCOP:  { name: 'USD/COP (OTC)',  display: 'USD/COP',     price: 4120.0, vol: 0.05,  drift: 0.0, decimals: 3, payout: 0.93 },
  NZDCAD:  { name: 'NZD/CAD (OTC)',  display: 'NZD/CAD',     price: 0.8320, vol: 0.04,  drift: 0.0, decimals: 5, payout: 0.92 },
  NZDUSD:  { name: 'NZD/USD (OTC)',  display: 'NZD/USD',     price: 0.6120, vol: 0.04,  drift: 0.0, decimals: 5, payout: 0.92 },
  USDINR:  { name: 'USD/INR (OTC)',  display: 'USD/INR',     price: 84.20,  vol: 0.03,  drift: 0.0, decimals: 4, payout: 0.92 },
  USDDZD:  { name: 'USD/DZD (OTC)',  display: 'USD/DZD',     price: 134.50, vol: 0.04,  drift: 0.0, decimals: 4, payout: 0.91 },
  USDBRL:  { name: 'USD/BRL (OTC)',  display: 'USD/BRL',     price: 5.78,   vol: 0.05,  drift: 0.0, decimals: 5, payout: 0.90 },
  CADCHF:  { name: 'CAD/CHF (OTC)',  display: 'CAD/CHF',     price: 0.6480, vol: 0.04,  drift: 0.0, decimals: 5, payout: 0.88 },
  EURNZD:  { name: 'EUR/NZD (OTC)',  display: 'EUR/NZD',     price: 1.7820, vol: 0.04,  drift: 0.0, decimals: 5, payout: 0.88 },
  USDPKR:  { name: 'USD/PKR (OTC)',  display: 'USD/PKR',     price: 278.40, vol: 0.04,  drift: 0.0, decimals: 4, payout: 0.88 },
  AUDNZD:  { name: 'AUD/NZD (OTC)',  display: 'AUD/NZD',     price: 1.0710, vol: 0.04,  drift: 0.0, decimals: 5, payout: 0.86 },
  USDMXN:  { name: 'USD/MXN (OTC)',  display: 'USD/MXN',     price: 18.10,  vol: 0.05,  drift: 0.0, decimals: 5, payout: 0.85 },
  NZDCHF:  { name: 'NZD/CHF (OTC)',  display: 'NZD/CHF',     price: 0.5400, vol: 0.04,  drift: 0.0, decimals: 5, payout: 0.84 },
  USDEGP:  { name: 'USD/EGP (OTC)',  display: 'USD/EGP',     price: 49.10,  vol: 0.05,  drift: 0.0, decimals: 4, payout: 0.83 },
  NZDJPY:  { name: 'NZD/JPY (OTC)',  display: 'NZD/JPY',     price: 95.20,  vol: 0.04,  drift: 0.0, decimals: 3, payout: 0.82 },
  GBPNZD:  { name: 'GBP/NZD (OTC)',  display: 'GBP/NZD',     price: 2.0710, vol: 0.04,  drift: 0.0, decimals: 5, payout: 0.78 },
  USDIDR:  { name: 'USD/IDR (OTC)',  display: 'USD/IDR',     price: 15820,  vol: 0.04,  drift: 0.0, decimals: 2, payout: 0.77 },
  USDNGN:  { name: 'USD/NGN (OTC)',  display: 'USD/NGN',     price: 1620,   vol: 0.05,  drift: 0.0, decimals: 2, payout: 0.77 },
};

function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Supported candle intervals in seconds: 5s, 15s, 1m, 3m, 5m, 10m.
const INTERVALS_SEC = [5, 15, 60, 180, 300, 600];
const EMPTY_CANDLES = () => Object.fromEntries(INTERVALS_SEC.map(i => [i, []]));
const EMPTY_CURRENT = () => Object.fromEntries(INTERVALS_SEC.map(i => [i, null]));

function newAssetState(symbol, def, kind) {
  return {
    symbol,
    kind, // 'otc' | 'live'
    name: def.name,
    display: def.display || symbol,
    price: def.price || 0,
    basePrice: def.price || 0,
    vol: def.vol || 0.1,
    drift: def.drift || 0,
    decimals: def.decimals,
    payout: def.payout,
    support: (def.price || 0) * 0.994,
    resistance: (def.price || 0) * 1.006,
    candles: EMPTY_CANDLES(),
    currentCandle: EMPTY_CURRENT(),
    pendingNudge: 0,
    nudgeTicksLeft: 0,
    streamers: new Set(),
    lastTickT: 0,
    seeded: kind === 'otc'
  };
}

function prewarmOTC(s, def) {
  const now = Date.now();
  let lastClose = def.price;
  s.candles = EMPTY_CANDLES();
  s.currentCandle = EMPTY_CURRENT();
  for (const interval of INTERVALS_SEC) {
    let p = def.price;
    const arr = s.candles[interval];
    for (let i = 80; i > 0; i--) {
      const tStart = Math.floor((now - i * interval * 1000) / (interval * 1000)) * (interval * 1000);
      const o = p;
      let h = o, l = o, c = o;
      const ticks = Math.max(2, Math.min(interval * 4, 200));
      for (let j = 0; j < ticks; j++) {
        const dt = (interval / ticks) / 86400;
        const z = randn();
        c = c * Math.exp((-0.5 * def.vol * def.vol) * dt + def.vol * Math.sqrt(dt) * z);
        if (c > h) h = c; if (c < l) l = c;
      }
      arr.push({ time: Math.floor(tStart / 1000), open: o, high: h, low: l, close: c });
      p = c;
    }
    if (interval === 5) lastClose = p;
  }
  s.price = lastClose;
  s.basePrice = lastClose;
  s.support = lastClose * (1 - (0.004 + Math.random() * 0.004));
  s.resistance = lastClose * (1 + (0.004 + Math.random() * 0.004));
}

function initState() {
  const state = {};
  for (const [k, def] of Object.entries(OTC_ASSETS)) {
    state[k] = newAssetState(k, def, 'otc');
    prewarmOTC(state[k], def);
  }
  for (const [k, def] of Object.entries(LIVE_ASSETS)) {
    state[k] = newAssetState(k, { name: def.name, display: def.display, price: 0, decimals: def.decimals, payout: def.payout }, 'live');
  }
  return state;
}

if (!global.__priceEngine) {
  global.__priceEngine = {
    state: initState(),
    tickIntervalMs: 250,
    started: false,
  };
}

function notifyStreamers(s, payload) {
  for (const w of s.streamers) {
    try { w(payload); } catch {}
  }
}

function updateCandles(s, price, now) {
  for (const interval of INTERVALS_SEC) {
    const bucketTime = Math.floor(now / 1000 / interval) * interval;
    let cc = s.currentCandle[interval];
    if (!cc || cc.time !== bucketTime) {
      if (cc) {
        s.candles[interval].push(cc);
        if (s.candles[interval].length > 300) s.candles[interval].shift();
      }
      cc = { time: bucketTime, open: price, high: price, low: price, close: price };
      s.currentCandle[interval] = cc;
    } else {
      if (price > cc.high) cc.high = price;
      if (price < cc.low) cc.low = price;
      cc.close = price;
    }
  }
}

// Called by liveFeed.js whenever a real-market tick arrives for a live asset
export function onLiveTick(symbol, price, t) {
  const s = global.__priceEngine.state[symbol];
  if (!s || s.kind !== 'live' || !(price > 0)) return;
  if (!s.seeded) {
    s.basePrice = price;
    s.support = price * 0.997;
    s.resistance = price * 1.003;
    s.seeded = true;
  }
  if (s.nudgeTicksLeft > 0) {
    price = price * (1 + s.pendingNudge);
    s.nudgeTicksLeft -= 1;
    if (s.nudgeTicksLeft === 0) s.pendingNudge = 0;
  }
  s.price = price;
  s.lastTickT = t || Date.now();
  updateCandles(s, price, Date.now());
  notifyStreamers(s, { type: 'tick', price, t: s.lastTickT });

  // Anchor the corresponding OTC synthetic asset to this real-market price.
  // Per the original brief: "OTC candles for forex/metals etc that follow the
  // live price". OTC keeps its own GBM noise + S/R bias but drifts around the
  // real price with a tight clamp to prevent wild divergence.
  const otcSym = Object.keys(OTC_TO_LIVE).find(k => OTC_TO_LIVE[k] === symbol);
  if (otcSym) {
    const otc = global.__priceEngine.state[otcSym];
    if (otc && otc.kind === 'otc') {
      if (!otc.anchored) {
        // First anchor: rebuild fresh prewarmed history AROUND the real price
        // so the chart doesn't show a giant transition spike from the fake
        // hardcoded starting price to the live one.
        prewarmOTC(otc, { price, vol: otc.vol, decimals: otc.decimals, payout: otc.payout, name: otc.name, display: otc.display });
        otc.anchored = true;
      } else {
        // Pull basePrice quickly toward live (25% per live tick), and also
        // gently nudge current price so it tracks live. Keeps OTC close to
        // real market without killing noise.
        otc.basePrice = otc.basePrice * 0.75 + price * 0.25;
        // Also re-center S/R around the new anchor
        otc.support = otc.basePrice * (1 - 0.003);
        otc.resistance = otc.basePrice * (1 + 0.003);
      }
    }
  }
}

function tickOTC(s, now) {
  const dt = 0.25 / 86400;
  const z = randn();
  let mu = s.drift;
  if (s.price >= s.resistance && Math.random() < 0.7) mu = -Math.abs(s.vol) * 0.5;
  else if (s.price <= s.support && Math.random() < 0.7) mu = Math.abs(s.vol) * 0.5;
  const bandFromCenter = (s.price - s.basePrice) / s.basePrice;
  // Stronger mean-reversion (was 0.5) for tight live tracking
  mu += -bandFromCenter * 2.0;
  let newPrice = s.price * Math.exp((mu - 0.5 * s.vol * s.vol) * dt + s.vol * Math.sqrt(dt) * z);
  // Hard clamp: keep OTC within ±0.4% of basePrice (which tracks live).
  // Prevents long-term drift that causes big visual gap with live feed.
  if (s.anchored) {
    const maxDev = 0.004;
    const lo = s.basePrice * (1 - maxDev);
    const hi = s.basePrice * (1 + maxDev);
    if (newPrice < lo) newPrice = lo;
    else if (newPrice > hi) newPrice = hi;
  }
  if (s.nudgeTicksLeft > 0) {
    newPrice = newPrice * (1 + s.pendingNudge);
    s.nudgeTicksLeft -= 1;
    if (s.nudgeTicksLeft === 0) s.pendingNudge = 0;
  }
  s.price = newPrice;
  updateCandles(s, newPrice, now);
  notifyStreamers(s, { type: 'tick', price: newPrice, t: now });
}

export function startEngine() {
  const eng = global.__priceEngine;
  if (!eng.timer) {
    eng.timer = setInterval(() => {
      const now = Date.now();
      for (const s of Object.values(eng.state)) {
        if (s.kind === 'otc') tickOTC(s, now);
      }
      if (now % 30000 < eng.tickIntervalMs) {
        for (const s of Object.values(eng.state)) {
          if (s.kind === 'otc') {
            s.basePrice = s.price;
            s.support = s.price * (1 - (0.004 + Math.random() * 0.004));
            s.resistance = s.price * (1 + (0.004 + Math.random() * 0.004));
          }
        }
      }
    }, eng.tickIntervalMs);
  }

  if (!eng.gapFiller) {
    eng.gapFiller = setInterval(() => {
      const now = Date.now();
      for (const s of Object.values(eng.state)) {
        if (s.kind !== 'live' || !s.seeded || !(s.price > 0)) continue;
        for (const interval of [5, 15, 60]) {
          const bucketTime = Math.floor(now / 1000 / interval) * interval;
          const cc = s.currentCandle[interval];
          if (!cc) {
            s.currentCandle[interval] = { time: bucketTime, open: s.price, high: s.price, low: s.price, close: s.price };
            continue;
          }
          if (cc.time !== bucketTime) {
            s.candles[interval].push(cc);
            let t = cc.time + interval;
            while (t < bucketTime) {
              s.candles[interval].push({ time: t, open: cc.close, high: cc.close, low: cc.close, close: cc.close });
              t += interval;
            }
            if (s.candles[interval].length > 300) {
              const overflow = s.candles[interval].length - 300;
              s.candles[interval].splice(0, overflow);
            }
            s.currentCandle[interval] = { time: bucketTime, open: cc.close, high: Math.max(cc.close, s.price), low: Math.min(cc.close, s.price), close: s.price };
          }
        }
      }
    }, 1000);
  }

  eng.started = true;
}

export function getEngine() { return global.__priceEngine; }
export function getState() { return global.__priceEngine.state; }
export function getAsset(sym) { return global.__priceEngine.state[sym]; }
export function getCurrentPrice(sym) { return global.__priceEngine.state[sym]?.price; }

export function getAssets() {
  return Object.values(global.__priceEngine.state).map(s => ({
    symbol: s.symbol, name: s.name, display: s.display, price: s.price,
    decimals: s.decimals, payout: s.payout, kind: s.kind,
    support: s.support, resistance: s.resistance, ready: !!s.seeded
  }));
}

export function getCandles(sym, interval = 5) {
  const s = global.__priceEngine.state[sym];
  if (!s) return [];
  const arr = [...(s.candles[interval] || [])];
  if (s.currentCandle[interval]) arr.push(s.currentCandle[interval]);
  return arr;
}

export function injectNudge(sym, relativeMagnitude, direction = 'up', ticks = 4) {
  const s = global.__priceEngine.state[sym];
  if (!s) return;
  s.pendingNudge = (direction === 'up' ? 1 : -1) * Math.abs(relativeMagnitude) / ticks;
  s.nudgeTicksLeft = ticks;
}

export function addStreamer(symbol, writer) {
  const s = global.__priceEngine.state[symbol];
  if (!s) return () => {};
  s.streamers.add(writer);
  return () => { try { s.streamers.delete(writer); } catch {} };
}
