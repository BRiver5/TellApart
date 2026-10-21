// Полная пересборка накопленного состояния из журнала ответов: веса модели,
// счётчики и сложность каждой карточки, граф путаниц. Нужна при смене версии
// модели и после удаления ответов; в обычной работе всё копится инкрементально
// той же функцией applyAnswer — поэтому пересборка даёт ровно то же состояние.

import type { Card, Edge, Review } from "./types.ts";
import { initialModel, learn, type Model } from "./memory.ts";
import { bump, degree, partners, relieve } from "./confusion.ts";

export const SESSION_GAP_MS = 30 * 60_000;

export type Outcome = Review["outcome"];

// Один ответ: модель, карточка, граф. recentCorrect — карточки, отвеченные
// верно в этой же сессии (для ослабления рёбер при верном различении).
export function applyAnswer(
  model: Model,
  card: Card,
  edges: Map<string, Edge>,
  outcome: Outcome,
  confusedWith: string | null,
  at: number,
  recentCorrect: Set<string>,
): { p: number } {
  const deg = degree(edges.values(), card.id, at);
  const { p } = learn(model, card, deg, outcome, at);
  if (outcome === "confused" && confusedWith) bump(edges, card.id, confusedWith, at);
  if (outcome === "correct") {
    for (const other of partners(edges.values(), card.id, at)) if (recentCorrect.has(other.id)) relieve(edges, card.id, other.id, at);
    recentCorrect.add(card.id);
  }
  return { p };
}

export function replay(cards: Card[], reviews: Review[]): { model: Model; cards: Card[]; edges: Map<string, Edge> } {
  const model = initialModel();
  const fresh = new Map(cards.map((c) => [c.id, { ...c, correct: 0, wrong: 0, bias: 0, lastAt: null as number | null }]));
  const edges = new Map<string, Edge>();
  let recent = new Set<string>();
  let lastAt = -Infinity;
  for (const r of [...reviews].sort((a, b) => a.at - b.at)) {
    const c = fresh.get(r.cardId);
    if (!c) continue;
    if (r.at - lastAt > SESSION_GAP_MS) recent = new Set();
    lastAt = r.at;
    if (r.confusedWith && !fresh.has(r.confusedWith)) {
      applyAnswer(model, c, edges, "wrong", null, r.at, recent);
      continue;
    }
    applyAnswer(model, c, edges, r.outcome, r.confusedWith, r.at, recent);
  }
  return { model, cards: [...fresh.values()], edges };
}
