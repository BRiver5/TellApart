import { useState } from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Line } from "react-native-svg";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useTheme } from "../theme";
import { haptics } from "../services/haptics";

export type WebNode = { id: string; label: string; color: string; cluster: number };
export type WebEdge = { a: string; b: string; w: number };

const PAIR_H = 92;
const GROUP_H = 170;
const GAP = 10;

// Паутина путаниц: каждая группа (компонента связности) — своя ячейка. Пары
// по две в ряд, группы из трёх и больше — по кругу на всю ширину. Толщина
// ребра — вес путаницы. Тап по карточке подсвечивает её связи, остальное
// гаснет; повторный тап снимает.
export function ConfusionWeb({ nodes, edges, selected, onSelect }: { nodes: WebNode[]; edges: WebEdge[]; selected: string | null; onSelect: (id: string | null) => void }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const groups = [...new Set(nodes.map((n) => n.cluster))].map((c) => nodes.filter((n) => n.cluster === c)).sort((a, b) => b.length - a.length);

  // Раскладка ячеек потоком.
  const cells: { x: number; y: number; cw: number; ch: number; members: WebNode[] }[] = [];
  let y = 0;
  let col = 0;
  for (const g of groups) {
    if (g.length > 2) {
      if (col) {
        y += PAIR_H + GAP;
        col = 0;
      }
      cells.push({ x: 0, y, cw: w, ch: GROUP_H, members: g });
      y += GROUP_H + GAP;
    } else {
      const cw = (w - GAP) / 2;
      cells.push({ x: col ? cw + GAP : 0, y, cw, ch: PAIR_H, members: g });
      if (col) y += PAIR_H + GAP;
      col = col ? 0 : 1;
    }
  }
  const height = Math.max(PAIR_H, y + (col ? PAIR_H : 0));

  const pos = new Map<string, { x: number; y: number }>();
  for (const c of cells) {
    const n = c.members.length;
    c.members.forEach((m, i) => {
      if (n === 2) pos.set(m.id, { x: c.x + c.cw / 2, y: c.y + (i === 0 ? 22 : c.ch - 22) });
      else {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const r = Math.min(c.cw / 2 - 60, c.ch / 2 - 22);
        pos.set(m.id, { x: c.x + c.cw / 2 + r * 1.6 * Math.cos(a), y: c.y + c.ch / 2 + r * Math.sin(a) });
      }
    });
  }
  const maxW = Math.max(1, ...edges.map((e) => e.w));
  const near = new Set(selected ? edges.filter((e) => e.a === selected || e.b === selected).flatMap((e) => [e.a, e.b]) : []);

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ height: w ? height : PAIR_H }}>
      {w > 0 ? (
        <>
          {cells.map((c, i) => (
            <View key={i} style={{ position: "absolute", left: c.x, top: c.y, width: c.cw, height: c.ch, borderRadius: 16, backgroundColor: t.colors.surfaceAlt }} />
          ))}
          <Svg width={w} height={height} style={{ position: "absolute" }}>
            {edges.map((e) => {
              const p = pos.get(e.a);
              const q = pos.get(e.b);
              if (!p || !q) return null;
              const on = !selected || e.a === selected || e.b === selected;
              return <Line key={`${e.a}${e.b}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={on ? t.colors.mixup : t.colors.border} strokeWidth={2 + (e.w / maxW) * 8} strokeLinecap="round" opacity={on ? 0.8 : 0.5} />;
            })}
          </Svg>
          {nodes.map((n, i) => {
            const p = pos.get(n.id);
            if (!p) return null;
            const dim = selected !== null && n.id !== selected && !near.has(n.id);
            return (
              <Animated.View key={n.id} entering={ZoomIn.delay(Math.min(i, 12) * 40).duration(300)} style={{ position: "absolute", left: p.x - 70, top: p.y - 15, width: 140, alignItems: "center", opacity: dim ? 0.3 : 1 }}>
                <Pressable
                  accessibilityLabel={`node ${n.label}`}
                  onPress={() => {
                    haptics.tick();
                    onSelect(selected === n.id ? null : n.id);
                  }}
                  style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: n.id === selected ? t.colors.mixup : t.colors.surface, borderWidth: 1.5, borderColor: n.color, maxWidth: 140 }}
                >
                  <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "700", color: n.id === selected ? t.colors.onAccent : t.colors.ink }}>
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
