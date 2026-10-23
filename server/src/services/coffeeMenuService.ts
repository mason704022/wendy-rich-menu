import { loadJson } from "../config.js";

export interface CoffeeItem {
  id: string;
  name: string;
  description: string;
  hotCold?: boolean;
}

export type CoffeeTemperature = "hot" | "ice";

export interface CoffeeMenu {
  title: string;
  items: CoffeeItem[];
}

export function getCoffeeMenu(): CoffeeMenu {
  return loadJson<CoffeeMenu>("coffee-menu.json");
}

export function getCoffeeItem(itemId: string): CoffeeItem | undefined {
  return getCoffeeMenu().items.find((i) => i.id === itemId);
}

export function formatCoffeeDisplayName(
  itemId: string,
  temperature?: string | null
): string {
  const item = getCoffeeItem(itemId);
  if (!item) return itemId;
  if (temperature === "hot") return `${item.name}（熱）`;
  if (temperature === "ice") return `${item.name}（冰）`;
  return item.name;
}
