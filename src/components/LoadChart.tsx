import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme";
import { haptics } from "../services/haptics";

function Bar({ h, color, delay }: { h: number; color: string; delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = 0;
    v.value = withDelay(delay, withTiming(h, { duration: 480, easing: Easing.out(Easing.cubic) }));
  }, [h, delay]);
  const st = useAnimatedStyle(() => ({ height: v.value }));
  return <Animated.View style={[{ width: "100%", borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: color }, st]} />;
}

// Нагрузка по дням: столбец — сколько минут просят карточки, черта — дневной
// лимит, часть над лимитом — красная (это и есть будущий долг). Второй ряд
// (если передан) — сравнение "если" тонкими столбиками поверх. Тап — день.
export function LoadChart({ demand, compare, budget, compareBudget, selected, onSelect, height = 130 }: { demand: number[]; compare?: number[]; budget: number; compareBudget?: number; selected: number | null; onSelect: (d: number | null) => void; height?: number }) {
  const t = useTheme();
  const max = Math.max(budget * 1.4, ...demand, ...(compare ?? []));
  const y = (m: number) => (m / max) * height;
  return (
    <View>
      <View style={{ height, flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: y(budget), borderTopWidth: 1.5, borderStyle: "dashed", borderColor: t.colors.ink, zIndex: 2 }} />
        {compareBudget !== undefined && compareBudget !== budget ? <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: y(compareBudget), borderTopWidth: 2, borderStyle: "dashed", borderColor: t.colors.close, zIndex: 2 }} /> : null}
        {demand.map((m, i) => {
          const over = Math.max(0, m - budget);
          return (
            <Pressable
              key={i}
              accessibilityLabel={`day ${i + 1}`}
              onPress={() => {
                haptics.tick();
                onSelect(selected === i ? null : i);
              }}
              style={{ flex: 1, height, justifyContent: "flex-end", opacity: selected !== null && selected !== i ? 0.4 : 1 }}
            >
              {over > 0 ? <Bar h={y(over)} color={t.colors.accent} delay={i * 15} /> : null}
              <Bar h={Math.max(2, y(Math.min(m, budget)))} color={t.colors.inkMuted} delay={i * 15} />
              {compare ? <View style={{ position: "absolute", left: "30%", right: "30%", bottom: 0, height: Math.max(2, y(compare[i])), backgroundColor: t.colors.marker, borderRadius: 2 }} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={{ fontSize: 10, color: t.colors.inkFaint }}>today</Text>
        <Text style={{ fontSize: 10, color: t.colors.inkFaint }}>— {budget} min a day</Text>
        <Text style={{ fontSize: 10, color: t.colors.inkFaint }}>day {demand.length}</Text>
      </View>
    </View>
  );
}
