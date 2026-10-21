// Прогноз нагрузки на N дней вперёд — Монте-Карло по копиям карточек.
// Каждый день: какие карточки просели ниже цели + новые по лимиту; отвечаем,
// пока хватает дневного лимита времени (самые рискованные первыми), остальное
// переносится — копится долг. Исход ответа разыгрывается по прогнозу модели.
// Сид фиксирован, поэтому сравнения "до/после" честные: один и тот же жребий.

import type { Card, Edge } from "./types.ts";
import { DAY_MS } from "./types.ts";
import { halfLife } from "./memory.ts";
import type { Model } from "./memory.ts";
import { degree } from "./confusion.ts";

export type ForecastInput = {
  cards: Card[];
  model: Model;
  edges: Edge[];
  now: number;
  target: number;
  budgetSec: number;
  newPerDay: number;
  days?: number;
  runs?: number;
  seed?: number;
};

export type ForecastDay = { day: number; demand: number; served: number; backlog: number; p90: number };

export type Forecast = { days: ForecastDay[]; overflowDays: number; backlogSum: number; retention: number };

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Sim = { correct: number; wrong: number; bias: number; lastAt: number | null; seconds: number; deg: number; back: string; createdAt: number };

export function forecast(input: ForecastInput): Forecast {
  const D = input.days ?? 30;
  const R = input.runs ?? 40;
  const rand = rng(input.seed ?? 7);
  const active = input.cards.filter((c) => !c.suspended);
  const base: Sim[] = active.map((c) => ({ correct: c.correct, wrong: c.wrong, bias: c.bias, lastAt: c.lastAt, seconds: c.seconds, deg: degree(input.edges, c.id, input.now), back: c.back, createdAt: c.createdAt }));
  const demand = Array.from({ length: D }, () => [] as number[]);
  const served = new Float64Array(D);
  const backlog = new Float64Array(D);
  let pSum = 0;
  let pN = 0;

  for (let r = 0; r < R; r++) {
    const sims = base.map((s) => ({ ...s }));
    const fresh = sims.filter((s) => s.lastAt === null).sort((a, b) => a.createdAt - b.createdAt);
    let nextNew = 0;
    for (let d = 0; d < D; d++) {
      const t = input.now + d * DAY_MS;
      const due: { s: Sim; p: number }[] = [];
      for (const s of sims) {
        if (s.lastAt === null) continue;
        const h = halfLife(input.model, s as unknown as Card, s.deg);
        const p = Math.pow(2, -(t - s.lastAt) / DAY_MS / h);
        if (p < input.target) due.push({ s, p });
      }
      for (let k = 0; k < input.newPerDay && nextNew < fresh.length; k++) due.push({ s: fresh[nextNew++], p: 0.5 });
      due.sort((a, b) => a.p - b.p);
      let used = 0;
      let need = 0;
      let left = 0;
      for (const { s, p } of due) {
        need += s.seconds;
        if (used + s.seconds > input.budgetSec) {
          left++;
          continue;
        }
        used += s.seconds;
        const ok = rand() < p;
        if (ok) s.correct++;
        else s.wrong++;
        s.lastAt = t;
        pSum += p;
        pN++;
      }
      demand[d].push(need / 60);
      served[d] += used / 60 / R;
      backlog[d] += left / R;
    }
  }

  const days: ForecastDay[] = demand.map((runs, d) => {
    const sorted = [...runs].sort((a, b) => a - b);
    return { day: d, demand: runs.reduce((s, x) => s + x, 0) / runs.length, served: served[d], backlog: backlog[d], p90: sorted[Math.floor(0.9 * (sorted.length - 1))] };
  });
  return {
    days,
    overflowDays: days.filter((x) => x.backlog >= 1).length,
    backlogSum: days.reduce((s, x) => s + x.backlog, 0),
    retention: pN ? pSum / pN : input.target,
  };
}
