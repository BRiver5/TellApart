import { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeInLeft } from "react-native-reanimated";
import { ArrowLeftRight, ChartColumn, Pause, Pencil, Play, Plus, Search, Settings2, Trash, TriangleAlert, TrendingUp } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { deckNames, useApp } from "../src/store/appStore";
import { SessionBar } from "../src/components/SessionBar";
import { AnimatedCounter } from "../src/components/AnimatedCounter";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { PressableScale } from "../src/components/PressableScale";
import { SwipeRow } from "../src/components/SwipeRow";
import { IconButton, SectionTitle } from "../src/components/Bits";
import { Sheet } from "../src/components/Sheet";
import { CardSheet } from "../src/components/CardSheet";
import { SettingsSheet } from "../src/components/SettingsSheet";
import { SuccessBurst } from "../src/components/SuccessBurst";
import { recall } from "../src/lib/memory";
import { degree, weightAt } from "../src/lib/confusion";
import { normalize } from "../src/lib/match";
import { STARTER_DECKS } from "../src/lib/decks";
import { deckColor, initials } from "../src/ui/decks";
import { haptics } from "../src/services/haptics";
import type { Card } from "../src/lib/types";

const RAIL = 74;

export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const app = useApp();
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState<"card" | "edit" | "settings" | "menu" | null>(null);
  const [focus, setFocus] = useState<Card | null>(null);
  const [burst, setBurst] = useState(false);
  const decks = deckNames(app.cards);
  const deck = app.settings.deck;
  const s = app.session;

  const inDeck = useMemo(() => app.cards.filter((c) => deck === null || c.deck === deck), [app.version, app.cards, deck]);
  const pairs = useMemo(() => {
    const ids = new Set(inDeck.map((c) => c.id));
    return app.edges
      .filter((e) => ids.has(e.a) && ids.has(e.b))
      .map((e) => ({ ...e, now: weightAt(e, app.now) }))
      .filter((e) => e.now >= 0.2)
      .sort((a, b) => b.now - a.now)
      .slice(0, 3);
  }, [app.version, app.edges, deck]);
  const q = normalize(query);
  const list = inDeck.filter((c) => !q || normalize(c.front).includes(q) || normalize(c.back).includes(q));
  const byId = (id: string) => app.cards.find((c) => c.id === id);
  const conflicts = app.conflicts ?? [];
  const mixupsInSession = s ? s.picks.filter((p) => p.block !== null).length : 0;
  const dueInSession = s ? s.picks.filter((p) => p.kind === "due" && p.block === null).length : 0;
  const newInSession = s ? s.picks.filter((p) => p.kind === "new").length : 0;

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: t.colors.background }}>
      {/* Колонка колод */}
      <View style={{ width: RAIL, paddingTop: insets.top + t.spacing.md, paddingBottom: insets.bottom + 12, backgroundColor: t.colors.surface, borderRightWidth: 1, borderRightColor: t.colors.border, alignItems: "center" }}>
        <ScrollView contentContainerStyle={{ alignItems: "center", gap: 14, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
          <RailItem label="All" short="ALL" color={t.colors.ink} active={deck === null} count={app.cards.length} onPress={() => app.updateSettings({ deck: null })} />
          {decks.map((d, i) => (
            <Animated.View key={d} entering={FadeInLeft.delay(staggerDelay(i, 50)).duration(320)}>
              <RailItem label={d} short={initials(d)} color={deckColor(d, t)} active={deck === d} count={app.cards.filter((c) => c.deck === d).length} onPress={() => app.updateSettings({ deck: d })} />
            </Animated.View>
          ))}
        </ScrollView>
        <PressableScale accessibilityLabel="New card" onPress={() => setSheet("card")} style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: t.colors.accent, alignItems: "center", justifyContent: "center" }}>
          <Plus size={22} color={t.colors.onAccent} />
        </PressableScale>
      </View>

      {/* Контент */}
      <View style={{ flex: 1 }}>
        <View style={{ paddingTop: insets.top + t.spacing.sm, paddingHorizontal: t.spacing.lg, paddingBottom: 6, flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...t.typography.overline, color: t.colors.accent }}>{deck ?? "All decks"}</Text>
            <Text style={{ fontSize: 24, fontWeight: "800", color: t.colors.ink, letterSpacing: -0.4 }}>Tell Apart</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <IconButton label="Stats" onPress={() => router.push("/stats")}>
              <ChartColumn size={18} color={t.colors.ink} />
            </IconButton>
            <IconButton label="Settings" onPress={() => setSheet("settings")}>
              <Settings2 size={18} color={t.colors.ink} />
            </IconButton>
          </View>
        </View>

        <ScrollView stickyHeaderIndices={[2, 4]} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          {/* 0: сессия */}
          <Animated.View entering={FadeInDown.duration(400)} style={[styles.card, { marginHorizontal: 14, backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
            {app.cards.length === 0 ? (
              <StartCard onAdd={() => setSheet("card")} onStarter={(i) => app.addStarter(i)} />
            ) : (
              <>
                <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Today's session</Text>
                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 2 }}>
                  <AnimatedCounter value={s ? Math.ceil(s.seconds / 60) : 0} style={{ fontSize: 44, fontWeight: "800", color: t.colors.ink, padding: 0 }} />
                  <Text style={{ ...t.typography.body, color: t.colors.inkMuted, marginBottom: 10 }}>
                    min · {s?.picks.length ?? 0} {s?.picks.length === 1 ? "card" : "cards"}
                  </Text>
                </View>
                <View style={{ marginVertical: 12 }}>
                  <SessionBar mixups={mixupsInSession} due={dueInSession} fresh={newInSession} left={s?.left.length ?? 0} />
                </View>
                <PrimaryButton label={s && s.picks.length ? "Start session" : "Nothing due — well done"} disabled={!s || s.picks.length === 0} onPress={() => router.push("/study")} />
                <PressableScale onPress={() => router.push("/forecast")} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 12 }}>
                  <TrendingUp size={14} color={t.colors.inkMuted} />
                  <Text style={{ ...t.typography.label, color: t.colors.inkMuted }}>Next 30 days & what if</Text>
                </PressableScale>
              </>
            )}
          </Animated.View>

          {/* 1: конфликт */}
          <View style={{ paddingHorizontal: 14, marginTop: 10 }}>
            {conflicts.length ? (
              <PressableScale onPress={() => router.push("/forecast")} style={[styles.card, { backgroundColor: t.colors.accentSoft, borderColor: t.colors.accentSoft, flexDirection: "row", gap: 10, alignItems: "center" }]}>
                <TriangleAlert size={17} color={t.colors.accent} />
                <Text numberOfLines={2} style={{ ...t.typography.label, color: t.colors.accentDeep, flex: 1 }}>
                  {conflicts[0].title}
                  {conflicts.length > 1 ? ` · +${conflicts.length - 1}` : ""}
                </Text>
              </PressableScale>
            ) : null}
          </View>

          {/* 2: липкий заголовок путаниц */}
          <Sticky title="Mixed up lately" right={app.edges.length ? <Text onPress={() => router.push("/pairs")} style={{ ...t.typography.label, color: t.colors.mixup }}>All mix-ups</Text> : undefined} />
          {/* 3 */}
          <View style={{ paddingHorizontal: 14, gap: 8 }}>
            {pairs.length === 0 ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>When you answer one card with another's answer, the pair shows up here.</Text> : null}
            {pairs.map((p, i) => {
              const a = byId(p.a);
              const b = byId(p.b);
              if (!a || !b) return null;
              return (
                <Animated.View key={p.a + p.b} entering={FadeInDown.delay(staggerDelay(i)).duration(340)}>
                  <View style={[styles.row, { backgroundColor: t.colors.markerSoft, borderColor: t.colors.markerSoft }]}>
                    <ArrowLeftRight size={16} color={t.colors.mixup} />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ ...t.typography.label, color: t.colors.ink }}>
                        {a.front} ⇄ {b.front}
                      </Text>
                      <Text numberOfLines={1} style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
                        {a.back} / {b.back} · {p.now.toFixed(1)} mix-ups' worth
                      </Text>
                    </View>
                    <PressableScale onPress={() => router.push({ pathname: "/study", params: { drill: `${a.id},${b.id}` } })} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: t.colors.mixup }}>
                      <Text style={{ ...t.typography.label, color: t.colors.onAccent }}>Drill</Text>
                    </PressableScale>
                  </View>
                </Animated.View>
              );
            })}
          </View>

          {/* 4: липкий заголовок карточек + поиск */}
          <View style={{ backgroundColor: t.colors.background, paddingHorizontal: 14, paddingTop: t.spacing.xl, paddingBottom: 8, gap: 8 }}>
            <SectionTitle title={`Cards · ${inDeck.length}`} />
            {inDeck.length > 6 ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.colors.surface, borderRadius: 12, paddingHorizontal: 10, borderWidth: 1, borderColor: t.colors.border }}>
                <Search size={15} color={t.colors.inkFaint} />
                <TextInput value={query} onChangeText={setQuery} placeholder="Search cards" placeholderTextColor={t.colors.inkFaint} style={{ flex: 1, paddingVertical: 8, color: t.colors.ink }} />
              </View>
            ) : null}
          </View>
          {/* 5 */}
          <View style={{ paddingHorizontal: 14, gap: 6 }}>
            {list.map((c, i) => {
              const deg = degree(app.edges, c.id, app.now);
              const p = c.lastAt === null ? null : recall(app.model, c, deg, app.now);
              return (
                <Animated.View key={c.id} entering={FadeInDown.delay(staggerDelay(i, 35)).duration(300)}>
                  <SwipeRow
                    right={{ label: c.suspended ? "Resume" : "Suspend", icon: c.suspended ? <Play size={16} color={t.colors.onAccent} /> : <Pause size={16} color={t.colors.onAccent} />, onTrigger: () => app.updateCard({ ...c, suspended: !c.suspended }) }}
                    left={{ label: "Delete", icon: <Trash size={16} color={t.colors.onAccent} />, onTrigger: () => confirmDelete(c, () => app.deleteCard(c.id)) }}
                  >
                    <PressableScale
                      onPress={() => router.push({ pathname: "/card/[id]", params: { id: c.id } })}
                      onLongPress={() => {
                        haptics.press();
                        setFocus(c);
                        setSheet("menu");
                      }}
                      style={[styles.row, { backgroundColor: t.colors.surface, borderColor: t.colors.border, opacity: c.suspended ? 0.5 : 1 }]}
                    >
                      <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: deckColor(c.deck, t) }} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ ...t.typography.label, color: t.colors.ink }}>
                          {c.front}
                        </Text>
                        <Text numberOfLines={1} style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
                          {c.back}
                          {deg >= 0.3 ? "  · mixed up" : ""}
                        </Text>
                      </View>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: p === null ? t.colors.surfaceAlt : p >= app.settings.target ? t.colors.rightSoft : t.colors.accentSoft }}>
                        <Text style={{ fontSize: 11, fontWeight: "800", color: p === null ? t.colors.inkMuted : p >= app.settings.target ? t.colors.right : t.colors.accent }}>{c.suspended ? "paused" : p === null ? "new" : `${Math.round(p * 100)}%`}</Text>
                      </View>
                    </PressableScale>
                  </SwipeRow>
                </Animated.View>
              );
            })}
            {q && list.length === 0 ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>No card matches “{query}”.</Text> : null}
            {list.length ? <Text style={{ ...t.typography.caption, color: t.colors.inkFaint, textAlign: "center", marginTop: 4 }}>Swipe right to pause · left to delete · hold for more</Text> : null}
          </View>
        </ScrollView>
      </View>

      {burst ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
          <SuccessBurst visible size={100} onDone={() => setTimeout(() => setBurst(false), 200)} />
        </View>
      ) : null}

      <CardSheet
        visible={sheet === "card" || sheet === "edit"}
        editing={sheet === "edit" ? focus : null}
        onClose={() => setSheet(null)}
        decks={decks}
        defaultDeck={deck}
        haveStarter={STARTER_DECKS.filter((d) => decks.includes(d.name)).map((d) => d.name)}
        onStarter={async (i) => {
          setSheet(null);
          await app.addStarter(i);
          haptics.success();
          setBurst(true);
        }}
        onSave={async (d, keep) => {
          if (!keep) setSheet(null);
          if (sheet === "edit" && focus) await app.updateCard({ ...focus, ...d });
          else await app.addCards([d]);
          haptics.success();
          if (!keep) setBurst(true);
        }}
      />
      <SettingsSheet visible={sheet === "settings"} onClose={() => setSheet(null)} settings={app.settings} onChange={(p) => app.updateSettings(p)} onWipe={() => { setSheet(null); app.wipe(); }} />
      <Sheet visible={sheet === "menu" && !!focus} onClose={() => setSheet(null)} title={focus?.front ?? ""} subtitle={focus?.back}>
        {focus ? (
          <>
            <MenuRow icon={<Pencil size={18} color={t.colors.ink} />} label="Edit card" onPress={() => setSheet("edit")} />
            <MenuRow icon={focus.suspended ? <Play size={18} color={t.colors.ink} /> : <Pause size={18} color={t.colors.ink} />} label={focus.suspended ? "Resume card" : "Suspend card"} onPress={async () => { setSheet(null); await app.updateCard({ ...focus, suspended: !focus.suspended }); }} />
            <MenuRow icon={<Trash size={18} color={t.colors.danger} />} label="Delete card" danger onPress={() => confirmDelete(focus, async () => { setSheet(null); await app.deleteCard(focus.id); })} />
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

function confirmDelete(c: Card, go: () => void) {
  Alert.alert("Delete card?", `${c.front} — its answers and mix-ups go too.`, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: go },
  ]);
}

function RailItem({ label, short, color, active, count, onPress }: { label: string; short: string; color: string; active: boolean; count: number; onPress: () => void }) {
  const t = useTheme();
  return (
    <PressableScale accessibilityLabel={`deck ${label}`} onPress={() => { haptics.tick(); onPress(); }} style={{ alignItems: "center", gap: 4, width: RAIL - 8 }}>
      <View style={{ width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: active ? color : t.colors.surfaceAlt, borderWidth: 2, borderColor: active ? color : "transparent" }}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: active ? t.colors.onAccent : color }}>{short}</Text>
        <View style={{ position: "absolute", right: -6, top: -6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: t.colors.inkMuted }}>{count}</Text>
        </View>
      </View>
      <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: active ? "800" : "500", color: active ? t.colors.ink : t.colors.inkMuted, maxWidth: RAIL - 8 }}>
        {label}
      </Text>
    </PressableScale>
  );
}

function Sticky({ title, right }: { title: string; right?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.colors.background, paddingHorizontal: 14, paddingTop: t.spacing.xl, paddingBottom: 8 }}>
      <SectionTitle title={title} right={right} />
    </View>
  );
}

function MenuRow({ icon, label, onPress, danger }: { icon: React.ReactNode; label: string; onPress: () => void; danger?: boolean }) {
  const t = useTheme();
  return (
    <PressableScale onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: t.colors.surfaceAlt }}>
      {icon}
      <Text style={{ ...t.typography.body, fontWeight: "600", color: danger ? t.colors.danger : t.colors.ink }}>{label}</Text>
    </PressableScale>
  );
}

// Пустое состояние — карточка-чеклист "с чего начать".
function StartCard({ onAdd, onStarter }: { onAdd: () => void; onStarter: (i: number) => void }) {
  const t = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ ...t.typography.title, color: t.colors.ink }}>Learn the things you mix up</Text>
      {["Add cards, or take a ready deck.", "Type your answers — a typo is 'close', another card's answer is a mix-up.", "Mixed-up cards come back side by side until you tell them apart."].map((s, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 10 }}>
          <Text style={{ fontWeight: "800", color: t.colors.accent, width: 14 }}>{i + 1}</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, flex: 1 }}>{s}</Text>
        </View>
      ))}
      {STARTER_DECKS.map((d, i) => (
        <PressableScale key={d.name} onPress={() => onStarter(i)} style={{ padding: 12, borderRadius: 14, backgroundColor: t.colors.surfaceAlt }}>
          <Text style={{ ...t.typography.label, color: t.colors.ink }}>{d.name}</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
            {d.hint} · {d.cards.length} cards
          </Text>
        </PressableScale>
      ))}
      <PrimaryButton label="Add my own card" onPress={onAdd} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 22, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 16, borderWidth: 1 },
});
