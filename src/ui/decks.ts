import type { Palette } from "../theme/colors";

// Цвет колоды — по стабильному хешу имени, чтобы не хранить его отдельно.
export function deckColor(name: string, t: { colors: Palette }): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return t.colors.deck[h % t.colors.deck.length];
}

export function initials(name: string): string {
  const w = name.split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[1][0] : name.slice(0, 2)).toUpperCase();
}
