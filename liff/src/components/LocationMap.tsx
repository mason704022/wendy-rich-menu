/** Simplified map illustration for 回咖啡 location */
export function LocationMap() {
  return (
    <div className="location-map-wrap">
      <svg
        viewBox="0 0 320 220"
        className="location-map"
        role="img"
        aria-label="回咖啡位置示意圖"
      >
        <rect width="320" height="220" fill="#f5f5f0" rx="8" />
        {/* Roads */}
        <line x1="220" y1="10" x2="220" y2="210" stroke="#ccc" strokeWidth="14" />
        <line x1="10" y1="175" x2="310" y2="175" stroke="#ccc" strokeWidth="12" />
        <line x1="40" y1="10" x2="40" y2="120" stroke="#ddd" strokeWidth="6" />
        {/* Labels - red annotations */}
        <text x="228" y="100" fill="#e53935" fontSize="11" fontWeight="700">
          經國路三段
        </text>
        <text x="130" y="200" fill="#e53935" fontSize="10" fontWeight="700">
          中華路四段
        </text>
        <text x="175" y="155" fill="#e53935" fontSize="10" fontWeight="700">
          停車場 →
        </text>
        <text x="250" y="210" fill="#e53935" fontSize="10" fontWeight="700">
          火車站 →
        </text>
        {/* Pin */}
        <circle cx="155" cy="130" r="18" fill="#e53935" opacity="0.15" />
        <path
          d="M155 108c-8 0-14 6-14 13 0 10 14 24 14 24s14-14 14-24c0-7-6-13-14-13z"
          fill="#e53935"
        />
        <circle cx="155" cy="121" r="4" fill="#fff" />
        <text x="155" y="168" textAnchor="middle" fill="#333" fontSize="12" fontWeight="700">
          回咖啡
        </text>
      </svg>
      <p className="location-map-note">新竹市東區 · 近經國路三段與中華路四段</p>
    </div>
  );
}
