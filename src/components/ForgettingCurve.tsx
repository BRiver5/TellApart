import { useEffect, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme";
import { haptics } from "../services/haptics";

// Кривая забывания карточки на N дней вперёд: p(t) = 2^(−t/h) от последнего
// ответа, черта цели, точка "сейчас" и момент, когда карточка просядет.
// Палец по графику — вероятность вспомнить в любой день.
export function ForgettingCurve({ h, sinceDays, target, days = 30, height = 150 }: { h: number; sinceDays: number; target: number; days?: number; height?: number }) {
  const t = useTheme();
  const [w, setW] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const cover = useSharedValue(1);
  useEffect(() => {
    cover.value = 1;
    cover.value = withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [h]);
  const coverStyle = useAnimatedStyle(() => ({ width: `${cover.value * 100}%` }));
  const p = (d: number) => Math.pow(2, -(sinceDays + d) / h);
  const X = (d: number) => (d / days) * w;
  const Y = (v: number) => 6 + (1 - v) * (height - 12);
  const pts = Array.from({ length: 61 }, (_, i) => (i / 60) * days);
  const path = pts.map((d, i) => `${i ? "L" : "M"}${X(d).toFixed(1)},${Y(p(d)).toFixed(1)}`).join(" ");
  const dueIn = Math.max(0, h * Math.log2(1 / target) - sinceDays);
  const onScrub = (x: number) => {
    const d = Math.round((Math.max(0, Math.min(w, x)) / Math.max(1, w)) * days);
    if (d !== scrub) {
      haptics.tick();
      setScrub(d);
    }
  };
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => runOnJS(onScrub)(e.x))
    .onUpdate((e) => runOnJS(onScrub)(e.x))
    .onFinalize(() => runOnJS(setScrub)(null));
  const shown = scrub ?? 0;
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{scrub === null ? "Now" : scrub === 0 ? "Today" : `In ${scrub} ${scrub === 1 ? "day" : "days"}`}</Text>
        <Text style={{ ...t.typography.label, color: p(shown) >= target ? t.colors.right : t.colors.accent }}>{Math.round(p(shown) * 100)}% recall</Text>
      </View>
      <GestureDetector gesture={pan}>
        <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ height }}>
          {w > 0 ? (
            <Svg width={w} height={height}>
              <Rect x={0} y={Y(target)} width={w} height={height - Y(target)} fill={t.colors.accentSoft} opacity={0.5} />
              <Line x1={0} x2={w} y1={Y(target)} y2={Y(target)} stroke={t.colors.accent} strokeDasharray="4 5" />
              {dueIn <= days ? <Line x1={X(dueIn)} x2={X(dueIn)} y1={4} y2={height} stroke={t.colors.inkFaint} strokeDasharray="2 4" /> : null}
              <Path d={path} stroke={t.colors.ink} strokeWidth={2.5} fill="none" />
              <Circle cx={X(shown)} cy={Y(p(shown))} r={6} fill={t.colors.surface} stroke={t.colors.accent} strokeWidth={3} />
            </Svg>
          ) : null}
          <Animated.View pointerEvents="none" style={[{ position: "absolute", right: 0, top: 0, bottom: 0, backgroundColor: t.colors.surface }, coverStyle]} />
        </View>
      </GestureDetector>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={{ fontSize: 10, color: t.colors.inkFaint }}>today</Text>
        <Text style={{ fontSize: 10, color: t.colors.inkFaint }}>{dueIn <= days ? `slips below target in ${dueIn < 1 ? "<1" : Math.round(dueIn)} d` : `holds past ${days} d`}</Text>
        <Text style={{ fontSize: 10, color: t.colors.inkFaint }}>{days} d</Text>
      </View>
    </View>
  );
}
