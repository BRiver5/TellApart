// "Почему эта карточка": прогноз вспоминания, разложение периода полураспада
// на вклад признаков, когда она просядет ниже цели, с кем путается и почему
// попала (или не попала) в сегодняшнюю сессию.

import type { Card, Edge } from "./types.ts";
import { breakdown, dueAt, halfLife, recall, type Model } from "./memory.ts";
import { degree, partners } from "./confusion.ts";
import type { Session } from "./session.ts";

export type CardWhy = {
  p: number;
  h: number; // дни
  dueAt: number;
  parts: { label: string; value: number }[];
  partners: { id: string; w: number }[];
  inSession: "picked" | "left" | "not due";
  value: { risk: number; mixup: number } | null;
};

export function explainCard(card: Card, model: Model, edges: Edge[], now: number, target: number, session: Session | null): CardWhy {
  const deg = degree(edges, card.id, now);
  const pick = session?.picks.find((p) => p.card.id === card.id);
  const left = session?.left.find((p) => p.card.id === card.id);
  const v = pick ?? left;
  return {
    p: recall(model, card, deg, now),
    h: halfLife(model, card, deg),
    dueAt: dueAt(model, card, deg, target),
    parts: breakdown(model, card, deg),
    partners: partners(edges, card.id, now),
    inSession: pick ? "picked" : left ? "left" : "not due",
    value: v ? { risk: v.risk, mixup: v.mixup } : null,
  };
}

// Что выучила модель: во сколько раз один верный ответ / промах / путаница
// меняет период полураспада типичной карточки.
export function lessons(model: Model): { label: string; factor: number }[] {
  const [, right, miss, mix] = model.theta;
  // √(1+n) растёт на ~0.4 при n: 1 → 2 — берём этот шаг как "ещё один ответ".
  const step = Math.sqrt(3) - Math.sqrt(2);
  return [
    { label: "One more right answer", factor: Math.pow(2, right * step) },
    { label: "One more miss", factor: Math.pow(2, miss * step) },
    { label: "One more mix-up", factor: Math.pow(2, mix) },
  ];
}
