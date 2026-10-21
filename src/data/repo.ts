// Доступ к SQLite. Все обращения строго по очереди (мьютекс): параллельные
// пересборки с записью внутри иначе пересекались, и expo-sqlite отклонял вызовы.

import { getDb } from "../db/client";
import type { Card, Edge, Review } from "../lib/types";

let chain: Promise<unknown> = Promise.resolve();
function lock<R>(fn: () => Promise<R>): Promise<R> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

type CardRow = { id: string; deck: string; front: string; back: string; created_at: number; suspended: number; correct: number; wrong: number; bias: number; last_at: number | null; seconds: number };
const toCard = (r: CardRow): Card => ({ id: r.id, deck: r.deck, front: r.front, back: r.back, createdAt: r.created_at, suspended: r.suspended === 1, correct: r.correct, wrong: r.wrong, bias: r.bias, lastAt: r.last_at, seconds: r.seconds });

export const listCards = () =>
  lock(async () => {
    const db = await getDb();
    return (await db.getAllAsync<CardRow>("SELECT * FROM cards ORDER BY created_at ASC;")).map(toCard);
  });

async function putCard(c: Card) {
  const db = await getDb();
  await db.runAsync(
    "INSERT OR REPLACE INTO cards (id, deck, front, back, created_at, suspended, correct, wrong, bias, last_at, seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
    [c.id, c.deck, c.front, c.back, c.createdAt, c.suspended ? 1 : 0, c.correct, c.wrong, c.bias, c.lastAt, c.seconds],
  );
}

export const saveCards = (cs: Card[]) =>
  lock(async () => {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      for (const c of cs) await putCard(c);
    });
  });

export const deleteCard = (id: string) =>
  lock(async () => {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync("DELETE FROM cards WHERE id = ?;", [id]);
      await db.runAsync("DELETE FROM reviews WHERE card_id = ?;", [id]);
      await db.runAsync("DELETE FROM edges WHERE a = ? OR b = ?;", [id, id]);
    });
  });

type ReviewRow = { id: string; card_id: string; at: number; outcome: Review["outcome"]; answer: string; confused_with: string | null; p: number; ms: number };

export const listReviews = () =>
  lock(async () => {
    const db = await getDb();
    const rows = await db.getAllAsync<ReviewRow>("SELECT * FROM reviews ORDER BY at ASC;");
    return rows.map((r): Review => ({ id: r.id, cardId: r.card_id, at: r.at, outcome: r.outcome, answer: r.answer, confusedWith: r.confused_with, p: r.p, ms: r.ms }));
  });

export const listEdges = () =>
  lock(async () => {
    const db = await getDb();
    return db.getAllAsync<Edge>("SELECT a, b, w, at FROM edges;");
  });

// Один ответ — одна транзакция: карточка, отзыв, рёбра, веса модели.
export const commitAnswer = (card: Card, review: Review, edges: Edge[], model: unknown) =>
  lock(async () => {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      await putCard(card);
      await db.runAsync("INSERT INTO reviews (id, card_id, at, outcome, answer, confused_with, p, ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?);", [
        review.id,
        review.cardId,
        review.at,
        review.outcome,
        review.answer,
        review.confusedWith,
        review.p,
        review.ms,
      ]);
      for (const e of edges) await db.runAsync("INSERT OR REPLACE INTO edges (a, b, w, at) VALUES (?, ?, ?, ?);", [e.a, e.b, e.w, e.at]);
      await db.runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES ('model', ?);", [JSON.stringify(model)]);
    });
  });

export const replaceAll = (cards: Card[], edges: Edge[], model: unknown) =>
  lock(async () => {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      for (const c of cards) await putCard(c);
      await db.runAsync("DELETE FROM edges;");
      for (const e of edges) await db.runAsync("INSERT INTO edges (a, b, w, at) VALUES (?, ?, ?, ?);", [e.a, e.b, e.w, e.at]);
      await db.runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES ('model', ?);", [JSON.stringify(model)]);
    });
  });

export function getMeta<T>(key: string, fallback: T): Promise<T> {
  return lock(async () => {
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = ?;", [key]);
    if (!row) return fallback;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return fallback;
    }
  });
}

export const setMeta = (key: string, value: unknown) =>
  lock(async () => {
    const db = await getDb();
    await db.runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?);", [key, JSON.stringify(value)]);
  });

export const wipeAll = () =>
  lock(async () => {
    const db = await getDb();
    await db.execAsync("DELETE FROM cards; DELETE FROM reviews; DELETE FROM edges; DELETE FROM meta;");
  });
