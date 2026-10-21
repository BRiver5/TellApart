// Конфликты и ранжированные выходы. Выходы проверены повторным прогнозом с
// тем же сидом и упорядочены по тому, сколько долга они снимают на рубль
// "цены" (меньше запоминания — дороже).

import type { Card, Edge } from "./types.ts";
import { forecast, type Forecast, type ForecastInput } from "./forecast.ts";
import { applyChange, describeChange, type Change } from "./changes.ts";
import { clusters, weightAt } from "./confusion.ts";

export type Fix = { changes: Change[]; label: string; gain: number; effect: string };
export type Conflict = { id: string; kind: "backlog" | "tangle" | "leech"; title: string; reason: string; fixes: Fix[]; cardIds?: string[] };

export function leeches(cards: Card[]): Card[] {
  return cards.filter((c) => !c.suspended && c.wrong >= 4 && c.wrong > c.correct).sort((a, b) => b.wrong - b.correct - (a.wrong - a.correct));
}

function effect(before: Forecast, after: Forecast): string {
  const parts: string[] = [];
  const b = before.backlogSum / before.days.length;
  const a = after.backlogSum / after.days.length;
  if (Math.abs(b - a) >= 0.3) parts.push(`backlog ${b.toFixed(1)} → ${a.toFixed(1)} cards/day`);
  const dr = Math.round((after.retention - before.retention) * 100);
  if (dr !== 0) parts.push(`recall at review ${dr > 0 ? "+" : ""}${dr} pts`);
  return parts.join(" · ") || "about the same";
}

function verify(input: ForecastInput, base: Forecast, cands: Change[][]): Fix[] {
  const out: Fix[] = [];
  for (const changes of cands) {
    const after = forecast(changes.reduce(applyChange, input));
    // Цена: каждый пункт упавшего прогноза вспоминания — как 3 карточки долга в день.
    const gain = (base.backlogSum - after.backlogSum) / base.days.length - Math.max(0, base.retention - after.retention) * 100 * 0.3;
    if (gain > 0.2) out.push({ changes, label: changes.map(describeChange).join(" + "), gain, effect: effect(base, after) });
  }
  return out.sort((a, b) => b.gain - a.gain).slice(0, 3);
}

export function findConflicts(input: ForecastInput, base: Forecast, cardName: (id: string) => string): Conflict[] {
  const out: Conflict[] = [];
  const budgetMin = Math.round(input.budgetSec / 60);

  // 1. Долг впереди.
  if (base.overflowDays >= 3) {
    const first = base.days.find((d) => d.backlog >= 1)!;
    const worst = base.days.reduce((a, b) => (b.demand > a.demand ? b : a));
    const ls = leeches(input.cards).slice(0, 5).map((c) => c.id);
    const cands: Change[][] = [
      [{ kind: "budget", minutes: budgetMin + 5 }],
      [{ kind: "budget", minutes: budgetMin + 10 }],
      [{ kind: "target", value: Math.round((input.target - 0.05) * 100) / 100 }],
      [{ kind: "newPerDay", value: Math.floor(input.newPerDay / 2) }],
      [{ kind: "newPerDay", value: 0 }],
    ];
    if (ls.length) cands.push([{ kind: "suspend", ids: ls }]);
    out.push({
      id: "backlog",
      kind: "backlog",
      title: `Cards will pile up from day ${first.day + 1}`,
      reason: `${base.overflowDays} of the next ${base.days.length} days need more than your ${budgetMin} min — up to ${Math.round(worst.demand)} min on day ${worst.day + 1}. Unreviewed cards keep slipping.`,
      fixes: verify(input, base, cands),
    });
  }

  // 2. Узлы путаниц: 3+ карточки, тянущие друг друга вниз.
  const ids = input.cards.filter((c) => !c.suspended).map((c) => c.id);
  for (const g of clusters(ids, input.edges, input.now).filter((x) => x.length >= 3).slice(0, 2)) {
    const w = input.edges.filter((e) => g.includes(e.a) && g.includes(e.b)).reduce((s, e) => s + weightAt(e, input.now), 0);
    const weakest = input.cards.filter((c) => g.includes(c.id)).sort((a, b) => b.wrong - b.correct - (a.wrong - a.correct))[0];
    out.push({
      id: `tangle-${g[0]}`,
      kind: "tangle",
      title: `${g.length} cards keep getting mixed up`,
      reason: `${g.slice(0, 3).map(cardName).join(", ")}${g.length > 3 ? "…" : ""} — ${w.toFixed(1)} mix-ups' worth between them. Mix-ups also shorten how long each of them sticks.`,
      cardIds: g,
      fixes: verify(input, base, [[{ kind: "suspend", ids: [weakest.id] }]]),
    });
  }

  // 3. Карточки-пиявки.
  const ls = leeches(input.cards);
  if (ls.length) {
    out.push({
      id: "leech",
      kind: "leech",
      title: ls.length === 1 ? "One card just won't stick" : `${ls.length} cards just won't stick`,
      reason: `${ls.slice(0, 3).map((c) => cardName(c.id)).join(", ")}: missed more often than remembered. Rewording them usually helps more than repeating.`,
      cardIds: ls.map((c) => c.id),
      fixes: verify(input, base, [[{ kind: "suspend", ids: ls.slice(0, 5).map((c) => c.id) }]]),
    });
  }
  return out;
}
