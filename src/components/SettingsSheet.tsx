import { Alert, Text, View } from "react-native";
import { useTheme } from "../theme";
import { Sheet } from "./Sheet";
import { Stepper } from "./Bits";
import { Toggle } from "./Toggle";
import { PressableScale } from "./PressableScale";
import type { Settings } from "../store/appStore";

// Настройки — шторкой с главного экрана, а не отдельным экраном.
export function SettingsSheet({ visible, onClose, settings, onChange, onWipe }: { visible: boolean; onClose: () => void; settings: Settings; onChange: (p: Partial<Settings>) => void; onWipe: () => void }) {
  const t = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title="Settings" subtitle="Everything stays on this phone.">
      <Row label="Daily study time" hint="The session is packed to fit it." right={<Stepper value={settings.budgetMin} min={3} max={90} step={1} onChange={(budgetMin) => onChange({ budgetMin })} format={(v) => `${v}m`} />} />
      <Row label="Target recall" hint="A card is due when its odds fall below this." right={<Stepper value={Math.round(settings.target * 100)} min={70} max={97} step={1} onChange={(v) => onChange({ target: v / 100 })} format={(v) => `${v}%`} />} />
      <Row label="New cards a day" right={<Stepper value={settings.newPerDay} min={0} max={50} step={1} onChange={(newPerDay) => onChange({ newPerDay })} />} />
      <Row label="Contrast mix-ups" hint="Put cards you confuse right next to each other." right={<Toggle value={settings.contrast} onValueChange={(contrast) => onChange({ contrast })} />} />
      <Row label="Vibration" right={<Toggle value={settings.haptics} onValueChange={(haptics) => onChange({ haptics })} />} />
      <PressableScale
        onPress={() =>
          Alert.alert("Erase everything?", "All cards, answers, mix-ups and what the model learned will be deleted.", [
            { text: "Cancel", style: "cancel" },
            { text: "Erase", style: "destructive", onPress: onWipe },
          ])
        }
        style={{ paddingVertical: 12 }}
      >
        <Text style={{ ...t.typography.body, color: t.colors.danger, fontWeight: "600" }}>Erase all data</Text>
      </PressableScale>
    </Sheet>
  );
}

function Row({ label, hint, right }: { label: string; hint?: string; right: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ ...t.typography.body, color: t.colors.ink }}>{label}</Text>
        {hint ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{hint}</Text> : null}
      </View>
      {right}
    </View>
  );
}
