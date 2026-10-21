// Общие типы. Время отзывов — миллисекунды epoch; дни для статистики —
// строки "YYYY-MM-DD" по локальному календарю.

export type Card = {
  id: string;
  deck: string;
  front: string;
  back: string;
  createdAt: number;
  suspended: boolean;
  // накапливаемое состояние памяти
  correct: number;
  wrong: number;
  bias: number; // собственная сложность карточки (поправка в показателе)
  lastAt: number | null;
  seconds: number; // типичное время ответа
};

export type Outcome = "correct" | "close" | "wrong" | "confused";

export type Review = {
  id: string;
  cardId: string;
  at: number;
  outcome: Outcome;
  answer: string;
  confusedWith: string | null;
  p: number; // прогноз модели в момент ответа
  ms: number;
};

export type Edge = { a: string; b: string; w: number; at: number };

export const DAY_MS = 86_400_000;
