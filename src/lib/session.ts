// Сессия на сегодня: какие карточки взять в лимит времени и в каком порядке.
// Выбор — точный 0/1-рюкзак по секундам (шаг 5 с): ценность карточки растёт
// с риском забыть и с тем, насколько она путается с другими. Порядок —
// путающиеся карточки идут подряд контрастным блоком (сравнить и различить),
// остальные перемешаны по колодам, блоки разнесены по сессии.

import type { Card, Edge } from "./types.ts";
import { recall } from "./memory.ts";
import type { Model } from "./memory.ts";
import { clusters, degree } from "./confusion.ts";

export const STEP_SEC = 5;
export const NEW_VALUE = 0.35;
export const MIXUP_WEIGHT = 0.5;

export type SessionInput = {
  cards: Card[];
  model: Model;
  edges: Edge[];
  now: number;
  target: number;
  budgetSec: number;
  newLimit: number;
  deck: string | null;
  contrast: boolean;
};

export type Pick = { card: Card; p: number; risk: number; mixup: number; value: number; seconds: number; kind: "due" | "new"; block: number | null };

export type Session = { picks: Pick[]; due: number; left: Pick[]; seconds: number; valueTaken: number; valueAll: number };

export function candidates(input: SessionInput): Pick[] {
  const out: Pick[] = [];
  let fresh = 0;
  const pool = input.cards.filter((c) => !c.suspended && (input.deck === null || c.deck === input.deck));
  const newOnes = pool.filter((c) => c.lastAt === null).sort((a, b) => a.createdAt - b.createdAt);
  for (const c of pool) {
    if (c.lastAt === null) continue;
    const deg = degree(input.edges, c.id, input.now);
    const p = recall(input.model, c, deg, input.now);
    if (p >= input.target) continue;
    const risk = input.target - p + 0.1;
    const mixup = MIXUP_WEIGHT * Math.min(2, deg);
    out.push({ card: c, p, risk, mixup, value: risk * (1 + mixup), seconds: c.seconds, kind: "due", block: null });
  }
  for (const c of newOnes) {
    if (fresh >= input.newLimit) break;
    fresh++;
    out.push({ card: c, p: 0, risk: NEW_VALUE, mixup: 0, value: NEW_VALUE, seconds: c.seconds, kind: "new", block: null });
  }
  return out;
}

// Точный 0/1-рюкзак: dp[t] — лучшая ценность за t шагов времени.
export function knapsack(items: Pick[], budgetSec: number): Pick[] {
  const T = Math.max(0, Math.floor(budgetSec / STEP_SEC));
  const w = items.map((it) => Math.max(1, Math.ceil(it.seconds / STEP_SEC)));
  const dp = new Float64Array(T + 1);
  const take: Uint8Array[] = items.map(() => new Uint8Array(T + 1));
  items.forEach((it, i) => {
    for (let t = T; t >= w[i]; t--) {
      const v = dp[t - w[i]] + it.value;
      if (v > dp[t] + 1e-12) {
        dp[t] = v;
        take[i][t] = 1;
      }
    }
  });
  const chosen: Pick[] = [];
  let t = T;
  for (let i = items.length - 1; i >= 0; i--) {
    if (take[i][t]) {
      chosen.push(items[i]);
      t -= w[i];
    }
  }
  return chosen.reverse();
}

export function order(picks: Pick[], edges: Edge[], now: number, contrast: boolean): Pick[] {
  if (picks.length < 2) return picks;
  const ids = picks.map((p) => p.card.id);
  const byId = new Map(picks.map((p) => [p.card.id, p]));
  const groups = clusters(ids, edges, now).filter((g) => g.length >= 2);
  const inBlock = new Set(contrast ? groups.flat() : []);
  // Остальные — по колодам по кругу, внутри колоды — сначала самые рискованные.
  const byDeck = new Map<string, Pick[]>();
  for (const p of picks) {
    if (inBlock.has(p.card.id)) continue;
    (byDeck.get(p.card.deck) ?? byDeck.set(p.card.deck, []).get(p.card.deck)!).push(p);
  }
  for (const list of byDeck.values()) list.sort((a, b) => b.value - a.value);
  const rest: Pick[] = [];
  const queues = [...byDeck.values()];
  while (queues.some((q) => q.length)) for (const q of queues) if (q.length) rest.push(q.shift()!);
  // Без контраста (или без путаниц) блоков нет — rest уже содержит все карточки.
  if (!contrast || groups.length === 0) return rest;
  // Блоки равномерно по сессии.
  const blocks = groups.map((g, i) => g.map((id) => ({ ...byId.get(id)!, block: i })));
  const out: Pick[] = [];
  const gap = Math.max(1, Math.floor(rest.length / (blocks.length + 1)));
  let r = 0;
  for (const b of blocks) {
    out.push(...rest.slice(r, r + gap));
    r += gap;
    out.push(...b);
  }
  out.push(...rest.slice(r));
  return out;
}

export function buildSession(input: SessionInput): Session {
  const all = candidates(input);
  const chosen = knapsack(all, input.budgetSec);
  const taken = new Set(chosen.map((p) => p.card.id));
  const picks = order(chosen, input.edges, input.now, input.contrast);
  return {
    picks,
    due: all.filter((p) => p.kind === "due").length,
    left: all.filter((p) => !taken.has(p.card.id)).sort((a, b) => b.value - a.value),
    seconds: chosen.reduce((s, p) => s + p.seconds, 0),
    valueTaken: chosen.reduce((s, p) => s + p.value, 0),
    valueAll: all.reduce((s, p) => s + p.value, 0),
  };
}
