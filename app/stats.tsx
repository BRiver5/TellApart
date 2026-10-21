import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ChevronLeft } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { IconButton, Legend, SectionTitle } from "../src/components/Bits";
import { AnimatedRing } from "../src/components/AnimatedRing";
import { AnimatedCounter } from "../src/components/AnimatedCounter";
import { DonutChart } from "../src/components/DonutChart";
import { BarChart } from "../src/components/BarChart";
import { Heatmap } from "../src/components/Heatmap";
import { EmptyState } from "../src/components/EmptyState";
import { byDay, calibration, halfLifeBuckets, localDay, outcomes, streak } from "../src/lib/history";
import { lessons } from "../src/lib/explain";
import { halfLife, recall } from "../src/lib/memory";
import { degree } from "../src/lib/confusion";
import { DAY_MS, type Outcome } from "../src/lib/types";
import { haptics } from "../src/services/haptics";

const DAYS = 30;

export default function Stats() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const app = useApp();
  const [sel, setSel] = useState<string | null>(null);
  const today = localDay(app.now);
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => localDay(app.now - (DAYS - 1 - i) * DAY_MS)), [app.version]);
  const perDay = useMemo(() => byDay(app.reviews), [app.version, app.reviews.length]);

  if (app.reviews.length === 0)
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top + 8, paddingHorizontal: 16 }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ChevronLeft size={20} color={t.colors.ink} />
        </IconButton>
        <EmptyState title="No answers yet" description="Finish a session — your recall, mix-ups and what the model learns about you show up here." />
      </View>
    );

  const tone: Record<Outcome, string> = { correct: t.colors.right, close: t.colors.close, confused: t.colors.mixup, wrong: t.colors.accent };
  const scope = sel ? (perDay.get(sel) ?? []) : app.reviews.filter((r) => r.at >= app.now - DAYS * DAY_MS);
  const o = outcomes(scope);
  const total = scope.length;
  const week = app.reviews.filter((r) => r.at >= app.now - 7 * DAY_MS && r.p > 0);
  const weekRecall = week.length ? week.filter((r) => r.outcome === "correct" || r.outcome === "close").length / week.length : 0;
  const prevDay = (d: string) => localDay(new Date(d + "T12:00:00").getTime() - DAY_MS);
  const st = streak(new Set(perDay.keys()), today, prevDay);
  const cal = calibration(app.reviews);
  const studied = app.cards.filter((c) => c.lastAt !== null && !c.suspended);
  const hs = studied.map((c) => halfLife(app.model, c, degree(app.edges, c.id, app.now)));
  const hb = halfLifeBuckets(hs);
  const missedCards = [...new Set(scope.filter((r) => r.outcome === "wrong" || r.outcome === "confused").map((r) => r.cardId))]
    .map((id) => app.cards.find((c) => c.id === id))
    .filter(Boolean)
    .slice(0, 6);
  const weakest = studied
    .map((c) => ({ c, p: recall(app.model, c, degree(app.edges, c.id, app.now), app.now) }))
    .sort((a, b) => a.p - b.p)
    .slice(0, 5);
  const ls = lessons(app.model);
  const maxDay = Math.max(1, ...days.map((d) => perDay.get(d)?.length ?? 0));

  // Тепловая карта 12 недель (колонки — недели, строки — дни недели с понедельника).
  const W = 12;
  const mon = new Date(app.now);
  mon.setHours(12, 0, 0, 0);
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7) - (W - 1) * 7);
  const cells = Array.from({ length: 7 * W }, (_, i) => {
    const d = localDay(mon.getTime() + ((i % W) * 7 + Math.floor(i / W)) * DAY_MS);
    return { key: d, intensity: d > today ? -1 : Math.min(1, (perDay.get(d)?.length ?? 0) / Math.max(10, maxDay)) };
  });

  const sections = [
    <View key="cards" style={{ flexDirection: "row", gap: 10 }}>
      <View style={[styles.card, { flex: 1, backgroundColor: t.colors.surface, borderColor: t.colors.border, alignItems: "center" }]}>
        <AnimatedRing progress={weekRecall} size={92} strokeWidth={10} color={weekRecall >= app.settings.target ? t.colors.right : t.colors.accent} trackColor={t.colors.backgroundAlt}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: t.colors.ink }}>{Math.round(weekRecall * 100)}%</Text>
        </AnimatedRing>
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, textAlign: "center", marginTop: 6 }}>recalled this week · target {Math.round(app.settings.target * 100)}%</Text>
      </View>
      <View style={{ flex: 1, gap: 10 }}>
        <View style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border, paddingVertical: 10 }]}>
          <AnimatedCounter value={st} style={{ fontSize: 24, fontWeight: "800", color: t.colors.ink, padding: 0 }} />
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>days in a row</Text>
        </View>
        <View style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border, paddingVertical: 10 }]}>
          <AnimatedCounter value={app.reviews.length} style={{ fontSize: 24, fontWeight: "800", color: t.colors.ink, padding: 0 }} />
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>answers so far</Text>
        </View>
      </View>
    </View>,

    <View key="days" style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
      <SectionTitle title="Answers per day" right={sel ? <Text onPress={() => setSel(null)} style={{ ...t.typography.label, color: t.colors.accent }}>All 30 days</Text> : undefined} />
      <View style={{ height: 10 }} />
      <View style={{ height: 110, flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
        {days.map((d) => {
          const rs = perDay.get(d) ?? [];
          const oo = outcomes(rs);
          return (
            <Pressable
              key={d}
              accessibilityLabel={`answers ${d}`}
              disabled={!rs.length}
              onPress={() => {
                haptics.tick();
                setSel(sel === d ? null : d);
              }}
              style={{ flex: 1, height: 110, justifyContent: "flex-end", opacity: sel && sel !== d ? 0.35 : 1 }}
            >
              {(["wrong", "confused", "close", "correct"] as Outcome[]).map((k) => (oo[k] ? <View key={k} style={{ height: (oo[k] / maxDay) * 110, backgroundColor: tone[k] }} /> : null))}
              {!rs.length ? <View style={{ height: 2, backgroundColor: t.colors.border }} /> : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, marginTop: 8 }}>{sel ? `${new Date(sel + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}: ${total} answers.` : "Tap a day — the sections below switch to it."}</Text>
    </View>,

    <View key="donut" style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border, flexDirection: "row", gap: 16, alignItems: "center" }]}>
      <DonutChart segments={(["correct", "close", "confused", "wrong"] as Outcome[]).map((k) => ({ value: o[k], color: tone[k] }))} size={104} strokeWidth={15} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>{sel ? "That day" : "Last 30 days"}</Text>
        <Legend
          rows={[
            { color: tone.correct, label: "Right", value: String(o.correct) },
            { color: tone.close, label: "Close", value: String(o.close) },
            { color: tone.confused, label: "Mixed up", value: String(o.confused) },
            { color: tone.wrong, label: "Missed", value: String(o.wrong) },
          ]}
        />
      </View>
    </View>,

    <View key="missed" style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border, gap: 6 }]}>
      <SectionTitle title={sel ? "Missed that day" : "Weakest right now"} />
      {(sel ? missedCards.map((c) => ({ c: c!, p: recall(app.model, c!, degree(app.edges, c!.id, app.now), app.now) })) : weakest).map(({ c, p }) => (
        <Pressable key={c.id} onPress={() => router.push({ pathname: "/card/[id]", params: { id: c.id } })} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
          <Text numberOfLines={1} style={{ ...t.typography.label, color: t.colors.ink, flex: 1 }}>
            {c.front} · <Text style={{ color: t.colors.inkMuted, fontWeight: "400" }}>{c.back}</Text>
          </Text>
          <Text style={{ ...t.typography.caption, color: p >= app.settings.target ? t.colors.right : t.colors.accent, fontWeight: "700" }}>{Math.round(p * 100)}%</Text>
        </Pressable>
      ))}
      {sel && missedCards.length === 0 ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Nothing missed that day.</Text> : null}
    </View>,

    <View key="cal" style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border, gap: 10 }]}>
      <SectionTitle title="Are the odds honest?" />
      {cal.n < 8 ? (
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>After a few repeat answers this compares the model's odds with what really happened.</Text>
      ) : (
        <>
          {cal.bins
            .filter((b) => b.n > 0)
            .map((b) => (
              <View key={b.lo} style={{ gap: 3 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
                    Predicted {Math.round(b.lo * 100)}–{Math.round(b.hi * 100)}% · {b.n}
                  </Text>
                  <Text style={{ ...t.typography.label, color: t.colors.ink }}>got {Math.round(b.actual * 100)}%</Text>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: t.colors.backgroundAlt }}>
                  <View style={{ width: `${b.actual * 100}%`, height: 8, borderRadius: 4, backgroundColor: t.colors.inkMuted }} />
                  <View style={{ position: "absolute", left: `${b.predicted * 100}%`, top: -3, width: 3, height: 14, borderRadius: 2, backgroundColor: t.colors.accent }} />
                </View>
              </View>
            ))}
          <Text style={{ ...t.typography.caption, color: t.colors.inkFaint }}>Red tick = predicted, bar = what happened. Brier score {cal.brier.toFixed(3)} (lower is better).</Text>
        </>
      )}
    </View>,

    <View key="hl" style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
      <SectionTitle title="How long cards stick" />
      <View style={{ height: 10 }} />
      <BarChart data={hb.map((b) => ({ label: b.label, value: b.n }))} color={t.colors.ink} height={100} />
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, marginTop: 8 }}>Half-life: time until recall drops to 50%. {studied.length} studied cards.</Text>
    </View>,

    <View key="learned" style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border, gap: 8 }]}>
      <SectionTitle title="What the model learned about you" />
      {ls.map((l) => (
        <View key={l.label} style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{l.label}</Text>
          <Text style={{ ...t.typography.label, color: l.factor >= 1 ? t.colors.right : t.colors.accent }}>
            memory × {l.factor.toFixed(2)}
          </Text>
        </View>
      ))}
      <Text style={{ ...t.typography.caption, color: t.colors.inkFaint }}>Learned from {app.model.n} spaced answers; same-session repeats don't count.</Text>
    </View>,

    <View key="heat" style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
      <SectionTitle title="12 weeks of practice" />
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <View style={{ gap: 3 }}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
            <Text key={w} style={{ fontSize: 9, lineHeight: 15, height: 15, color: t.colors.inkFaint }}>
              {w}
            </Text>
          ))}
        </View>
        <View style={{ width: W * 18 - 3 }}>
          <Heatmap cells={cells} cellSize={15} gap={3} onCellPress={(c) => (perDay.has(c.key) ? setSel(c.key) : undefined)} colorForIntensity={(v) => (v < 0 ? "transparent" : v === 0 ? t.colors.backgroundAlt : v < 0.34 ? t.colors.accentSoft : v < 0.67 ? t.colors.accent : t.colors.accentDeep)} />
        </View>
      </View>
    </View>,
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ChevronLeft size={20} color={t.colors.ink} />
        </IconButton>
        <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>Stats</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40, gap: 12 }}>
        {sections.map((s, i) => (
          <Animated.View key={i} entering={FadeInDown.delay(staggerDelay(i, 60)).duration(380)}>
            {s}
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 22, borderWidth: 1 },
});
