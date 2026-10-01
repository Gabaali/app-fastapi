"use client";

import { useState } from "react";
import BoosterRevealModal from "@/components/booster/BoosterRevealModal";
import type { RevealCard } from "@/lib/reveal-effects";

// Affiches de démonstration locales : le test fonctionne sans backend ni réseau.
function movieFixture(name: string, director: string, year: string, rarity: string, color: string): RevealCard {
  const poster = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><defs><radialGradient id="sky"><stop stop-color="${color}"/><stop offset="1" stop-color="#080c18"/></radialGradient></defs><rect width="600" height="900" fill="url(#sky)"/><circle cx="300" cy="360" r="155" fill="none" stroke="#ffe3a0" stroke-width="2"/><circle cx="300" cy="360" r="110" fill="none" stroke="#ffe3a0" opacity=".3"/><text x="300" y="120" text-anchor="middle" fill="#ffe3a0" font-family="sans-serif" font-size="18" letter-spacing="5">CINÉMA · TEST</text><foreignObject x="40" y="610" width="520" height="200"><div xmlns="http://www.w3.org/1999/xhtml" style="text-align:center;color:#fff2d0;font: bold 48px Georgia">${name}</div></foreignObject><text x="300" y="850" text-anchor="middle" fill="#ffe3a0" font-family="sans-serif" font-size="24">${year}</text></svg>`;
  return {
    game: "movies",
    card_key: `movie-test-${rarity}`,
    name,
    rarity,
    image_url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(poster)}`,
    is_new: true,
    metadata: { director, year, synopsis: "Film de démonstration pour tester les animations de révélation.", awards_json: "[]" },
  };
}

const testPacks: Record<string, RevealCard[]> = {
  movies: [
    movieFixture("Film commun", "Agnès Varda", "1962", "Commun", "#436c85"),
    movieFixture("Film rare", "Wes Anderson", "2014", "Rare", "#825187"),
    movieFixture("Film épique", "Denis Villeneuve", "2021", "Épique", "#976a37"),
    movieFixture("Film mythique", "Hayao Miyazaki", "2001", "Mythique", "#437d66"),
    movieFixture("Interstellar", "Christopher Nolan", "2014", "Légendaire", "#ba903e"),
    movieFixture("Le Parrain", "Francis Ford Coppola", "1972", "Légendaire ALT", "#934c36"),
    movieFixture("Jurassic Park", "Steven Spielberg", "1993", "Légendaire SHOWCASE", "#376b50"),
  ],
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
    setSetCode(key === "movies" ? "MOVIES-DEV" : key === "onepiece" ? "OP-DEV" : key === "pokemon" ? "PKM-DEV" : "RFT-DEV");
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
        <button onClick={() => launch("movies")}>Tester Films</button>
      </div>
      <p>Le booster Films contient quatre raretés classiques et trois légendaires (base, ALT et SHOWCASE), avec des affiches de démonstration.</p>

      <BoosterRevealModal
        open={open}
        cards={pack}
        setCode={setCode}
        onClose={() => setOpen(false)}
      />
    </main>
  );
}
