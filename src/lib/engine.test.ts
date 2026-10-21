import { test } from "node:test";
import assert from "node:assert/strict";
import { judge, levenshtein, normalize } from "./match.ts";
import { dueAt, halfLife, initialModel, learn, recall } from "./memory.ts";
import { bump, clusters, degree, relieve, weightAt } from "./confusion.ts";
import { buildSession, knapsack, type Pick } from "./session.ts";
import { forecast } from "./forecast.ts";
import { findConflicts } from "./conflicts.ts";
import { whatIf } from "./changes.ts";
import { explainCard, lessons } from "./explain.ts";
import { calibration, halfLifeBuckets } from "./history.ts";
import { applyAnswer, replay } from "./replay.ts";
import type { Card, Edge, Review } from "./types.ts";
import { DAY_MS } from "./types.ts";

const NOW = Date.UTC(2026, 9, 21, 9);
const card = (id: string, back: string, over: Partial<Card> = {}): Card => ({ id, deck: "d", front: id, back, createdAt: 0, suspended: false, correct: 0, wrong: 0, bias: 0, lastAt: null, seconds: 10, ...over });

test("normalization and edit distance", () => {
  assert.equal(normalize("  Reykjavík! "), "reykjavik");
  assert.equal(normalize("The Hague"), "hague");
  assert.equal(levenshtein("kitten", "sitting"), 3);
});

test("judge: typo is close, another card's answer is a mix-up", () => {
  const deck = [card("sk", "Bratislava"), card("si", "Ljubljana"), card("at", "Vienna")];
  assert.equal(judge("bratislava", deck[0], deck).outcome, "correct");
  assert.equal(judge("Bratislav", deck[0], deck).outcome, "close");
  const j = judge("Ljubljana", deck[0], deck);
  assert.equal(j.outcome, "confused");
  assert.equal(j.confusedWith, "si");
  assert.equal(judge("Paris", deck[0], deck).outcome, "wrong");
  // Короткий ответ: опечатка не прощается, путаница ловится точно.
  const verbs = [card("ser", "ser"), card("estar", "estar")];
  assert.equal(judge("ser", verbs[1], verbs).outcome, "confused");
});

test("half-life grows with right answers, shrinks with misses and mix-ups", () => {
  const m = initialModel();
  const h0 = halfLife(m, card("a", "x"), 0);
  const h3 = halfLife(m, card("a", "x", { correct: 3 }), 0);
  const hw = halfLife(m, card("a", "x", { correct: 3, wrong: 3 }), 0);
  const hm = halfLife(m, card("a", "x", { correct: 3 }), 2);
  assert.ok(h0 > 0.5 && h0 < 2, `new card ~1 day, got ${h0}`);
  assert.ok(h3 > h0 * 2 && hw < h3 && hm < h3);
  const c = card("a", "x", { correct: 2, lastAt: NOW - 2 * DAY_MS });
  const p = recall(m, c, 0, NOW);
  assert.ok(p > 0 && p < 1);
  assert.ok(dueAt(m, c, 0, 0.85) > c.lastAt!);
});

test("online learning: a surprising miss lowers the card bias and the shared weights move", () => {
  const m = initialModel();
  const c = card("a", "x", { correct: 5, lastAt: NOW - DAY_MS });
  const before = [...m.theta];
  const { p } = learn(m, c, 0, "wrong", NOW);
  assert.ok(p > 0.8, "model expected to remember");
  assert.ok(c.bias < 0);
  assert.notDeepEqual(m.theta, before);
  assert.equal(c.wrong, 1);
  // Повтор через минуту не учит модель.
  const n = m.n;
  learn(m, c, 0, "correct", NOW + 60_000);
  assert.equal(m.n, n);
});

test("confusion graph: bump, relief, decay and clusters", () => {
  const edges = new Map<string, Edge>();
  bump(edges, "a", "b", NOW);
  bump(edges, "b", "a", NOW);
  bump(edges, "b", "c", NOW);
  const e = edges.get("a|b")!;
  assert.equal(e.w, 2);
  assert.ok(weightAt(e, NOW + 21 * DAY_MS) < 1.01 && weightAt(e, NOW + 21 * DAY_MS) > 0.99);
  relieve(edges, "a", "b", NOW);
  assert.ok(Math.abs(edges.get("a|b")!.w - 1.2) < 1e-9);
  assert.equal(degree(edges.values(), "b", NOW), 2.2);
  const g = clusters(["a", "b", "c", "d"], edges.values(), NOW);
  assert.deepEqual(g[0].sort(), ["a", "b", "c"]);
});

test("knapsack is exact on a small instance", () => {
  const items = [6, 3, 4, 5].map((s, i) => ({ value: [7, 3, 5, 6][i], seconds: s * 5 }) as unknown as Pick);
  const chosen = knapsack(items, 50); // 10 шагов
  const v = chosen.reduce((s, p) => s + p.value, 0);
  let best = 0;
  for (let m = 0; m < 16; m++) {
    let w = 0;
    let val = 0;
    for (let i = 0; i < 4; i++) if (m & (1 << i)) {
      w += [6, 3, 4, 5][i];
      val += [7, 3, 5, 6][i];
    }
    if (w <= 10) best = Math.max(best, val);
  }
  assert.equal(v, best);
});

test("session respects the time budget, prefers mix-ups and puts confusable cards together", () => {
  const edges = new Map<string, Edge>();
  bump(edges, "sk", "si", NOW);
  const old = NOW - 5 * DAY_MS;
  const cards = [
    card("sk", "Bratislava", { correct: 1, lastAt: old }),
    card("si", "Ljubljana", { correct: 1, lastAt: old }),
    card("at", "Vienna", { correct: 1, lastAt: old }),
    card("hu", "Budapest", { correct: 1, lastAt: old }),
    card("new1", "Riga"),
  ];
  const s = buildSession({ cards, model: initialModel(), edges: [...edges.values()], now: NOW, target: 0.85, budgetSec: 40, newLimit: 1, deck: null, contrast: true });
  assert.ok(s.seconds <= 40);
  const ids = s.picks.map((p) => p.card.id);
  assert.ok(ids.includes("sk") && ids.includes("si"), "the confusable pair is worth more");
  assert.equal(Math.abs(ids.indexOf("sk") - ids.indexOf("si")), 1, "pair is adjacent");
  assert.ok(s.left.length >= 1);
});

test("forecast: more minutes means less backlog; conflicts propose verified fixes", () => {
  const cards = Array.from({ length: 80 }, (_, i) => card(`c${i}`, `answer ${i}`, { correct: i % 3, wrong: i % 2, lastAt: NOW - (i % 4) * DAY_MS, seconds: 12 }));
  const base = { cards, model: initialModel(), edges: [], now: NOW, target: 0.9, budgetSec: 3 * 60, newPerDay: 0, days: 14, runs: 10 };
  const f = forecast(base);
  const more = forecast({ ...base, budgetSec: 20 * 60 });
  assert.ok(more.backlogSum < f.backlogSum);
  const cmp = whatIf(base, [{ kind: "budget", minutes: 20 }], f);
  assert.ok(cmp.backlogDelta < 0);
  const c = findConflicts(base, f, (id) => id).find((x) => x.kind === "backlog");
  assert.ok(c && c.fixes.length > 0);
  for (let i = 1; i < c!.fixes.length; i++) assert.ok(c!.fixes[i - 1].gain >= c!.fixes[i].gain);
  // Тот же сид — тот же результат.
  assert.deepEqual(forecast(base).days.map((d) => d.backlog), f.days.map((d) => d.backlog));
});

test("explain and history helpers", () => {
  const edges = new Map<string, Edge>();
  bump(edges, "a", "b", NOW);
  const c = card("a", "x", { correct: 2, lastAt: NOW - 3 * DAY_MS });
  const why = explainCard(c, initialModel(), [...edges.values()], NOW, 0.85, null);
  assert.equal(why.partners[0].id, "b");
  assert.equal(why.parts.length, 6);
  const ls = lessons(initialModel());
  assert.ok(ls[0].factor > 1 && ls[1].factor < 1 && ls[2].factor < 1);
  const reviews: Review[] = [0.9, 0.9, 0.6, 0.3].map((p, i) => ({ id: String(i), cardId: "a", at: NOW, outcome: i < 2 ? "correct" : "wrong", answer: "", confusedWith: null, p, ms: 1000 }));
  const cal = calibration(reviews);
  assert.equal(cal.n, 4);
  assert.equal(cal.bins[3].actual, 1);
  assert.deepEqual(halfLifeBuckets([0.5, 2, 40]).map((b) => b.n), [1, 1, 0, 0, 0, 1]);
});

test("replaying the journal rebuilds exactly the incremental state", () => {
  const cards = [card("sk", "Bratislava"), card("si", "Ljubljana"), card("at", "Vienna")];
  const live = cards.map((c) => ({ ...c }));
  const model = initialModel();
  const edges = new Map<string, Edge>();
  const reviews: Review[] = [];
  const script: [string, Review["outcome"], string | null, number][] = [
    ["sk", "correct", null, 0],
    ["si", "correct", null, 1],
    ["sk", "confused", "si", 2 * DAY_MS],
    ["si", "correct", null, 2 * DAY_MS + 60_000],
    ["sk", "correct", null, 2 * DAY_MS + 120_000],
    ["at", "wrong", null, 3 * DAY_MS],
  ];
  let recent = new Set<string>();
  let last = -Infinity;
  script.forEach(([id, outcome, other, dt], i) => {
    const at = NOW + dt;
    if (at - last > 30 * 60_000) recent = new Set();
    last = at;
    const c = live.find((x) => x.id === id)!;
    const { p } = applyAnswer(model, c, edges, outcome, other, at, recent);
    reviews.push({ id: String(i), cardId: id, at, outcome, answer: "", confusedWith: other, p, ms: 1000 });
  });
  // Верное различение в той же сессии ослабило ребро.
  assert.ok(edges.get("si|sk")!.w < 1);
  const r = replay(cards, reviews);
  assert.deepEqual(r.model.theta, model.theta);
  assert.deepEqual(r.cards.map((c) => [c.correct, c.wrong, c.bias, c.lastAt]), live.map((c) => [c.correct, c.wrong, c.bias, c.lastAt]));
  assert.deepEqual([...r.edges.values()], [...edges.values()]);
});
