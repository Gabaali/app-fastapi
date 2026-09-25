const MEDIA_BASE = (
  process.env
    .NEXT_PUBLIC_MEDIA_BASE_URL
  ?? ""
).replace(/\/+$/, "");


export function getCardBack(
  game?: string
) {
  if (!game || !MEDIA_BASE) {
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
  if (
    !game
    || !setCode
    || !MEDIA_BASE
  ) {
    return null;
  }

  return (
    `${MEDIA_BASE}/ui/boosters/`
    + `${game}/`
    + `${encodeURIComponent(setCode)}.webp`
  );
}