// Граф путаниц: ребро между карточками растёт, когда одну из них отвечают
// ответом другой, затухает со временем и ослабевает, когда обе в одной сессии
// отвечены верно (значит, различаешь). Кластеры — компоненты связности по
// рёбрам выше порога (система непересекающихся множеств).

import type { Edge } from "./types.ts";
import { DAY_MS } from "./types.ts";

export const HALF_LIFE_DAYS = 21;
export const BUMP = 1;
export const RELIEF = 0.6; // множитель при верном различении
export const STRONG = 0.5;

export function key(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function weightAt(e: Edge, now: number): number {
  return e.w * Math.pow(2, -Math.max(0, now - e.at) / DAY_MS / HALF_LIFE_DAYS);
}

export function bump(edges: Map<string, Edge>, a: string, b: string, now: number): Edge {
  const k = key(a, b);
  const old = edges.get(k);
  const e = { a: a < b ? a : b, b: a < b ? b : a, w: (old ? weightAt(old, now) : 0) + BUMP, at: now };
  edges.set(k, e);
  return e;
}

export function relieve(edges: Map<string, Edge>, a: string, b: string, now: number): void {
  const k = key(a, b);
  const old = edges.get(k);
  if (!old) return;
  edges.set(k, { ...old, w: weightAt(old, now) * RELIEF, at: now });
}

// Суммарная "путаемость" карточки — признак модели памяти.
export function degree(edges: Iterable<Edge>, id: string, now: number): number {
  let s = 0;
  for (const e of edges) if (e.a === id || e.b === id) s += weightAt(e, now);
  return s;
}

export function partners(edges: Iterable<Edge>, id: string, now: number): { id: string; w: number }[] {
  const out: { id: string; w: number }[] = [];
  for (const e of edges) {
    if (e.a === id) out.push({ id: e.b, w: weightAt(e, now) });
    else if (e.b === id) out.push({ id: e.a, w: weightAt(e, now) });
  }
  return out.filter((x) => x.w >= 0.05).sort((x, y) => y.w - x.w);
}

export function clusters(ids: string[], edges: Iterable<Edge>, now: number, threshold = STRONG): string[][] {
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = x;
    while (parent.get(c) !== r) {
      const n = parent.get(c)!;
      parent.set(c, r);
      c = n;
    }
    return r;
  };
  for (const e of edges) {
    if (!parent.has(e.a) || !parent.has(e.b) || weightAt(e, now) < threshold) continue;
    const ra = find(e.a);
    const rb = find(e.b);
    if (ra !== rb) parent.set(ra, rb);
  }
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const r = find(id);
    (groups.get(r) ?? groups.set(r, []).get(r)!).push(id);
  }
  return [...groups.values()].sort((a, b) => b.length - a.length);
}
