// Модель памяти — регрессия периода полураспада (Half-Life Regression,
// Settles & Meeder 2016): вероятность вспомнить p = 2^(−Δ/h), где период
// полураспада h = 2^(θ·x + b). x — признаки карточки, θ — ОБЩИЕ веса,
// которые дообучаются на каждом ответе (накапливаемое состояние), b —
// собственная сложность карточки, тоже обучается.

import type { Card } from "./types.ts";
import { DAY_MS } from "./types.ts";

export const MODEL_VERSION = 1;
export const FEATURES = ["base", "right answers", "misses", "mix-ups", "answer length"] as const;
export const THETA0 = [-1.2, 2.0, -0.8, -0.35, -0.15];
const LR = 0.03;
const LR_BIAS = 0.15;
const MIN_GAP_MS = 10 * 60_000; // повтор в той же сессии не учит память

export type Model = { theta: number[]; n: number };

export function initialModel(): Model {
  return { theta: [...THETA0], n: 0 };
}

export function features(card: Card, confusion: number): number[] {
  return [1, Math.sqrt(1 + card.correct), Math.sqrt(1 + card.wrong), Math.min(3, confusion), Math.min(3, card.back.length / 20)];
}

export function halfLife(m: Model, card: Card, confusion: number): number {
  const x = features(card, confusion);
  const z = x.reduce((s, xi, i) => s + xi * m.theta[i], 0) + card.bias;
  return Math.pow(2, Math.max(-6, Math.min(10, z))); // дни
}

export function recall(m: Model, card: Card, confusion: number, now: number): number {
  if (card.lastAt === null) return 0;
  const days = Math.max(0, now - card.lastAt) / DAY_MS;
  return Math.pow(2, -days / halfLife(m, card, confusion));
}

// Когда p упадёт до target.
export function dueAt(m: Model, card: Card, confusion: number, target: number): number {
  if (card.lastAt === null) return 0;
  return card.lastAt + halfLife(m, card, confusion) * Math.log2(1 / target) * DAY_MS;
}

export const OUTCOME_Y: Record<string, number> = { correct: 1, close: 0.7, wrong: 0, confused: 0 };

// Один ответ: градиентный шаг по (p − y)² для θ и b, затем счётчики.
// Мутирует model и card — состояние копится от ответа к ответу.
export function learn(m: Model, card: Card, confusion: number, outcome: keyof typeof OUTCOME_Y, now: number): { p: number; h: number } {
  const y = OUTCOME_Y[outcome];
  const p = recall(m, card, confusion, now);
  const h = halfLife(m, card, confusion);
  if (card.lastAt !== null && now - card.lastAt >= MIN_GAP_MS) {
    const days = (now - card.lastAt) / DAY_MS;
    const g = 2 * (p - y) * p * Math.LN2 * Math.LN2 * (days / h);
    const x = features(card, confusion);
    for (let i = 0; i < m.theta.length; i++) m.theta[i] = clamp(m.theta[i] - LR * g * x[i], THETA0[i] - 2, THETA0[i] + 2);
    card.bias = clamp(card.bias - LR_BIAS * g, -3, 3);
    m.n++;
  }
  if (y >= 0.7) card.correct++;
  else card.wrong++;
  card.lastAt = now;
  return { p, h };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Вклад каждого признака в показатель h — для экрана "почему".
export function breakdown(m: Model, card: Card, confusion: number): { label: string; value: number }[] {
  const x = features(card, confusion);
  return [...FEATURES.map((label, i) => ({ label, value: x[i] * m.theta[i] })), { label: "this card", value: card.bias }];
}
