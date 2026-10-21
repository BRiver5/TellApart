import { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ArrowLeftRight, ChevronLeft, Pause, Play, Trash } from "lucide-react-native";
import { useTheme } from "../../src/theme";
import { staggerDelay } from "../../src/theme/motion";
import { useApp } from "../../src/store/appStore";
import { ForgettingCurve } from "../../src/components/ForgettingCurve";
import { IconButton, SectionTitle } from "../../src/components/Bits";
import { PressableScale } from "../../src/components/PressableScale";
import { explainCard } from "../../src/lib/explain";
import { inputStyle } from "../../src/components/Sheet";
import { deckColor } from "../../src/ui/decks";
import { DAY_MS, type Outcome } from "../../src/lib/types";

const OUT: Record<Outcome, string> = { correct: "Right", close: "Close", wrong: "Missed", confused: "Mixed up" };

export default function CardDetail() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const app = useApp();
  const card = app.cards.find((c) => c.id === id);
  const [front, setFront] = useState<string | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const why = useMemo(() => (card ? explainCard(card, app.model, app.edges, app.now, app.settings.target, app.session) : null), [app.version, card?.lastAt, card?.correct, card?.wrong]);
  if (!card || !why) return null;
  const history = app.reviews.filter((r) => r.cardId === card.id).reverse();
  const sinceDays = card.lastAt === null ? 0 : (app.now - card.lastAt) / DAY_MS;
  const maxPart = Math.max(0.5, ...why.parts.map((p) => Math.abs(p.value)));
  const tone: Record<Outcome, string> = { correct: t.colors.right, close: t.colors.close, wrong: t.colors.accent, confused: t.colors.mixup };

  const saveText = () => {
    const f = front?.trim();
    const b = back?.trim();
    if ((f && f !== card.front) || (b && b !== card.back)) app.updateCard({ ...card, front: f || card.front, back: b || card.back });
    setFront(null);
    setBack(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ChevronLeft size={20} color={t.colors.ink} />
        </IconButton>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: deckColor(card.deck, t) }} />
        <Text style={{ ...t.typography.label, color: t.colors.inkMuted, flex: 1 }}>{card.deck}</Text>
        <IconButton label={card.suspended ? "Resume card" : "Suspend card"} onPress={() => app.updateCard({ ...card, suspended: !card.suspended })}>
          {card.suspended ? <Play size={16} color={t.colors.ink} /> : <Pause size={16} color={t.colors.ink} />}
        </IconButton>
        <IconButton
          label="Delete card"
          onPress={() =>
            Alert.alert("Delete card?", card.front, [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: async () => { router.back(); await app.deleteCard(card.id); } },
            ])
          }
        >
          <Trash size={16} color={t.colors.danger} />
        </IconButton>
      </View>

      <ScrollView stickyHeaderIndices={[1, 3, 5, 7]} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        {/* 0: инлайн-редактирование */}
        <Animated.View entering={FadeInDown.duration(360)} style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border, gap: 8 }]}>
          <TextInput value={front ?? card.front} onChangeText={setFront} onBlur={saveText} accessibilityLabel="Prompt" style={{ fontSize: 26, fontWeight: "800", color: t.colors.ink, padding: 0 }} maxLength={80} />
          <TextInput value={back ?? card.back} onChangeText={setBack} onBlur={saveText} accessibilityLabel="Answer" autoCapitalize="none" style={[inputStyle(t), { fontSize: 18 }]} maxLength={80} />
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
            {card.correct} right · {card.wrong} missed{card.suspended ? " · paused" : ""} · usually {Math.round(card.seconds)} s to answer
          </Text>
        </Animated.View>

        {/* 1 */}
        <Sticky title="Memory" />
        {/* 2 */}
        <View style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
          {card.lastAt === null ? (
            <Text style={{ ...t.typography.body, color: t.colors.inkMuted }}>Not studied yet — it joins a session as one of today's new cards.</Text>
          ) : (
            <>
              <Text style={{ ...t.typography.body, color: t.colors.ink }}>
                <Text style={{ fontWeight: "800" }}>{Math.round(why.p * 100)}%</Text> chance to recall now · half-life {why.h < 1 ? `${Math.round(why.h * 24)} h` : `${why.h.toFixed(1)} days`}
              </Text>
              <View style={{ height: 12 }} />
              <ForgettingCurve h={why.h} sinceDays={sinceDays} target={app.settings.target} />
            </>
          )}
        </View>

        {/* 3 */}
        <Sticky title="Why it lasts this long" />
        {/* 4 */}
        <View style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border, gap: 8 }]}>
          {why.parts.map((p) => (
            <View key={p.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, width: 96 }}>{p.label}</Text>
              <View style={{ flex: 1, height: 10, flexDirection: "row" }}>
                <View style={{ flex: 1, alignItems: "flex-end" }}>{p.value < 0 ? <View style={{ width: `${(Math.abs(p.value) / maxPart) * 100}%`, height: 10, borderRadius: 3, backgroundColor: t.colors.accent }} /> : null}</View>
                <View style={{ width: 1, backgroundColor: t.colors.border }} />
                <View style={{ flex: 1 }}>{p.value > 0 ? <View style={{ width: `${(p.value / maxPart) * 100}%`, height: 10, borderRadius: 3, backgroundColor: t.colors.right }} /> : null}</View>
              </View>
              <Text style={{ ...t.typography.caption, color: t.colors.ink, width: 40, textAlign: "right", fontWeight: "700" }}>
                {p.value >= 0 ? "+" : ""}
                {p.value.toFixed(1)}
              </Text>
            </View>
          ))}
          <Text style={{ ...t.typography.caption, color: t.colors.inkFaint }}>
            Each bar adds to the exponent of the half-life: +1 doubles it, −1 halves it. The weights are learned from all your answers; "this card" is learned from this one.
          </Text>
          {why.value ? (
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
              {why.inSession === "picked" ? "In today's session" : "Due, but didn't fit today"}: risk {why.value.risk.toFixed(2)}
              {why.value.mixup > 0 ? ` × (1 + ${why.value.mixup.toFixed(2)} for mix-ups)` : ""}.
            </Text>
          ) : null}
        </View>

        {/* 5 */}
        <Sticky title="Mixed up with" />
        {/* 6 */}
        <View style={{ paddingHorizontal: 16, gap: 6 }}>
          {why.partners.length === 0 ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>No mix-ups recorded.</Text> : null}
          {why.partners.map((p, i) => {
            const o = app.cards.find((c) => c.id === p.id);
            if (!o) return null;
            return (
              <Animated.View key={p.id} entering={FadeInDown.delay(staggerDelay(i)).duration(300)}>
                <PressableScale onPress={() => router.push({ pathname: "/card/[id]", params: { id: o.id } })} style={[styles.row, { backgroundColor: t.colors.markerSoft }]}>
                  <ArrowLeftRight size={15} color={t.colors.mixup} />
                  <Text style={{ ...t.typography.label, color: t.colors.ink, flex: 1 }}>
                    {o.front} · {o.back}
                  </Text>
                  <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{p.w.toFixed(1)}</Text>
                </PressableScale>
              </Animated.View>
            );
          })}
          {why.partners.length ? (
            <PressableScale onPress={() => router.push({ pathname: "/study", params: { drill: [card.id, ...why.partners.slice(0, 2).map((p) => p.id)].join(",") } })} style={{ alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: t.colors.mixup }}>
              <Text style={{ ...t.typography.label, color: t.colors.onAccent }}>Drill them together</Text>
            </PressableScale>
          ) : null}
        </View>

        {/* 7 */}
        <Sticky title={`Answers · ${history.length}`} />
        {/* 8 */}
        <View style={{ paddingHorizontal: 16, gap: 4 }}>
          {history.slice(0, 20).map((r) => (
            <View key={r.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone[r.outcome] }} />
              <Text style={{ ...t.typography.caption, color: t.colors.ink, width: 70 }}>{OUT[r.outcome]}</Text>
              <Text numberOfLines={1} style={{ ...t.typography.caption, color: t.colors.inkMuted, flex: 1 }}>
                {r.answer ? `“${r.answer}”` : "—"}
              </Text>
              <Text style={{ ...t.typography.caption, color: t.colors.inkFaint }}>{r.p > 0 ? `${Math.round(r.p * 100)}%` : "new"}</Text>
              <Text style={{ ...t.typography.caption, color: t.colors.inkFaint, width: 54, textAlign: "right" }}>{new Date(r.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</Text>
            </View>
          ))}
          {history.length === 0 ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>No answers yet.</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Sticky({ title }: { title: string }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.colors.background, paddingHorizontal: 16, paddingTop: t.spacing.xl, paddingBottom: 8 }}>
      <SectionTitle title={title} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 4, padding: 16, borderRadius: 22, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 14 },
});
