import { loadJson } from "../config.js";

export interface CoffeeItem {
  id: string;
  name: string;
  description: string;
}

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
