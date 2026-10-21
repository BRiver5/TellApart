// История для Stats: ответы по дням, исходы, калибровка прогнозов модели,
// серия дней, распределение "силы памяти".

import type { Outcome, Review } from "./types.ts";

export function localDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function byDay(reviews: Review[]): Map<string, Review[]> {
  const m = new Map<string, Review[]>();
  for (const r of reviews) {
    const k = localDay(r.at);
    (m.get(k) ?? m.set(k, []).get(k)!).push(r);
  }
  return m;
}

export function outcomes(reviews: Review[]): Record<Outcome, number> {
  const o: Record<Outcome, number> = { correct: 0, close: 0, wrong: 0, confused: 0 };
  for (const r of reviews) o[r.outcome]++;
  return o;
}

export function streak(days: Set<string>, today: string, prev: (d: string) => string): number {
  let n = 0;
  let d = days.has(today) ? today : prev(today);
  while (days.has(d)) {
    n++;
    d = prev(d);
  }
  return n;
}

export type CalBin = { lo: number; hi: number; n: number; predicted: number; actual: number };

// Только ответы с прогнозом (не первые показы): честно ли модель оценивает шансы.
export function calibration(reviews: Review[]): { bins: CalBin[]; n: number; brier: number } {
  const rs = reviews.filter((r) => r.p > 0);
  const edges = [0, 0.5, 0.7, 0.85, 1.0001];
  const y = (r: Review) => (r.outcome === "correct" ? 1 : r.outcome === "close" ? 0.7 : 0);
  const bins = edges.slice(0, -1).map((lo, i) => {
    const inB = rs.filter((r) => r.p >= lo && r.p < edges[i + 1]);
    return { lo, hi: Math.min(1, edges[i + 1]), n: inB.length, predicted: inB.length ? inB.reduce((s, r) => s + r.p, 0) / inB.length : 0, actual: inB.length ? inB.reduce((s, r) => s + y(r), 0) / inB.length : 0 };
  });
  const brier = rs.length ? rs.reduce((s, r) => s + (r.p - y(r)) ** 2, 0) / rs.length : 0;
  return { bins, n: rs.length, brier };
}

export function halfLifeBuckets(hs: number[]): { label: string; n: number }[] {
  const edges: [string, number, number][] = [
    ["< 1 d", 0, 1],
    ["1–3 d", 1, 3],
    ["3–7 d", 3, 7],
    ["1–2 wk", 7, 14],
    ["2–4 wk", 14, 30],
    ["1 mo +", 30, Infinity],
  ];
  return edges.map(([label, a, b]) => ({ label, n: hs.filter((h) => h >= a && h < b).length }));
}
