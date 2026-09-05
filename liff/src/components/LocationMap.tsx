/** Simplified map for 回咖啡 location (晶品城-style) */

function VerticalLabel({
  x,
  y,
  text,
  fontSize = 11,
  textAnchor = "middle",
}: {
  x: number;
  y: number;
  text: string;
  fontSize?: number;
  textAnchor?: "middle" | "start" | "end";
}) {
  const step = fontSize * 2;

  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor}
      fill="#111"
      fontSize={fontSize}
      fontWeight="800"
    >
      {text.split("").map((char, i) => (
        <tspan key={`${char}-${i}`} x={x} dy={i === 0 ? 0 : step}>
          {char}
        </tspan>
      ))}
    </text>
  );
}

function HorizontalLabel({
  x,
  y,
  text,
  fontSize = 10,
}: {
  x: number;
  y: number;
  text: string;
  fontSize?: number;
}) {
  const chars = text.split("");
  const step = fontSize * 2;
  const totalWidth = fontSize + (chars.length - 1) * step;
  const startX = x - totalWidth / 2 + fontSize / 2;

  return (
    <text y={y} fill="#111" fontSize={fontSize} fontWeight="800">
      {chars.map((char, i) => (
        <tspan key={`${char}-${i}`} x={startX + i * step}>
          {char}
        </tspan>
      ))}
    </text>
  );
}

function verticalLabelStartY(text: string, fontSize: number, centerY: number) {
  const step = fontSize * 2;
  const totalHeight = fontSize + (text.length - 1) * step;
  return centerY - totalHeight / 2 + fontSize * 0.35;
}

function LocationPin({ x, y, scale = 0.55 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale}) translate(-12, -24)`}>
      <path
        d="M12 2c-5.5 0-10 4.5-10 10 0 7.5 10 18 10 18s10-10.5 10-18c0-5.5-4.5-10-10-10z"
        fill="#c0392b"
      />
      <circle cx="12" cy="12" r="3" fill="#fff" />
    </g>
  );
}

function PoiBox({
  x,
  y,
  width,
  height,
  label,
  fill = "#e8dcc8",
  textFill = "#111",
  fontSize = 11,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  fill?: string;
  textFill?: string;
  fontSize?: number;
}) {
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} />
      <text
        x={x + width / 2}
        y={y + height / 2 + fontSize * 0.35}
        textAnchor="middle"
        fill={textFill}
        fontSize={fontSize}
        fontWeight="800"
      >
        {label}
      </text>
    </g>
  );
}

export function LocationMap() {
  const cx = 140;
  const cy = 140;
  const r = 132;
  const contentOffsetY = -r / 4;
  const circleLeft = cx - r;
  const circleRight = cx + r;
  const circleBottom = cy + r;
  const roadBottom = circleBottom - contentOffsetY;

  const road = "#fff";
  const roadW = 15;

  const qiedongX = 72;
  const jingguoX = 208;
  const zhonghuaY = 218;

  return (
    <div className="location-map-wrap">
      <svg
        viewBox="0 0 280 280"
        className="location-map"
        role="img"
        aria-label="回咖啡位置示意圖"
      >
        <defs>
          <clipPath id="mapCircle">
            <circle cx={cx} cy={cy} r={r} />
          </clipPath>
        </defs>

        <g clipPath="url(#mapCircle)">
          <circle cx={cx} cy={cy} r={r} fill="#6d5048" />

          <g transform={`translate(0, ${contentOffsetY})`}>
            {/* 茄苳景觀大道 */}
            <line x1={qiedongX} y1={18} x2={qiedongX} y2={roadBottom} stroke={road} strokeWidth={roadW} />

            {/* 經國路三段 */}
            <line x1={jingguoX} y1={18} x2={jingguoX} y2={roadBottom} stroke={road} strokeWidth={roadW} />

            {/* 中華路四段 */}
            <line
              x1={circleLeft}
              y1={zhonghuaY}
              x2={circleRight}
              y2={zhonghuaY}
              stroke={road}
              strokeWidth={roadW + 2}
            />

            {/* 92巷 */}
            <line x1={118} y1={128} x2={208} y2={128} stroke={road} strokeWidth={10} />

            {/* 路名 — 置於白色道路中央，字距留一字空白 */}
            <VerticalLabel
              x={qiedongX}
              y={verticalLabelStartY("茄苳景觀大道", 9, 140)}
              text="茄苳景觀大道"
              fontSize={9}
            />
            <VerticalLabel
              x={jingguoX}
              y={verticalLabelStartY("經國路三段", 10, 140)}
              text="經國路三段"
              fontSize={10}
            />
            <HorizontalLabel x={140} y={223} text="中華路四段" fontSize={10} />
            <text x={168} y={132} textAnchor="middle" fill="#111" fontSize="9" fontWeight="800">
              92巷
            </text>

            {/* 回咖啡 — 向左放大，可超出 92巷 */}
            <PoiBox x={96} y={133} width={78} height={28} label="回咖啡" fontSize={16} />
            <LocationPin x={135} y={124} />

            {/* 停車場 — 僅 P */}
            <PoiBox x={178} y={133} width={22} height={22} label="P" fill="#f0e6d4" />

            {/* 新竹火車站 — 灰底白字 */}
            <rect x={88} y={234} width={104} height={28} fill="#888" />
            <text
              x={140}
              y={253}
              textAnchor="middle"
              fill="#fff"
              fontSize="12"
              fontWeight="800"
            >
              新竹火車站 →
            </text>
          </g>
        </g>

        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#5a4038" strokeWidth="1" />
      </svg>
      <p className="location-map-note">
        新竹市香山區經國路三段92巷29號（旁有收費停車場）· 近茄苳景觀大道與頂埔國小
      </p>
    </div>
  );
}
