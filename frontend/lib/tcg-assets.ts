const MEDIA_BASE = (
  process.env
    .NEXT_PUBLIC_MEDIA_BASE_URL
  ?? ""
).replace(/\/+$/, "");

const FLAGS_CARD_BACK = (
  process.env.NEXT_PUBLIC_FLAGS_CARD_BACK_URL
  ?? ""
).trim();

const FLAGS_BOOSTER_IMAGE = (
  process.env.NEXT_PUBLIC_FLAGS_BOOSTER_IMAGE_URL
  ?? ""
).trim();


export function getCardBack(
  game?: string
) {
  if (!game) {
    return null;
  }

  if (game === "flags") {
    return FLAGS_CARD_BACK || null;
  }

  if (!MEDIA_BASE) {
    return null;
  }

  return (
    `${MEDIA_BASE}/ui/card-backs/`
    + `${game}.webp`
  );
}


export function getBoosterImage(
  game?: string,
  setCode?: string
) {
  if (!game || !setCode) {
    return null;
  }

  if (game === "flags") {
    return FLAGS_BOOSTER_IMAGE || null;
  }

  if (!MEDIA_BASE) {
    return null;
  }

  return (
    `${MEDIA_BASE}/ui/boosters/`
    + `${game}/`
    + `${encodeURIComponent(setCode)}.webp`
  );
}