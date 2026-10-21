import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme";

// Состав сегодняшней сессии одной полосой: путаницы (маркер), просевшие,
// новые — и то, что не влезло в лимит (штриховка). Сегменты вырастают по очереди.
function Seg({ flex, color, delay, hatched }: { flex: number; color: string; delay: number; hatched?: boolean }) {
  const t = useTheme();
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = 0;
    v.value = withDelay(delay, withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }));
  }, [flex, delay]);
  const st = useAnimatedStyle(() => ({ transform: [{ scaleX: v.value }] }));
  if (flex <= 0) return null;
  return (
    <Animated.View style={[{ flex, height: 14, backgroundColor: color, borderRadius: 4, transformOrigin: "left" }, st]}>
      {hatched ? <View style={{ flex: 1, borderRadius: 4, borderWidth: 1.5, borderStyle: "dashed", borderColor: t.colors.inkFaint }} /> : null}
    </Animated.View>
  );
}

export function SessionBar({ mixups, due, fresh, left }: { mixups: number; due: number; fresh: number; left: number }) {
  const t = useTheme();
  const rows = [
    { n: mixups, color: t.colors.marker, label: "mix-ups" },
    { n: due, color: t.colors.accent, label: "slipping" },
    { n: fresh, color: t.colors.inkMuted, label: "new" },
    { n: left, color: t.colors.backgroundAlt, label: "won't fit" },
  ];
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 3 }}>
        {rows.map((r, i) => (
          <Seg key={r.label} flex={r.n} color={r.color} delay={i * 90} hatched={i === 3} />
        ))}
        {rows.every((r) => r.n === 0) ? <View style={{ flex: 1, height: 14, borderRadius: 4, backgroundColor: t.colors.backgroundAlt }} /> : null}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {rows
          .filter((r) => r.n > 0)
          .map((r) => (
            <View key={r.label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: r.color, borderWidth: r.label === "won't fit" ? 1 : 0, borderColor: t.colors.inkFaint }} />
              <Text style={{ fontSize: 12, color: t.colors.inkMuted }}>
                {r.n} {r.label}
              </Text>
            </View>
          ))}
      </View>
    </View>
  );
}
