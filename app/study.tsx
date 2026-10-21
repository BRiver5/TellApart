import { useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, FadeInRight } from "react-native-reanimated";
import { ArrowLeftRight, Check, X } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { useApp } from "../src/store/appStore";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { PressableScale } from "../src/components/PressableScale";
import { IconButton } from "../src/components/Bits";
import { AnswerDiff } from "../src/components/AnswerDiff";
import { SuccessBurst } from "../src/components/SuccessBurst";
import { deckColor } from "../src/ui/decks";
import { haptics } from "../src/services/haptics";
import type { Judgement } from "../src/lib/match";
import type { Outcome } from "../src/lib/types";

type Item = { id: string; block: number | null; again: boolean };

const LABEL: Record<Outcome, string> = { correct: "Right", close: "Close — small typo", wrong: "Not quite", confused: "Mixed up" };

export default function Study() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { drill } = useLocalSearchParams<{ drill?: string }>();
  const app = useApp();
  // Очередь фиксируется на входе: ответы меняют модель, но не перетасовывают сессию.
  const initial = useMemo<Item[]>(() => {
    if (drill) {
      const ids = drill.split(",");
      return [...ids, ...[...ids].reverse(), ...ids].map((id) => ({ id, block: 0, again: false }));
    }
    return (app.session?.picks ?? []).map((p) => ({ id: p.card.id, block: p.block, again: false }));
  }, []);
  const [queue, setQueue] = useState(initial);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<(Judgement & { p: number }) | null>(null);
  const [tally, setTally] = useState<Record<Outcome, number>>({ correct: 0, close: 0, wrong: 0, confused: 0 });
  const [done, setDone] = useState(false);
  const started = useRef(Date.now());
  const sessionStart = useRef(Date.now());
  const input = useRef<TextInput>(null);

  const item = queue[i];
  const card = item ? app.cards.find((c) => c.id === item.id) : undefined;
  const other = result?.confusedWith ? app.cards.find((c) => c.id === result.confusedWith) : undefined;
  const nextIsPartner = item && queue[i + 1] && item.block !== null && queue[i + 1].block === item.block;
  const progressPct = `${(Math.min(i, queue.length) / Math.max(1, queue.length)) * 100}%` as const;

  const check = async (give?: boolean) => {
    if (!card || result) return;
    const r = await app.answer(card.id, give ? "" : typed, Date.now() - started.current);
    setResult(r);
    setTally((x) => ({ ...x, [r.outcome]: x[r.outcome] + 1 }));
    if (r.outcome === "correct") haptics.success();
    else if (r.outcome === "close") haptics.tap();
    else haptics.warning();
    // Промах или путаница — карточка вернётся в конце, один раз.
    if ((r.outcome === "wrong" || r.outcome === "confused") && !item.again) setQueue((q) => [...q, { id: card.id, block: null, again: true }]);
  };

  const next = () => {
    setResult(null);
    setTyped("");
    started.current = Date.now();
    if (i + 1 >= queue.length) {
      setDone(true);
      haptics.success();
      app.refresh();
      return;
    }
    setI(i + 1);
    setTimeout(() => input.current?.focus(), 50);
  };

  if (done || !card) {
    const total = tally.correct + tally.close + tally.wrong + tally.confused;
    const mins = Math.max(1, Math.round((Date.now() - sessionStart.current) / 60000));
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top + 40, paddingHorizontal: 24, alignItems: "center", gap: 14 }}>
        <SuccessBurst visible size={110} />
        <Text style={{ ...t.typography.title, color: t.colors.ink }}>{total ? "Session done" : "Nothing to study"}</Text>
        {total ? (
          <Animated.View entering={FadeInDown.delay(200)} style={[styles.card, { alignSelf: "stretch", backgroundColor: t.colors.surface, borderColor: t.colors.border, gap: 8 }]}>
            <Stat label="Right" value={tally.correct} color={t.colors.right} />
            <Stat label="Close" value={tally.close} color={t.colors.close} />
            <Stat label="Mixed up" value={tally.confused} color={t.colors.mixup} />
            <Stat label="Not quite" value={tally.wrong} color={t.colors.accent} />
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, marginTop: 4 }}>
              {total} answers in about {mins} min. {tally.confused ? "Mixed-up pairs come back side by side next time." : "No mix-ups this time."}
            </Text>
          </Animated.View>
        ) : null}
        <View style={{ alignSelf: "stretch" }}>
          <PrimaryButton label="Back to cards" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const tone = result ? { correct: t.colors.right, close: t.colors.close, wrong: t.colors.accent, confused: t.colors.mixup }[result.outcome] : t.colors.ink;
  const soft = result ? { correct: t.colors.rightSoft, close: t.colors.closeSoft, wrong: t.colors.accentSoft, confused: t.colors.mixupSoft }[result.outcome] : t.colors.surface;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconButton label="End session" onPress={() => (tally.correct + tally.close + tally.wrong + tally.confused ? setDone(true) : router.back())}>
          <X size={18} color={t.colors.ink} />
        </IconButton>
        <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: t.colors.backgroundAlt, overflow: "hidden" }}>
          <View style={{ height: 8, width: progressPct, backgroundColor: t.colors.accent }} />
        </View>
        <Text style={{ ...t.typography.label, color: t.colors.inkMuted }}>
          {i + 1}/{queue.length}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {item.block !== null ? (
          <Animated.View entering={FadeIn} style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: t.colors.markerSoft }}>
            <ArrowLeftRight size={14} color={t.colors.mixup} />
            <Text style={{ ...t.typography.label, color: t.colors.ink }}>{drill ? "Drill: tell these apart" : "Contrast: you've mixed these up"}</Text>
          </Animated.View>
        ) : item.again ? (
          <Text style={{ ...t.typography.label, color: t.colors.accent }}>Once more</Text>
        ) : null}

        <Animated.View key={`${i}`} entering={FadeInRight.duration(280)} style={[styles.card, { backgroundColor: soft, borderColor: result ? tone : t.colors.border, minHeight: 190, justifyContent: "center", gap: 10 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: deckColor(card.deck, t) }} />
            <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>{card.deck}</Text>
          </View>
          <Text style={{ fontSize: 30, fontWeight: "800", color: t.colors.ink, letterSpacing: -0.4 }}>{card.front}</Text>
          {result ? (
            <Animated.View entering={FadeInDown.duration(260)} style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {result.outcome === "correct" ? <Check size={18} color={tone} strokeWidth={3} /> : result.outcome === "confused" ? <ArrowLeftRight size={18} color={tone} /> : <X size={18} color={tone} strokeWidth={3} />}
                <Text style={{ ...t.typography.subtitle, color: tone }}>{LABEL[result.outcome]}</Text>
              </View>
              {result.outcome === "correct" ? (
                <Text style={{ fontSize: 22, fontWeight: "700", color: t.colors.ink }}>{card.back}</Text>
              ) : typed.trim() ? (
                <AnswerDiff typed={typed} correct={card.back} />
              ) : (
                <Text style={{ fontSize: 22, fontWeight: "700", color: t.colors.right }}>{card.back}</Text>
              )}
              {other ? (
                <View style={{ padding: 10, borderRadius: 12, backgroundColor: t.colors.surface, gap: 2 }}>
                  <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>“{other.back}” is the answer for</Text>
                  <Text style={{ ...t.typography.label, color: t.colors.mixup }}>{other.front}</Text>
                </View>
              ) : null}
              <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
                {result.p > 0 ? `Model gave you ${Math.round(result.p * 100)}% for this one.` : "First time seeing this card."}
                {nextIsPartner ? " Its look-alike is next." : ""}
              </Text>
            </Animated.View>
          ) : null}
        </Animated.View>

        {!result ? (
          <View style={{ gap: 10 }}>
            <TextInput
              ref={input}
              value={typed}
              onChangeText={setTyped}
              onSubmitEditing={() => check()}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              placeholder="Type the answer"
              placeholderTextColor={t.colors.inkFaint}
              accessibilityLabel="Answer"
              style={{ fontSize: 20, padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: t.colors.ink, backgroundColor: t.colors.surface, color: t.colors.ink }}
            />
            <PrimaryButton label="Check" disabled={!typed.trim()} onPress={() => check()} />
            <PressableScale onPress={() => check(true)} style={{ alignSelf: "center", padding: 8 }}>
              <Text style={{ ...t.typography.label, color: t.colors.inkMuted }}>I don't know</Text>
            </PressableScale>
          </View>
        ) : (
          <PrimaryButton label={i + 1 >= queue.length ? "Finish" : "Next"} onPress={next} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ ...t.typography.body, color: t.colors.ink, flex: 1 }}>{label}</Text>
      <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, borderRadius: 24, borderWidth: 1.5 },
});
