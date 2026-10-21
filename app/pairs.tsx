import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ArrowLeftRight, ChevronLeft } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { ConfusionWeb } from "../src/components/ConfusionWeb";
import { IconButton, SectionTitle } from "../src/components/Bits";
import { PressableScale } from "../src/components/PressableScale";
import { EmptyState } from "../src/components/EmptyState";
import { clusters, weightAt } from "../src/lib/confusion";
import { deckColor } from "../src/ui/decks";

export default function Pairs() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const app = useApp();
  const [sel, setSel] = useState<string | null>(null);

  const data = useMemo(() => {
    const live = app.edges.map((e) => ({ a: e.a, b: e.b, w: weightAt(e, app.now) })).filter((e) => e.w >= 0.1);
    const ids = [...new Set(live.flatMap((e) => [e.a, e.b]))].filter((id) => app.cards.some((c) => c.id === id));
    const groups = clusters(ids, app.edges, app.now, 0.1);
    const clusterOf = new Map<string, number>();
    groups.forEach((g, i) => g.forEach((id) => clusterOf.set(id, i)));
    const nodes = ids.map((id) => {
      const c = app.cards.find((x) => x.id === id)!;
      return { id, label: c.front, color: deckColor(c.deck, t), cluster: clusterOf.get(id) ?? 0 };
    });
    return { live: live.sort((x, y) => y.w - x.w), nodes, groups };
  }, [app.version, app.edges.length]);

  const name = (id: string) => app.cards.find((c) => c.id === id);
  const shown = sel ? data.live.filter((e) => e.a === sel || e.b === sel) : data.live;

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconButton label="Back" onPress={() => router.back()}>
          <ChevronLeft size={20} color={t.colors.ink} />
        </IconButton>
        <View style={{ flex: 1 }}>
          <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>Mix-ups</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
            {data.live.length} pairs in {data.groups.length} {data.groups.length === 1 ? "group" : "groups"} · fade over 3 weeks
          </Text>
        </View>
      </View>
      {data.nodes.length === 0 ? (
        <EmptyState title="No mix-ups yet" description="When you type one card's answer for another, both cards and the link between them appear here." />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40, gap: 12 }}>
          <Animated.View entering={FadeInDown.duration(360)} style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
            <ConfusionWeb nodes={data.nodes} edges={data.live} selected={sel} onSelect={setSel} />
            <View style={{ height: 8 }} />
            <Text style={{ ...t.typography.caption, color: t.colors.inkFaint, textAlign: "center" }}>Thicker line = mixed up more often lately. Tap a card to focus it.</Text>
          </Animated.View>
          <SectionTitle title={sel ? `Pairs with ${name(sel)?.front ?? ""}` : "All pairs"} right={sel ? <Text onPress={() => setSel(null)} style={{ ...t.typography.label, color: t.colors.mixup }}>Show all</Text> : undefined} />
          {shown.map((e, i) => {
            const a = name(e.a);
            const b = name(e.b);
            if (!a || !b) return null;
            return (
              <Animated.View key={e.a + e.b} entering={FadeInDown.delay(staggerDelay(i)).duration(300)}>
                <View style={[styles.row, { backgroundColor: t.colors.surface, borderColor: t.colors.border }]}>
                  <ArrowLeftRight size={16} color={t.colors.mixup} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...t.typography.label, color: t.colors.ink }}>
                      {a.front} ⇄ {b.front}
                    </Text>
                    <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
                      {a.back} · {b.back}
                    </Text>
                    <View style={{ height: 5, borderRadius: 3, backgroundColor: t.colors.backgroundAlt, marginTop: 6 }}>
                      <View style={{ width: `${Math.min(100, (e.w / Math.max(1, data.live[0].w)) * 100)}%`, height: 5, borderRadius: 3, backgroundColor: t.colors.marker }} />
                    </View>
                  </View>
                  <PressableScale onPress={() => router.push({ pathname: "/study", params: { drill: `${a.id},${b.id}` } })} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: t.colors.mixup }}>
                    <Text style={{ ...t.typography.label, color: t.colors.onAccent }}>Drill</Text>
                  </PressableScale>
                </View>
              </Animated.View>
            );
          })}
          <Text style={{ ...t.typography.caption, color: t.colors.inkFaint }}>Answering both right in the same session weakens their link. Each mix-up also shortens how long both cards stick.</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, borderRadius: 22, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, borderWidth: 1 },
});
