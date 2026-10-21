# Tell Apart

**Learn the things you mix up.**

Карточки с вводом ответа. Опечатка засчитывается как «close», а ответ другой
карточки — как путаница: такие пары попадают в граф путаниц и возвращаются
рядом, пока ты не научишься их различать. Память моделируется регрессией
периода полураспада с весами, которые учатся на твоих ответах. Полностью офлайн.

## Особенности

- Нечёткая проверка ответа и распознавание путаниц.
- Half-Life Regression с онлайн-обучением общих весов и сложности карточки.
- Граф путаниц с затуханием и ослаблением при верном различении.
- Сессия под лимит времени — точный рюкзак, путающиеся карточки контрастными блоками.
- Прогноз нагрузки на 30 дней (Монте-Карло), конфликты с проверенными выходами, what-if.
- Stats: 8 секций, калибровка прогнозов модели.

## Запуск

```bash
npm install
npx expo start
```

## Проверки

```bash
npm run verify   # tsc + node --test + check-rules + expo export
```

## Структура проекта

```
app/            экраны: index, study, card/[id], pairs, forecast, stats
src/lib/        движок: match, memory, confusion, session, forecast, changes, conflicts, explain, replay, history, decks
src/data/       repo.ts — доступ к SQLite (через мьютекс)
src/store/      appStore.ts — журнал → модель и граф → сессия, прогноз, конфликты
src/components/ SessionBar, AnswerDiff, ForgettingCurve, ConfusionWeb, LoadChart, CardSheet, SettingsSheet + шаблонные
```
