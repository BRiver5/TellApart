import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ChevronLeft, TriangleAlert, Wand } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { forecastInput, useApp } from "../src/store/appStore";
import { LoadChart } from "../src/components/LoadChart";
import { Segmented } from "../src/components/Segmented";
import { IconButton, SectionTitle, Stepper } from "../src/components/Bits";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { PressableScale } from "../src/components/PressableScale";
import { SuccessBurst } from "../src/components/SuccessBurst";
import { whatIf, describeChange, type Change } from "../src/lib/changes";
import { haptics } from "../src/services/haptics";

type Mode = "budget" | "target" | "new";

export default function ForecastScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const app = useApp();
  const [mode, setMode] = useState<Mode>("budget");
  const [budget, setBudget] = useState(app.settings.budgetMin + 5);
  const [target, setTarget] = useState(Math.round(app.settings.target * 100) - 3);
  const [fresh, setFresh] = useState(Math.max(0, app.settings.newPerDay - 5));
  const [day, setDay] = useState<number | null>(null);
  const [burst, setBurst] = useState(false);
  const change: Change = mode === "budget" ? { kind: "budget", minutes: budget } : mode === "target" ? { kind: "target", value: target / 100 } : { kind: "newPerDay", value: fresh };
  const cmp = useMemo(() => (app.forecast ? whatIf(forecastInput(app), [change], app.forecast) : null), [app.version, app.forecast, JSON.stringify(change)]);
  const f = app.forecast;

  const applyFix = async (changes: Change[]) => {
    for (const c of changes) await app.applyChange(c);
    haptics.success();
    setBurst(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ChevronLeft size={20} color={t.colors.ink} />
        </IconButton>
        <View style={{ flex: 1 }}>
          <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>Next 30 days</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Simulated 24 times with your memory model</Text>
        </View>
      </View>
      {!f || !cmp ? (
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, padding: 16 }}>Simulating…</Text>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40, gap: 12 }}>
          <Animated.View entering={FadeInDown.duration(360)} style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
            <LoadChart demand={f.days.map((d) => d.demand)} compare={cmp.after.days.map((d) => d.demand)} budget={app.settings.budgetMin} selected={day} onSelect={setDay} />
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, marginTop: 8 }}>
              {day !== null
                ? `Day ${day + 1}: ${Math.round(f.days[day].demand)} min wanted (90% of runs under ${Math.round(f.days[day].p90)}), ${Math.round(f.days[day].served)} min done, ${f.days[day].backlog.toFixed(1)} cards left over → if: ${Math.round(cmp.after.days[day].demand)} min, ${cmp.after.days[day].backlog.toFixed(1)} left.`
                : `Red = over your ${app.settings.budgetMin} min (cards slip to the next day). Yellow = the what-if below. Tap a day.`}
            </Text>
          </Animated.View>

          {(app.conflicts ?? []).map((c, i) => (
            <Animated.View key={c.id} entering={FadeInDown.delay(staggerDelay(i)).duration(340)} style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.accentSoft }]}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TriangleAlert size={18} color={t.colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...t.typography.body, fontWeight: "700", color: t.colors.ink }}>{c.title}</Text>
                  <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, marginTop: 2 }}>{c.reason}</Text>
                </View>
              </View>
              {c.fixes.length ? (
                <View style={{ marginTop: 10, gap: 6 }}>
                  <Text style={{ ...t.typography.overline, color: t.colors.inkFaint }}>Ways out, checked by re-simulating</Text>
                  {c.fixes.map((fx, j) => (
                    <PressableScale key={j} onPress={() => applyFix(fx.changes)} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, backgroundColor: j === 0 ? t.colors.accentSoft : t.colors.surfaceAlt }}>
                      <Wand size={15} color={j === 0 ? t.colors.accent : t.colors.inkMuted} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...t.typography.label, color: t.colors.ink }}>{fx.label}</Text>
                        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{fx.effect}</Text>
                      </View>
                    </PressableScale>
                  ))}
                </View>
              ) : null}
              {c.cardIds ? (
                <PressableScale onPress={() => router.push({ pathname: "/study", params: { drill: c.cardIds!.slice(0, 4).join(",") } })} style={{ marginTop: 8, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: t.colors.mixup }}>
                  <Text style={{ ...t.typography.label, color: t.colors.onAccent }}>Drill these now</Text>
                </PressableScale>
              ) : null}
            </Animated.View>
          ))}

          <SectionTitle title="What if" style={{ marginTop: 6 }} />
          <Segmented
            items={[
              { key: "budget", label: "Minutes" },
              { key: "target", label: "Target" },
              { key: "new", label: "New cards" },
            ]}
            value={mode}
            onChange={(k) => setMode(k as Mode)}
          />
          <View style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
            <Text style={{ ...t.typography.label, color: t.colors.ink, flex: 1 }}>{mode === "budget" ? "Minutes a day" : mode === "target" ? "Target recall" : "New cards a day"}</Text>
            {mode === "budget" ? <Stepper value={budget} min={3} max={90} onChange={setBudget} format={(v) => `${v}m`} /> : mode === "target" ? <Stepper value={target} min={70} max={97} onChange={setTarget} format={(v) => `${v}%`} /> : <Stepper value={fresh} min={0} max={50} onChange={setFresh} />}
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Column title="Now" backlog={cmp.before.backlogSum / 30} retention={cmp.before.retention} overflow={cmp.before.overflowDays} />
            <Column title="If" backlog={cmp.after.backlogSum / 30} retention={cmp.after.retention} overflow={cmp.after.overflowDays} base={{ backlog: cmp.before.backlogSum / 30, retention: cmp.before.retention }} />
          </View>
          <PrimaryButton
            label={`Apply: ${describeChange(change)}`}
            onPress={async () => {
              await app.applyChange(change);
              haptics.success();
              setBurst(true);
            }}
          />
        </ScrollView>
      )}
      {burst ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
          <SuccessBurst visible size={100} onDone={() => setTimeout(() => setBurst(false), 200)} />
        </View>
      ) : null}
    </View>
  );
}

function Column({ title, backlog, retention, overflow, base }: { title: string; backlog: number; retention: number; overflow: number; base?: { backlog: number; retention: number } }) {
  const t = useTheme();
  const db = base ? backlog - base.backlog : 0;
  const dr = base ? Math.round((retention - base.retention) * 100) : 0;
  return (
    <View style={[styles.card, { flex: 1, backgroundColor: base ? t.colors.surface : t.colors.surfaceAlt, borderColor: t.colors.border, gap: 3 }]}>
      <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>{title}</Text>
      <Text style={{ fontSize: 26, fontWeight: "800", color: t.colors.ink }}>{backlog.toFixed(1)}</Text>
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>cards left over a day</Text>
      {base && Math.abs(db) >= 0.1 ? <Text style={{ ...t.typography.label, color: db < 0 ? t.colors.right : t.colors.accent }}>{db > 0 ? "+" : ""}{db.toFixed(1)}</Text> : null}
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, marginTop: 6 }}>
        recall at review {Math.round(retention * 100)}%{base && dr !== 0 ? ` (${dr > 0 ? "+" : ""}${dr})` : ""}
      </Text>
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{overflow} days over budget</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 20, borderWidth: 1 },
});
