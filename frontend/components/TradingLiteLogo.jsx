'use client';

// Professional brand mark for TRADING LITE.
//   Icon  : custom SVG candlestick + upward trend arrow on a dark gradient
//           tile with the brand-green accent. Mirrors the site palette
//           (#00b97a green, #0c1015 deep navy, subtle cyan glow).
//   Word  : "TRADING" in soft white, "LITE" in brand-green. Inter ExtraBold,
//           tight tracking — clean, fintech-grade, not childish.
export default function TradingLiteLogo({ className = '', compact = false, iconOnly = false }) {
  const tileSize = compact ? 28 : 36;
  const txtSize = compact ? 'text-sm' : 'text-xl';

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <BrandMark size={tileSize} />
      {!iconOnly && (
        <div className={`font-extrabold tracking-tight ${txtSize} flex items-baseline leading-none`}>
          <span className="text-white">TRADING</span>
          <span className="ml-1 text-[#00b97a]">LITE</span>
        </div>
      )}
    </div>
  );
}

export function BrandMark({ size = 36 }) {
  // ViewBox is 36 — scale via width/height.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-label="Trading Lite"
    >
      <defs>
        <linearGradient id="tl-tile" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0f1722" />
          <stop offset="100%" stopColor="#0a1118" />
        </linearGradient>
        <linearGradient id="tl-green" x1="0" y1="0" x2="0" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00d488" />
          <stop offset="100%" stopColor="#00855a" />
        </linearGradient>
        <linearGradient id="tl-line" x1="6" y1="22" x2="30" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#00b97a" />
        </linearGradient>
        <filter id="tl-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.7" />
        </filter>
      </defs>

      {/* Rounded tile background with subtle inner border */}
      <rect x="0.5" y="0.5" width="35" height="35" rx="8" ry="8" fill="url(#tl-tile)" stroke="#00b97a" strokeOpacity="0.35" />

      {/* Three candlesticks: small red, medium green, tall green (bullish progression) */}
      {/* Bear candle (red) */}
      <line x1="9" y1="13" x2="9" y2="25" stroke="#ff5e5e" strokeWidth="1" strokeLinecap="round" />
      <rect x="7.5" y="16" width="3" height="6" rx="0.6" fill="#ff5e5e" />

      {/* Bull candle (green, medium) */}
      <line x1="17" y1="9" x2="17" y2="27" stroke="url(#tl-green)" strokeWidth="1" strokeLinecap="round" />
      <rect x="15.5" y="13" width="3" height="11" rx="0.6" fill="url(#tl-green)" />

      {/* Bull candle (green, tall) */}
      <line x1="25" y1="6" x2="25" y2="28" stroke="url(#tl-green)" strokeWidth="1" strokeLinecap="round" />
      <rect x="23.5" y="9" width="3" height="14" rx="0.6" fill="url(#tl-green)" />

      {/* Trend line — upward arrow connecting wicks */}
      <path
        d="M5.5 24 L13 19 L21 13 L29 7"
        stroke="url(#tl-line)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        filter="url(#tl-glow)"
      />
      <path
        d="M5.5 24 L13 19 L21 13 L29 7"
        stroke="#22d3ee"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Arrow head */}
      <path d="M29 7 L29 11 M29 7 L25 7" stroke="#22d3ee" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />

      {/* Small green dot at start (entry mark) */}
      <circle cx="5.5" cy="24" r="1.4" fill="#00b97a" />
    </svg>
  );
}
