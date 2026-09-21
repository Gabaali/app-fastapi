export type GameKey = "onepiece" | "pokemon" | "riftbound";

export type RevealCard = {
  card_key?: string;
  source_id?: string | number;
  game: GameKey;
  name: string;
  image?: string | null;
  image_url?: string | null;
  rarity?: string | null;
  variant?: string | null;
  drop_class?: string | null;
  _slot?: string | null;
  _treatment?: string | null;
  card_number?: string | null;
  collectible?: boolean;
  is_new?: boolean;
};

export type RevealTier = "basic" | "rare" | "premium" | "chase";

export type RevealProfile = {
  name: string;
  tier: RevealTier;
  label: string;
  primary: string;
  secondary: string;
  accent: string;
  rank: number;
  durationMs: number;
  suspenseMs: number;
  particles: number;
  flash: boolean;
  shockwave: boolean;
  holo: boolean;
  impactLevel: 0 | 1 | 2 | 3 | 4 | 5;
};

function cleanText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function cardText(card: RevealCard) {
  return cleanText(
    [
      card.rarity,
      card.variant,
      card.drop_class,
      card._slot,
      card._treatment,
    ].join(" ")
  );
}

export function rarityRank(card: RevealCard): number {
  const game = card.game;
  const text = cardText(card);

  if (game === "onepiece") {
    if (text.includes("manga") || text.includes("comic")) return 100;
    if (text.includes("signature") || text.includes("super alt")) return 95;
    if (text.includes("treasure")) return 90;
    if (/(^|\s)sp($|\s)/.test(text) || text.includes(" sp ")) return 85;
    if (text.includes("alt") || text.includes("parallel")) return 80;
    if (text.includes("sec")) return 70;
    if (text.includes("sr")) return 60;
    if (text.includes("rare") || /\br\b/.test(text)) return 50;
    if (text.includes("don")) return 30;
    if (text.includes("uncommon") || text.includes("uc")) return 20;
    return 10;
  }

  if (game === "pokemon") {
    const order: Array<[string, number]> = [
      ["mega hyper", 100],
      ["special illustration", 95],
      ["black white", 94],
      ["hyper rare", 90],
      ["mega attack", 88],
      ["ultra rare", 85],
      ["illustration rare", 80],
      ["shiny ultra", 78],
      ["shiny rare", 76],
      ["double rare", 70],
      ["master ball", 65],
      ["ace spec", 62],
      ["rare", 55],
      ["reverse", 40],
      ["uncommon", 20],
      ["common", 10],
      ["energie", 0],
      ["energy", 0],
    ];

    for (const [needle, rank] of order) {
      if (text.includes(needle)) return rank;
    }
    return 30;
  }

  const order: Array<[string, number]> = [
    ["ultimate", 100],
    ["signature", 95],
    ["overnumber", 90],
    ["special alt", 87],
    ["alt", 85],
    ["showcase", 84],
    ["epic", 70],
    ["rare", 55],
    ["foil", 40],
    ["uncommon", 20],
    ["common", 10],
    ["token", 0],
    ["rune", 0],
  ];

  for (const [needle, rank] of order) {
    if (text.includes(needle)) return rank;
  }
  return 30;
}

export function sortCardsForReveal(cards: RevealCard[]) {
  return [...cards].sort((a, b) => rarityRank(a) - rarityRank(b));
}

function baseProfile(card: RevealCard) {
  const game = card.game;
  const text = cardText(card);
  const rank = rarityRank(card);

  if (rank <= 20) {
    return {
      name: "none",
      label: "",
      primary: "#8d99ae",
      secondary: "#adb5bd",
      accent: "#ffffff",
      baseDuration: 620,
      flash: false,
    };
  }

  if (game === "onepiece") {
    if (text.includes("manga") || text.includes("comic")) {
      return { name: "manga", label: "MANGA", primary: "#ff2d2d", secondary: "#101010", accent: "#ffd166", baseDuration: 1500, flash: true };
    }
    if (text.includes("signature") || text.includes("super alt")) {
      return { name: "legendary", label: "SIGNATURE", primary: "#ffd166", secondary: "#ff4d8d", accent: "#ffffff", baseDuration: 1420, flash: true };
    }
    if (text.includes("treasure")) {
      return { name: "emerald", label: "TREASURE", primary: "#1dd3b0", secondary: "#ffd166", accent: "#ffffff", baseDuration: 1350, flash: true };
    }
    if (/(^|\s)sp($|\s)/.test(text) || text.includes(" sp ")) {
      return { name: "prism", label: "SPECIAL", primary: "#ff4fd8", secondary: "#8a5cff", accent: "#7cf7ff", baseDuration: 1280, flash: true };
    }
    if (text.includes("alt") || text.includes("parallel")) {
      return { name: "prism", label: "ALT ART", primary: "#6ee7ff", secondary: "#d96cff", accent: "#ffd166", baseDuration: 1200, flash: false };
    }
    if (text.includes("sec")) {
      return { name: "gold", label: "SECRET", primary: "#ffd166", secondary: "#ff9f1c", accent: "#fff3b0", baseDuration: 1120, flash: false };
    }
    if (text.includes("sr")) {
      return { name: "energy", label: "SUPER RARE", primary: "#41a7ff", secondary: "#6c63ff", accent: "#d9f3ff", baseDuration: 980, flash: false };
    }
    if (text.includes("leader") || /\bl\b/.test(text)) {
      return { name: "energy", label: "LEADER", primary: "#ef476f", secondary: "#7b2cbf", accent: "#ffffff", baseDuration: 920, flash: false };
    }
    if (text.includes("rare") || /\br\b/.test(text)) {
      return { name: "silver", label: "RARE", primary: "#dce6f2", secondary: "#7aa7c7", accent: "#ffffff", baseDuration: 850, flash: false };
    }
    return { name: "soft", label: "", primary: "#ef476f", secondary: "#30343f", accent: "#ffffff", baseDuration: 780, flash: false };
  }

  if (game === "pokemon") {
    if (text.includes("mega hyper")) {
      return { name: "legendary", label: "MEGA HYPER RARE", primary: "#fff4b8", secondary: "#ff5e5b", accent: "#ffffff", baseDuration: 1500, flash: true };
    }
    if (text.includes("special illustration") || text.includes("black white")) {
      return { name: "prism", label: "SPECIAL ILLUSTRATION", primary: "#ff70a6", secondary: "#70d6ff", accent: "#e9ff70", baseDuration: 1400, flash: true };
    }
    if (text.includes("hyper rare")) {
      return { name: "gold", label: "HYPER RARE", primary: "#ffe066", secondary: "#ff9f1c", accent: "#fff7cc", baseDuration: 1320, flash: true };
    }
    if (text.includes("mega attack")) {
      return { name: "manga", label: "MEGA ATTACK", primary: "#ff3b30", secondary: "#ff9f1c", accent: "#ffffff", baseDuration: 1260, flash: true };
    }
    if (text.includes("ultra rare")) {
      return { name: "gold", label: "ULTRA RARE", primary: "#ffd166", secondary: "#f77f00", accent: "#ffffff", baseDuration: 1180, flash: false };
    }
    if (text.includes("illustration rare")) {
      return { name: "prism", label: "ILLUSTRATION RARE", primary: "#7bdff2", secondary: "#b2f7ef", accent: "#f7d6e0", baseDuration: 1120, flash: false };
    }
    if (text.includes("shiny ultra") || text.includes("shiny rare") || text.includes("chromatique")) {
      return { name: "emerald", label: "SHINY", primary: "#72efdd", secondary: "#80ff72", accent: "#ffffff", baseDuration: 1080, flash: false };
    }
    if (text.includes("double rare")) {
      return { name: "energy", label: "DOUBLE RARE", primary: "#55c2ff", secondary: "#7b61ff", accent: "#ffffff", baseDuration: 980, flash: false };
    }
    if (text.includes("master ball")) {
      return { name: "prism", label: "MASTER BALL", primary: "#b5179e", secondary: "#4361ee", accent: "#ffffff", baseDuration: 1020, flash: false };
    }
    if (text.includes("ace spec") || text.includes("as tactique") || text.includes("high tech")) {
      return { name: "neon", label: "ACE SPEC", primary: "#ff2fb3", secondary: "#7b2cff", accent: "#ffffff", baseDuration: 1020, flash: false };
    }
    if (text.includes("rare")) {
      return { name: "silver", label: "RARE", primary: "#dce6f2", secondary: "#5aa9e6", accent: "#ffffff", baseDuration: 850, flash: false };
    }
    if (text.includes("reverse")) {
      return { name: "soft", label: "REVERSE", primary: "#9bf6ff", secondary: "#a0c4ff", accent: "#ffffff", baseDuration: 780, flash: false };
    }
    return { name: "soft", label: "", primary: "#5aa9e6", secondary: "#4361ee", accent: "#ffffff", baseDuration: 760, flash: false };
  }

  if (text.includes("ultimate")) {
    return { name: "legendary", label: "ULTIMATE", primary: "#fff2a8", secondary: "#9d4edd", accent: "#66ffff", baseDuration: 1550, flash: true };
  }
  if (text.includes("signature")) {
    return { name: "manga", label: "SIGNATURE", primary: "#ffbe0b", secondary: "#d00000", accent: "#ffffff", baseDuration: 1450, flash: true };
  }
  if (text.includes("overnumber")) {
    return { name: "gold", label: "OVERNUMBERED", primary: "#ffd166", secondary: "#ff7b00", accent: "#fff3b0", baseDuration: 1360, flash: true };
  }
  if (text.includes("special alt")) {
    return { name: "prism", label: "SPECIAL ALT", primary: "#ff4fd8", secondary: "#00e5ff", accent: "#ffd166", baseDuration: 1300, flash: true };
  }
  if (text.includes("alt") || text.includes("showcase")) {
    return { name: "prism", label: "ALT ART", primary: "#2de2e6", secondary: "#ff49db", accent: "#f9f871", baseDuration: 1200, flash: false };
  }
  if (text.includes("epic")) {
    return { name: "neon", label: "EPIC", primary: "#c77dff", secondary: "#7b2cbf", accent: "#e0aaff", baseDuration: 1050, flash: false };
  }
  if (text.includes("rare")) {
    return { name: "energy", label: "RARE", primary: "#00b4d8", secondary: "#4361ee", accent: "#caf0f8", baseDuration: 880, flash: false };
  }
  if (text.includes("foil")) {
    return { name: "silver", label: "FOIL", primary: "#dff7ff", secondary: "#8ecae6", accent: "#ffffff", baseDuration: 850, flash: false };
  }
  return { name: "soft", label: "", primary: "#00b4d8", secondary: "#4361ee", accent: "#ffffff", baseDuration: 760, flash: false };
}

export function getRevealProfile(card: RevealCard): RevealProfile {
  const rank = rarityRank(card);
  const base = baseProfile(card);
  const rarityLevel = Math.max(0, Math.min(1, (rank - 20) / 80));

  const particles =
    rank <= 20 ? 0 : Math.round(5 + 55 * Math.pow(rarityLevel, 1.35));

  // Durée de rotation choisie pour ton rendu actuel.
  // Common / Uncommon n'utilisent pas cette rotation : elles apparaissent
  // simplement via un fade/zoom dans BoosterRevealModal.
  const scaledDuration =
    rank <= 20
      ? 2000
      : Math.round(2000 + Math.max(0, rank - 30) * 18);

  const durationMs = Math.max(base.baseDuration, scaledDuration);

  const tier: RevealTier =
    rank >= 85 ? "chase" : rank >= 70 ? "premium" : rank >= 40 ? "rare" : "basic";

  // Hiérarchie des impacts visuels déclenchés en fin de retournement.
  // 0 = rien, 1 = onde, 2 = double onde, 3 = énergie,
  // 4 = prisme/rayons, 5 = supernova.
  const impactLevel: 0 | 1 | 2 | 3 | 4 | 5 =
    rank >= 95
      ? 5
      : rank >= 85
        ? 4
        : rank >= 70
          ? 3
          : rank >= 60
            ? 2
            : rank >= 40
              ? 1
              : 0;

  return {
    name: base.name,
    tier,
    label: base.label,
    primary: base.primary,
    secondary: base.secondary,
    accent: base.accent,
    rank,
    durationMs,
    suspenseMs: rank >= 95 ? 650 : rank >= 85 ? 420 : rank >= 70 ? 180 : 0,
    particles,
    flash: base.flash,
    shockwave: rank >= 70,
    holo: rank >= 40,
    impactLevel,
  };
}

export function gameLabel(game: GameKey) {
  if (game === "onepiece") return "ONE PIECE";
  if (game === "pokemon") return "POKÉMON";
  return "RIFTBOUND";
}
