// Состояние: карточки и журнал → накопленная модель памяти и граф путаниц →
// сессия на сегодня, прогноз нагрузки и конфликты. Ответы во время сессии
// меняют состояние инкрементально (applyAnswer), сессия при этом стабильна.

import { create } from "zustand";
import * as repo from "../data/repo";
import { generateId } from "../lib/id";
import { initialModel, MODEL_VERSION, type Model } from "../lib/memory";
import { applyAnswer, replay, SESSION_GAP_MS } from "../lib/replay";
import { judge, type Judgement } from "../lib/match";
import { buildSession, type Session } from "../lib/session";
import { forecast, type Forecast, type ForecastInput } from "../lib/forecast";
import { findConflicts, type Conflict } from "../lib/conflicts";
import type { Change } from "../lib/changes";
import { STARTER_DECKS } from "../lib/decks";
import type { Card, Edge, Review } from "../lib/types";
import { setHapticsEnabled } from "../services/haptics";

export type Settings = { budgetMin: number; target: number; newPerDay: number; contrast: boolean; haptics: boolean; deck: string | null };
export const DEFAULT_SETTINGS: Settings = { budgetMin: 15, target: 0.88, newPerDay: 10, contrast: true, haptics: true, deck: null };

export type CardDraft = { deck: string; front: string; back: string };

type State = {
  ready: boolean;
  version: number;
  now: number;
  cards: Card[];
  reviews: Review[];
  edges: Edge[];
  model: Model;
  settings: Settings;
  session: Session | null;
  forecast: Forecast | null;
  conflicts: Conflict[] | null;
  refresh: () => Promise<void>;
  rebuild: () => Promise<void>;
  addCards: (drafts: CardDraft[]) => Promise<void>;
  addStarter: (index: number) => Promise<void>;
  updateCard: (c: Card) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  answer: (cardId: string, text: string, ms: number) => Promise<Judgement & { p: number }>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  applyChange: (c: Change) => Promise<void>;
  wipe: () => Promise<void>;
};

let queue: Promise<void> = Promise.resolve();
let recentCorrect = new Set<string>();
let lastAnswerAt = -Infinity;

export function forecastInput(s: Pick<State, "cards" | "model" | "edges" | "now" | "settings">): ForecastInput {
  return { cards: s.cards, model: s.model, edges: s.edges, now: s.now, target: s.settings.target, budgetSec: s.settings.budgetMin * 60, newPerDay: s.settings.newPerDay, days: 30, runs: 24, seed: 11 };
}

export const useApp = create<State>((set, get) => ({
  ready: false,
  version: 0,
  now: Date.now(),
  cards: [],
  reviews: [],
  edges: [],
  model: initialModel(),
  settings: DEFAULT_SETTINGS,
  session: null,
  forecast: null,
  conflicts: null,

  refresh: () => (queue = queue.then(() => get().rebuild()).catch(() => undefined)),

  rebuild: async () => {
    const now = Date.now();
    let [cards, reviews, edges, stored, version, model] = await Promise.all([
      repo.listCards(),
      repo.listReviews(),
      repo.listEdges(),
      repo.getMeta<Partial<Settings>>("settings", {}),
      repo.getMeta<number>("modelVersion", 0),
      repo.getMeta<Model | null>("model", null),
    ]);
    const settings = { ...DEFAULT_SETTINGS, ...stored };
    setHapticsEnabled(settings.haptics);
    // Смена версии модели или потерянное состояние — пересборка из журнала.
    if (version !== MODEL_VERSION || !model) {
      const r = replay(cards, reviews);
      cards = cards.map((c) => ({ ...c, ...r.cards.find((x) => x.id === c.id)! }));
      edges = [...r.edges.values()];
      model = r.model;
      await repo.replaceAll(cards, edges, model);
      await repo.setMeta("modelVersion", MODEL_VERSION);
    }
    const session = buildSession({ cards, model, edges, now, target: settings.target, budgetSec: settings.budgetMin * 60, newLimit: settings.newPerDay - newToday(reviews, cards, now), deck: settings.deck, contrast: settings.contrast });
    set({ ready: true, version: get().version + 1, now, cards, reviews, edges, model, settings, session, forecast: null, conflicts: null });
    // Прогноз и конфликты — дорогие, после отрисовки.
    const v = get().version;
    setTimeout(() => {
      const s = get();
      if (s.version !== v) return;
      const input = forecastInput(s);
      const f = forecast(input);
      const name = (id: string) => s.cards.find((c) => c.id === id)?.front ?? "card";
      set({ forecast: f, conflicts: findConflicts(input, f, name) });
    }, 0);
  },

  addCards: async (drafts) => {
    const base = Date.now();
    const cards: Card[] = drafts.map((d, i) => ({ id: generateId(), deck: d.deck.trim() || "General", front: d.front.trim(), back: d.back.trim(), createdAt: base + i, suspended: false, correct: 0, wrong: 0, bias: 0, lastAt: null, seconds: 12 }));
    await repo.saveCards(cards);
    await get().refresh();
  },
  addStarter: async (index) => {
    const d = STARTER_DECKS[index];
    const have = new Set(get().cards.filter((c) => c.deck === d.name).map((c) => c.front));
    await get().addCards(d.cards.filter(([f]) => !have.has(f)).map(([front, back]) => ({ deck: d.name, front, back })));
  },
  updateCard: async (c) => {
    await repo.saveCards([c]);
    await get().refresh();
  },
  deleteCard: async (id) => {
    await repo.deleteCard(id);
    await repo.setMeta("modelVersion", 0); // ответы удалены — пересобрать модель из журнала
    await get().refresh();
  },

  // Ответ: проверка → обучение модели → граф → запись, одной транзакцией.
  answer: async (cardId, text, ms) => {
    const s = get();
    const card = { ...s.cards.find((c) => c.id === cardId)! };
    const deck = s.cards.filter((c) => c.deck === card.deck);
    const j = judge(text, card, deck);
    const now = Date.now();
    if (now - lastAnswerAt > SESSION_GAP_MS) recentCorrect = new Set();
    lastAnswerAt = now;
    const model: Model = { theta: [...s.model.theta], n: s.model.n };
    const edges = new Map(s.edges.map((e) => [e.a < e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`, e] as const));
    const before = new Map(edges);
    const { p } = applyAnswer(model, card, edges, j.outcome, j.confusedWith, now, recentCorrect);
    card.seconds = Math.round((0.7 * card.seconds + 0.3 * Math.min(60, Math.max(2, ms / 1000))) * 10) / 10;
    const review: Review = { id: generateId(), cardId, at: now, outcome: j.outcome, answer: text, confusedWith: j.confusedWith, p, ms };
    const changed = [...edges.values()].filter((e) => before.get(e.a < e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`) !== e);
    await repo.commitAnswer(card, review, changed, model);
    set({ cards: s.cards.map((c) => (c.id === cardId ? card : c)), reviews: [...s.reviews, review], edges: [...edges.values()], model });
    return { ...j, p };
  },

  updateSettings: async (patch) => {
    await repo.setMeta("settings", { ...get().settings, ...patch });
    await get().refresh();
  },
  applyChange: async (c) => {
    const s = get();
    switch (c.kind) {
      case "budget":
        return s.updateSettings({ budgetMin: c.minutes });
      case "target":
        return s.updateSettings({ target: c.value });
      case "newPerDay":
        return s.updateSettings({ newPerDay: c.value });
      case "suspend":
        await repo.saveCards(s.cards.filter((x) => c.ids.includes(x.id)).map((x) => ({ ...x, suspended: true })));
        return s.refresh();
    }
  },
  wipe: async () => {
    await repo.wipeAll();
    await get().refresh();
  },
}));

// Сколько новых карточек уже показано сегодня (лимит новых — на день).
function newToday(reviews: Review[], cards: Card[], now: number): number {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const firstSeen = new Map<string, number>();
  for (const r of reviews) if (!firstSeen.has(r.cardId)) firstSeen.set(r.cardId, r.at);
  let n = 0;
  for (const c of cards) {
    const f = firstSeen.get(c.id);
    if (f !== undefined && f >= start.getTime()) n++;
  }
  return n;
}

export function deckNames(cards: Card[]): string[] {
  return [...new Set(cards.map((c) => c.deck))];
}
