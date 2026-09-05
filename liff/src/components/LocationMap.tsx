/** Simplified map illustration for 回咖啡 location */

function VerticalLabel({
  x,
  y,
  text,
  fill = "#c0392b",
  fontSize = 10,
}: {
  x: number;
  y: number;
  text: string;
  fill?: string;
  fontSize?: number;
}) {
  return (
    <text x={x} y={y} fill={fill} fontSize={fontSize} fontWeight="700">
      {text.split("").map((char, i) => (
        <tspan key={`${char}-${i}`} x={x} dy={i === 0 ? 0 : fontSize + 2}>
          {char}
        </tspan>
      ))}
    </text>
  );
}

export function LocationMap() {
  return (
    <div className="location-map-wrap">
      <svg
        viewBox="0 0 340 250"
        className="location-map"
        role="img"
        aria-label="回咖啡位置示意圖"
      >
        <rect width="340" height="250" fill="#f3f1eb" rx="8" />

        {/* 茄苳景觀大道 — wide boulevard on the left */}
        <line x1="48" y1="8" x2="48" y2="242" stroke="#9eb3c9" strokeWidth="24" strokeLinecap="round" />
        <VerticalLabel x={14} y={52} text="茄苳景觀大道" />

        {/* 頂埔國小 */}
        <rect x="88" y="48" width="22" height="16" rx="2" fill="#e8e4dc" stroke="#bbb" strokeWidth="1" />
        <polygon points="88,48 99,40 110,48" fill="#c0392b" opacity="0.85" />
        <text x="118" y="60" fill="#c0392b" fontSize="10" fontWeight="700">
          頂埔國小
        </text>

        {/* 經國路三段 — main vertical road (right) */}
        <line x1="248" y1="8" x2="248" y2="242" stroke="#b0b0b0" strokeWidth="12" strokeLinecap="round" />
        <VerticalLabel x={268} y={78} text="經國路三段" fontSize={11} />

        {/* 中華路四段 — thicker than 經國路 */}
        <line x1="8" y1="208" x2="332" y2="208" stroke="#999" strokeWidth="18" strokeLinecap="round" />
        <text x="148" y="236" fill="#c0392b" fontSize="10" fontWeight="700">
          中華路四段
        </text>

        {/* 經國路三段92巷 */}
        <line x1="108" y1="132" x2="248" y2="132" stroke="#d5d0c8" strokeWidth="7" strokeLinecap="round" />
        <text x="218" y="148" fill="#888" fontSize="9" fontWeight="600" textAnchor="middle">
          92巷
        </text>

        {/* 停車場 */}
        <rect x="168" y="108" width="28" height="20" rx="3" fill="#fff" stroke="#7b5ea7" strokeWidth="1.5" />
        <text x="182" y="122" textAnchor="middle" fill="#7b5ea7" fontSize="11" fontWeight="700">
          P
        </text>
        <text x="200" y="122" fill="#c0392b" fontSize="9" fontWeight="700">
          停車場
        </text>

        {/* 回咖啡 pin — inside 92巷 */}
        <circle cx="138" cy="132" r="16" fill="#c0392b" opacity="0.15" />
        <path
          d="M138 112c-7 0-12 5-12 12 0 9 12 22 12 22s12-13 12-22c0-7-5-12-12-12z"
          fill="#c0392b"
        />
        <circle cx="138" cy="124" r="3.5" fill="#fff" />
        <text x="138" y="158" textAnchor="middle" fill="#333" fontSize="11" fontWeight="700">
          回咖啡
        </text>

        <text x="300" y="236" fill="#c0392b" fontSize="10" fontWeight="700">
          火車站 →
        </text>
      </svg>
      <p className="location-map-note">
        新竹市東區 · 經國路三段92巷內（旁有停車場）· 近茄苳景觀大道與頂埔國小
      </p>
    </div>
  );
}
