/**
 * Rich Menu 熱區 — 2500×1686
 * 走道 26px；上排高 830；下排 y=856
 * 下排三欄各 799px
 * 上排左 1624px（2欄+1走道）；上排右 799px
 */
export const RICH_MENU_SIZE = { width: 2500, height: 1686 } as const;

const G = 26;
const COL_W = 799;
const TOP_H = 830;
const BOTTOM_Y = 856;
const BOTTOM_H = 830;
const TOP_LEFT_W = COL_W * 2 + G;
const TOP_RIGHT_X = G + TOP_LEFT_W + G;

export const RICH_MENU_BOUNDS = {
  /** ② IG — 大圖右上角 */
  ig: { x: TOP_LEFT_W - 180, y: G + 20, width: 160, height: 160 },
  /** ③ 課程資訊 */
  courses: { x: TOP_RIGHT_X, y: G, width: COL_W, height: TOP_H },
  /** ④ 購買課程 */
  purchase: { x: G, y: BOTTOM_Y, width: COL_W, height: BOTTOM_H },
  /** ⑤ 我要預約 */
  booking: { x: G + COL_W + G, y: BOTTOM_Y, width: COL_W, height: BOTTOM_H },
  /** ⑥ 會員資訊 */
  member: { x: G + (COL_W + G) * 2, y: BOTTOM_Y, width: COL_W, height: BOTTOM_H },
} as const;
