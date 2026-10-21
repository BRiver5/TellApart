// Изменения настроек — общий язык выходов из конфликтов и режима "что если".
// Сравнение — повторный прогноз с тем же сидом.

import { forecast, type Forecast, type ForecastInput } from "./forecast.ts";

export type Change =
  | { kind: "budget"; minutes: number }
  | { kind: "target"; value: number }
  | { kind: "newPerDay"; value: number }
  | { kind: "suspend"; ids: string[] };

export function applyChange(input: ForecastInput, c: Change): ForecastInput {
  switch (c.kind) {
    case "budget":
      return { ...input, budgetSec: Math.max(60, c.minutes * 60) };
    case "target":
      return { ...input, target: Math.min(0.97, Math.max(0.7, c.value)) };
    case "newPerDay":
      return { ...input, newPerDay: Math.max(0, c.value) };
    case "suspend":
      return { ...input, cards: input.cards.map((x) => (c.ids.includes(x.id) ? { ...x, suspended: true } : x)) };
  }
}

export function describeChange(c: Change): string {
  switch (c.kind) {
    case "budget":
      return `Study ${c.minutes} min a day`;
    case "target":
      return `Aim for ${Math.round(c.value * 100)}% recall`;
    case "newPerDay":
      return c.value === 0 ? "Pause new cards" : `${c.value} new cards a day`;
    case "suspend":
      return c.ids.length === 1 ? "Suspend the hardest card" : `Suspend the ${c.ids.length} hardest cards`;
  }
}

export type Comparison = { before: Forecast; after: Forecast; backlogDelta: number; retentionDelta: number };

export function whatIf(input: ForecastInput, changes: Change[], base?: Forecast): Comparison {
  const before = base ?? forecast(input);
  const after = forecast(changes.reduce(applyChange, input));
  return { before, after, backlogDelta: after.backlogSum - before.backlogSum, retentionDelta: after.retention - before.retention };
}
