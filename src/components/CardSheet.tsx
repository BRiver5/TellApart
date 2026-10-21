import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useTheme } from "../theme";
import { Field, Sheet, inputStyle } from "./Sheet";
import { Chip } from "./Bits";
import { PrimaryButton } from "./PrimaryButton";
import { SecondaryButton } from "./SecondaryButton";
import { STARTER_DECKS } from "../lib/decks";
import type { Card } from "../lib/types";

// Новая карточка: колода чипом (или новая), лицо, ответ. "Add & next" оставляет
// шторку открытой — карточки обычно вводят пачкой.
export function CardSheet({
  visible,
  onClose,
  decks,
  defaultDeck,
  editing,
  onSave,
  onStarter,
  haveStarter,
}: {
  visible: boolean;
  onClose: () => void;
  decks: string[];
  defaultDeck: string | null;
  editing?: Card | null;
  onSave: (d: { deck: string; front: string; back: string }, keepOpen: boolean) => void;
  onStarter: (i: number) => void;
  haveStarter: string[];
}) {
  const t = useTheme();
  const [deck, setDeck] = useState("");
  const [newDeck, setNewDeck] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [added, setAdded] = useState(0);
  const frontRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    setDeck(editing?.deck ?? defaultDeck ?? decks[0] ?? "My cards");
    setNewDeck(decks.length === 0 && !editing);
    setFront(editing?.front ?? "");
    setBack(editing?.back ?? "");
    setAdded(0);
  }, [visible, editing?.id]);

  const valid = deck.trim() && front.trim() && back.trim();
  const save = (keep: boolean) => {
    onSave({ deck: deck.trim(), front: front.trim(), back: back.trim() }, keep);
    if (keep) {
      setAdded((n) => n + 1);
      setFront("");
      setBack("");
      frontRef.current?.focus();
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={editing ? "Edit card" : "New card"}
      subtitle={added ? `${added} added — keep going` : "Type the answer exactly as you'd want to recall it."}
      footer={
        editing ? (
          <PrimaryButton label="Save card" disabled={!valid} onPress={() => save(false)} />
        ) : (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <SecondaryButton label="Add & done" onPress={() => valid && save(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Add & next" disabled={!valid} onPress={() => save(true)} />
            </View>
          </View>
        )
      }
    >
      {!editing ? (
        <Field label="Or start with a ready deck">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {STARTER_DECKS.map((d, i) => (
              <Chip key={d.name} label={haveStarter.includes(d.name) ? `${d.name} ✓` : `${d.name} · ${d.cards.length}`} active={false} onPress={() => onStarter(i)} />
            ))}
          </ScrollView>
        </Field>
      ) : null}
      <Field label="Deck">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {decks.map((d) => (
            <Chip key={d} label={d} active={!newDeck && deck === d} onPress={() => { setNewDeck(false); setDeck(d); }} />
          ))}
          <Chip label="+ New deck" active={newDeck} onPress={() => { setNewDeck(true); setDeck(""); }} />
        </View>
        {newDeck ? <TextInput value={deck} onChangeText={setDeck} placeholder="Deck name" placeholderTextColor={t.colors.inkFaint} style={[inputStyle(t), { marginTop: 8 }]} maxLength={28} /> : null}
      </Field>
      <Field label="Prompt">
        <TextInput ref={frontRef} value={front} onChangeText={setFront} placeholder="e.g. Slovakia" placeholderTextColor={t.colors.inkFaint} style={inputStyle(t)} maxLength={80} />
      </Field>
      <Field label="Answer" hint="Small typos count as 'close'. Typing another card's answer counts as a mix-up.">
        <TextInput value={back} onChangeText={setBack} placeholder="e.g. Bratislava" placeholderTextColor={t.colors.inkFaint} style={inputStyle(t)} maxLength={80} autoCapitalize="none" />
      </Field>
      {!editing && decks.length === 0 ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>A ready deck is a quick way to see mix-ups being caught.</Text> : null}
    </Sheet>
  );
}
