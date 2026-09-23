export type RiftboundDisplayCard = {
  game?: string | null;
  rarity?: string | null;
  drop_class?: string | null;
  variant?: string | null;
};

const DROP_LABELS: Record<string, string> = {
  COMMON_BASE: "Commune",
  UNCOMMON_BASE: "Peu commune",
  RARE_BASE: "Rare",
  EPIC_BASE: "Épique",

  RUNE_TOKEN_BASE: "Rune / Token",
  ALT_RUNE: "Rune alternative",

  ALT_ART: "Illustration alternative",
  OVERNUMBERED: "Overnumbered",
  SIGNATURE_OVERNUMBERED: "Signature Overnumbered",
  SPECIAL_ALT: "Illustration spéciale",
  ULTIMATE: "Ultimate",

  NON_BOOSTER: "Hors booster",
  UNKNOWN_SPECIAL: "Édition spéciale",
};

export function getRiftboundDropLabel(
  card: RiftboundDisplayCard
): string | null {
  if (card.game !== "riftbound") {
    return null;
  }

  const dropTier = String(
    card.drop_class ?? ""
  )
    .trim()
    .toUpperCase();

  if (!dropTier) {
    return null;
  }

  return (
    DROP_LABELS[dropTier] ??
    dropTier
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      )
  );
}

export function getRiftboundBaseRarity(
  card: RiftboundDisplayCard
): string | null {
  if (card.game !== "riftbound") {
    return card.rarity ?? null;
  }

  const tier = String(
    card.drop_class ?? ""
  ).toUpperCase();

  if (tier === "COMMON_BASE") {
    return "Commune";
  }

  if (tier === "UNCOMMON_BASE") {
    return "Peu commune";
  }

  if (tier === "RARE_BASE") {
    return "Rare";
  }

  if (tier === "EPIC_BASE") {
    return "Épique";
  }

  return card.rarity ?? null;
}

export function isSpecialRiftboundEdition(
  card: RiftboundDisplayCard
): boolean {
  const tier = String(
    card.drop_class ?? ""
  ).toUpperCase();

  return [
    "ALT_ART",
    "ALT_RUNE",
    "OVERNUMBERED",
    "SIGNATURE_OVERNUMBERED",
    "SPECIAL_ALT",
    "ULTIMATE",
  ].includes(tier);
}