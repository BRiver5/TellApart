import { useEffect, useState } from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Line } from "react-native-svg";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useTheme } from "../theme";
import { haptics } from "../services/haptics";

export type WebNode = { id: string; label: string; color: string; cluster: number };
export type WebEdge = { a: string; b: string; w: number };

// Паутина путаниц: узлы кластерами по кругу (кластеры — секторами), толщина
// ребра — вес путаницы. Тап по узлу подсвечивает его рёбра и соседей,
// остальное гаснет; повторный тап снимает.
export function ConfusionWeb({ nodes, edges, selected, onSelect, height = 320 }: { nodes: WebNode[]; edges: WebEdge[]; selected: string | null; onSelect: (id: string | null) => void; height?: number }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const [, force] = useState(0);
  useEffect(() => force((x) => x + 1), [nodes.length]);
  const cx = w / 2;
  const cy = height / 2;
  const r = Math.min(w, height) / 2 - 34;
  // Кластеры подряд по кругу с промежутком между ними.
  const clusterIds = [...new Set(nodes.map((n) => n.cluster))];
  const slots = nodes.length + clusterIds.length;
  const pos = new Map<string, { x: number; y: number }>();
  let k = 0;
  for (const c of clusterIds) {
    for (const n of nodes.filter((x) => x.cluster === c)) {
      const a = (k / slots) * Math.PI * 2 - Math.PI / 2;
      pos.set(n.id, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      k++;
    }
    k++;
  }
  const maxW = Math.max(1, ...edges.map((e) => e.w));
  const near = new Set(selected ? edges.filter((e) => e.a === selected || e.b === selected).flatMap((e) => [e.a, e.b]) : []);
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ height }}>
      {w > 0 ? (
        <>
          <Svg width={w} height={height} style={{ position: "absolute" }}>
            {edges.map((e) => {
              const p = pos.get(e.a);
              const q = pos.get(e.b);
              if (!p || !q) return null;
              const on = !selected || e.a === selected || e.b === selected;
              return <Line key={`${e.a}${e.b}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={on ? t.colors.mixup : t.colors.border} strokeWidth={1 + (e.w / maxW) * 7} strokeLinecap="round" opacity={on ? 0.75 : 0.4} />;
            })}
          </Svg>
          {nodes.map((n, i) => {
            const p = pos.get(n.id)!;
            const dim = selected !== null && n.id !== selected && !near.has(n.id);
            return (
              <Animated.View key={n.id} entering={ZoomIn.delay(Math.min(i, 12) * 40).duration(300)} style={{ position: "absolute", left: p.x - 46, top: p.y - 15, width: 92, alignItems: "center", opacity: dim ? 0.3 : 1 }}>
                <Pressable
                  accessibilityLabel={`node ${n.label}`}
                  onPress={() => {
                    haptics.tick();
                    onSelect(selected === n.id ? null : n.id);
                  }}
                  style={{ paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: n.id === selected ? t.colors.mixup : t.colors.surface, borderWidth: 1.5, borderColor: n.color, maxWidth: 92 }}
                >
                  <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: "700", color: n.id === selected ? t.colors.onAccent : t.colors.ink }}>
                    {n.label}
                  </Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </>
      ) : null}
    </View>
  );
}
