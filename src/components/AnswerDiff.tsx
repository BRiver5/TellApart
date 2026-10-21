import { Text, View } from "react-native";
import { useTheme } from "../theme";

// Посимвольное сравнение введённого ответа с правильным: совпавшие буквы —
// обычные, лишние — зачёркнуты красным, пропущенные — подчёркнуты зелёным.
// Выравнивание — по таблице расстояния Левенштейна (обратный проход).
type Op = { ch: string; kind: "same" | "extra" | "missing" | "swap" };

export function diffOps(a: string, b: string): Op[] {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1));
  const ops: Op[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1)) {
      ops.push(a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? { ch: b[j - 1], kind: "same" } : { ch: b[j - 1], kind: "swap" });
      i--;
      j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      ops.push({ ch: a[i - 1], kind: "extra" });
      i--;
    } else {
      ops.push({ ch: b[j - 1], kind: "missing" });
      j--;
    }
  }
  return ops.reverse();
}

export function AnswerDiff({ typed, correct }: { typed: string; correct: string }) {
  const t = useTheme();
  const ops = diffOps(typed.trim(), correct);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {ops.map((o, k) => (
        <Text
          key={k}
          style={{
            fontSize: 22,
            fontWeight: "700",
            color: o.kind === "same" ? t.colors.ink : o.kind === "extra" ? t.colors.accent : t.colors.right,
            textDecorationLine: o.kind === "extra" ? "line-through" : o.kind === "same" ? "none" : "underline",
            backgroundColor: o.kind === "missing" || o.kind === "swap" ? t.colors.rightSoft : "transparent",
          }}
        >
          {o.ch === " " ? " " : o.ch}
        </Text>
      ))}
    </View>
  );
}
