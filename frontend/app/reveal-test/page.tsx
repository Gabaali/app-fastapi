"use client";

import { useState } from "react";
import BoosterRevealModal from "@/components/booster/BoosterRevealModal";
import type { RevealCard } from "@/lib/reveal-effects";

const testPacks: Record<string, RevealCard[]> = {
  onepiece: [
    { game: "onepiece", name: "Common Test", rarity: "Common" },
    { game: "onepiece", name: "Rare Test", rarity: "Rare" },
    { game: "onepiece", name: "Super Rare Test", rarity: "SR" },
    { game: "onepiece", name: "Alt Art Test", rarity: "Alt Art" },
    { game: "onepiece", name: "Manga Test", rarity: "Manga" },
  ],
  pokemon: [
    { game: "pokemon", name: "Common Test", rarity: "Common" },
    { game: "pokemon", name: "Reverse Test", rarity: "Reverse" },
    { game: "pokemon", name: "Double Rare Test", rarity: "Double Rare" },
    { game: "pokemon", name: "Illustration Rare Test", rarity: "Illustration Rare" },
    { game: "pokemon", name: "Special Illustration Test", rarity: "Special Illustration Rare" },
    { game: "pokemon", name: "Mega Hyper Test", rarity: "Mega Hyper Rare" },
  ],
  riftbound: [
    { game: "riftbound", name: "Common Test", rarity: "Common" },
    { game: "riftbound", name: "Foil Test", rarity: "Foil" },
    { game: "riftbound", name: "Epic Test", rarity: "Epic" },
    { game: "riftbound", name: "Alt Art Test", rarity: "Alt Art" },
    { game: "riftbound", name: "Overnumbered Test", rarity: "Overnumber" },
    { game: "riftbound", name: "Ultimate Test", rarity: "Ultimate" },
  ],
};

export default function RevealTestPage() {
  const [open, setOpen] = useState(false);
  const [pack, setPack] = useState<RevealCard[]>(testPacks.riftbound);
  const [setCode, setSetCode] = useState("DEV");

  if (process.env.NODE_ENV !== "development") {
    return (
      <main style={{ padding: 40 }}>
        <h1>Page de test désactivée</h1>
        <p>Cette page n'est disponible qu'en développement local.</p>
      </main>
    );
  }

  const launch = (key: keyof typeof testPacks) => {
    setPack(testPacks[key]);
    setSetCode(key === "onepiece" ? "OP-DEV" : key === "pokemon" ? "PKM-DEV" : "RFT-DEV");
    setOpen(true);
  };

  return (
    <main style={{ padding: 40, minHeight: "100vh" }}>
      <h1>Test local — Booster Reveal</h1>
      <p>Cette page ne dépense aucune pièce et n'appelle pas le backend.</p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
        <button onClick={() => launch("onepiece")}>Tester One Piece</button>
        <button onClick={() => launch("pokemon")}>Tester Pokémon</button>
        <button onClick={() => launch("riftbound")}>Tester Riftbound</button>
      </div>

      <BoosterRevealModal
        open={open}
        cards={pack}
        setCode={setCode}
        onClose={() => setOpen(false)}
      />
    </main>
  );
}
