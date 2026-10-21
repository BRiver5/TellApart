// Проверка введённого ответа: точно / почти (опечатка) / неверно / перепутал —
// когда ответ совпал с ответом ДРУГОЙ карточки той же колоды. Именно такие
// путаницы и становятся рёбрами графа.

import type { Card, Outcome } from "./types.ts";

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b(the|a|an|el|la|los|las|le|les|der|die|das)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

// Допуск опечаток растёт с длиной ответа.
export function tolerance(len: number): number {
  return len <= 4 ? 0 : len <= 8 ? 1 : Math.floor(len / 6);
}

export type Judgement = { outcome: Outcome; confusedWith: string | null; distance: number };

export function judge(answer: string, card: Card, deck: Card[]): Judgement {
  const a = normalize(answer);
  const target = normalize(card.back);
  if (!a) return { outcome: "wrong", confusedWith: null, distance: target.length };
  const d = levenshtein(a, target);
  if (d === 0) return { outcome: "correct", confusedWith: null, distance: 0 };
  // Совпадение с чужим ответом важнее опечатки: "Slovenia" вместо "Slovakia"
  // отличается на 2 буквы, но это путаница, а не опечатка.
  let best: { id: string; d: number } | null = null;
  for (const other of deck) {
    if (other.id === card.id) continue;
    const od = levenshtein(a, normalize(other.back));
    if (od <= tolerance(a.length) && od < d && (!best || od < best.d)) best = { id: other.id, d: od };
  }
  if (best) return { outcome: "confused", confusedWith: best.id, distance: d };
  if (d <= tolerance(target.length)) return { outcome: "close", confusedWith: null, distance: d };
  return { outcome: "wrong", confusedWith: null, distance: d };
}
