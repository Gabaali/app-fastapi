"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api";
import {
  createClient,
} from "@/lib/supabase/client";

import styles from "./Cartedex.module.css";
import {
  getRiftboundBaseRarity,
  getRiftboundDropLabel,
  isSpecialRiftboundEdition,
} from "@/lib/riftbound-card-display";

type Game =
  | "onepiece"
  | "pokemon"
  | "riftbound"
  | "flags"
  | "movies";

type SetSummary = {
  set_code: string;
  set_name: string;
  card_count: number | null;
};

type CartedexCard = {
  card_key: string;
  game: Game;
  product_set: string;
  card_number: string;
  name: string;
  rarity: string;
  variant: string;
  drop_class: string;
  image_url: string | null;

  owned: boolean;
  quantity: number;

  first_obtained_at:
    | string
    | null;

  last_obtained_at:
    | string
    | null;
};

type CartedexResponse = {
  game: Game;
  set_code: string;
  owned_cards: number;
  total_cards: number;
  completion_percent: number;
  cards: CartedexCard[];
};


const GAME_LABELS:
  Record<Game, string> = {
    onepiece: "One Piece",
    pokemon: "Pokémon",
    riftbound: "Riftbound",
    flags: "Drapeaux du monde",
    movies: "Cinéma",
  };


function cardRarityLabel(
  card: CartedexCard,
) {
  if (card.game === "riftbound") {
    return (
      getRiftboundBaseRarity(card)
      || card.rarity
      || "Rareté inconnue"
    );
  }

  return (
    String(card.rarity ?? "").trim()
    || "Rareté inconnue"
  );
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").trim();
}

function FlagThumb({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [ratio, setRatio] =
    useState<number>(1.5);

  return (
    <div
      className={styles.flagThumb}
      style={{
        aspectRatio: String(ratio),
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        onLoad={(event) => {
          const img =
            event.currentTarget;

          const rawRatio =
            (img.naturalWidth || 3) /
            (img.naturalHeight || 2);

          const clampedRatio =
            Math.max(
              0.8,
              Math.min(2.2, rawRatio)
            );

          setRatio(clampedRatio);
        }}
      />
    </div>
  );
}
function cardEditionLabel(
  card: CartedexCard,
) {
  if (
    card.game !== "riftbound"
    || !isSpecialRiftboundEdition(card)
  ) {
    return "";
  }

  return (
    getRiftboundDropLabel(card)
    || ""
  );
}


function cardCompactLabel(
  card: CartedexCard,
) {
  return [
    cardRarityLabel(card),
    cardEditionLabel(card),
  ]
    .map((value) =>
      String(value ?? "").trim()
    )
    .filter(Boolean)
    .join(" · ");
}


function cardSubtitle(
  card: CartedexCard,
) {
  const specialRiftboundEdition =
    card.game === "riftbound"
    && isSpecialRiftboundEdition(card);

  /*
   * Pour Riftbound, drop_class est maintenant
   * la source de vérité pour les éditions
   * spéciales.
   *
   * On évite donc d'afficher un ancien
   * card.variant contradictoire ou redondant.
   */
  const variant =
    specialRiftboundEdition
      ? ""
      : card.variant;

  const values = [
    card.card_number,
    cardRarityLabel(card),
    cardEditionLabel(card),
    variant,
  ]
    .map((value) =>
      String(value ?? "").trim()
    )
    .filter(Boolean);

  /*
   * Suppression des doublons sans tenir
   * compte des majuscules/minuscules.
   */
  const seen =
    new Set<string>();

  return values
    .filter((value) => {
      const key =
        value.toLocaleLowerCase("fr");

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .join(" · ");
}


export default function CartedexPage() {
  const router = useRouter();

  const supabase =
    createClient();

  const [game, setGame] =
    useState<Game>("onepiece");

  const [sets, setSets] =
    useState<SetSummary[]>([]);

  const [setCode, setSetCode] =
    useState("");

  const [cartedex, setCartedex] =
    useState<CartedexResponse | null>(
      null
    );

  const [loadingSets, setLoadingSets] =
    useState(false);

  const [loadingCards, setLoadingCards] =
    useState(false);

  const [error, setError] =
    useState("");
  const [search, setSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [favoritesReady, setFavoritesReady] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [favoriteError, setFavoriteError] = useState("");

  const rarityOptions = useMemo(() => [...new Set(
    (cartedex?.cards ?? []).map(cardRarityLabel)
  )].sort((a, b) => a.localeCompare(b, "fr")), [cartedex]);
  const visibleCards = useMemo(() => (cartedex?.cards ?? []).filter((card) =>
    normalizeSearch(card.name).includes(normalizeSearch(search))
    && (!rarityFilter || cardRarityLabel(card) === rarityFilter)
    && (!favoritesOnly || favorites.has(card.card_key))
  ), [cartedex, search, rarityFilter, favoritesOnly, favorites]);

  useEffect(() => {
    setRarityFilter("");
  }, [game, setCode]);

  async function toggleFavorite(card: CartedexCard) {
    if (!userId || !favoritesReady || savingFavorite) return;
    setSavingFavorite(true);
    setFavoriteError("");
    const removing = favorites.has(card.card_key);
    try {
      const { error: saveError } = removing
        ? await supabase.from("user_favorites").delete().eq("user_id", userId).eq("card_key", card.card_key)
        : await supabase.from("user_favorites").upsert(
          { user_id: userId, card_key: card.card_key },
          { onConflict: "user_id,card_key", ignoreDuplicates: true }
        );
      if (saveError) throw saveError;
      setFavorites((previous) => {
        const next = new Set(previous);
        if (removing) next.delete(card.card_key);
        else next.add(card.card_key);
        return next;
      });
    } catch {
      setFavoriteError("Impossible de sauvegarder le favori. Réessaie dans un instant.");
    } finally {
      setSavingFavorite(false);
    }
  }

  const selectedSet =
    useMemo(
      () =>
        sets.find(
          (item) =>
            item.set_code
            === setCode
        ),
      [sets, setCode]
    );

  useEffect(() => {
    let cancelled = false;
    async function checkAuth() {
      const {
        data: { user },
      } =
        await supabase.auth
          .getUser();

      if (!user) {
        router.replace("/login");
        return;
      }
      if (cancelled) return;
      setUserId(user.id);
      try {
        const { data, error: loadError } = await supabase.from("user_favorites")
          .select("card_key").eq("user_id", user.id);
        if (loadError) throw loadError;
        if (cancelled) return;
        setFavorites(new Set((data ?? []).map((item: { card_key: string }) => item.card_key)));
        setFavoritesReady(true);
      } catch {
        if (!cancelled) setFavoriteError("Les favoris sont indisponibles. Leur stockage Supabase doit être configuré, puis la page rechargée.");
      }
    }

    checkAuth();
    return () => { cancelled = true; };
  }, [router, supabase]);

  useEffect(() => {
    async function loadSets() {
      setLoadingSets(true);
      setError("");
      setCartedex(null);

      try {
        const response =
          await apiFetch<
            SetSummary[]
          >(
            `/api/catalog/${game}/sets`
          );

        setSets(response);

        setSetCode(
          response[0]?.set_code
          ?? ""
        );
      } catch (err) {
        setSets([]);
        setSetCode("");

        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger les extensions."
        );
      } finally {
        setLoadingSets(false);
      }
    }

    loadSets();
  }, [game]);

  useEffect(() => {
    if (!setCode) {
      setCartedex(null);
      return;
    }

    async function loadCartedex() {
      setLoadingCards(true);
      setError("");

      try {
        const response =
          await apiFetch<
            CartedexResponse
          >(
            `/api/cartedex/${game}/${encodeURIComponent(
              setCode
            )}`
          );

        setCartedex(response);
      } catch (err) {
        setCartedex(null);

        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger le Cartédex."
        );
      } finally {
        setLoadingCards(false);
      }
    }

    loadCartedex();
  }, [game, setCode]);

  return (
    <main className={styles.page}>
      <header
        className={styles.topbar}
      >
        <div>
          <span
            className={
              styles.eyebrow
            }
          >
            COLLECTION
          </span>

          <strong>
            Cartédex
          </strong>
        </div>

        <div className={styles.navActions}>
          <button
            type="button"
            className={
              styles.boosterButton
            }
            onClick={() =>
              router.push("/quiz")
            }
          >
            Quiz Lore
          </button>

          <button
            type="button"
            className={
              styles.boosterButton
            }
            onClick={() =>
              router.push("/booster")
            }
          >
            Ouvrir un booster
          </button>
        </div>
      </header>

      <section
        className={styles.hero}
      >
        <span
          className={styles.eyebrow}
        >
          TA COLLECTION
        </span>

        <h1>
          Complète ton Cartédex.
        </h1>

        <p>
          Les cartes obtenues sont
          révélées. Les cartes encore
          manquantes restent masquées.
        </p>
      </section>

      <section
        className={styles.controls}
      >
        <label>
          Jeu

          <select
            value={game}
            onChange={(event) =>
              setGame(
                event.target
                  .value as Game
              )
            }
          >
            {Object.entries(
              GAME_LABELS
            ).map(
              ([value, label]) => (
                <option
                  key={value}
                  value={value}
                >
                  {label}
                </option>
              )
            )}
          </select>
        </label>

        <label>
          Extension

          <select
            value={setCode}
            disabled={
              loadingSets
              || sets.length === 0
            }
            onChange={(event) =>
              setSetCode(
                event.target.value
              )
            }
          >
            {sets.map((set) => (
              <option
                key={set.set_code}
                value={set.set_code}
              >
                {set.set_code}
                {" — "}
                {set.set_name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className={styles.filters} aria-label="Recherche et filtres du Cartédex">
        <label>
          Rechercher par nom
          <input type="search" value={search} placeholder="Nom d’une carte ou d’un film…"
            onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label>
          Rareté
          <select value={rarityFilter} onChange={(event) => setRarityFilter(event.target.value)}>
            <option value="">Toutes les raretés</option>
            {rarityOptions.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
          </select>
        </label>
        <label className={styles.favoriteFilter}>
          <input type="checkbox" checked={favoritesOnly} disabled={!favoritesReady}
            onChange={(event) => setFavoritesOnly(event.target.checked)} />
          Favoris uniquement
        </label>
        <button type="button" className={styles.boosterButton} onClick={() => {
          setSearch(""); setRarityFilter(""); setFavoritesOnly(false);
        }}>Réinitialiser</button>
      </section>
      {favoriteError ? <p className={styles.error} role="alert">{favoriteError}</p> : null}

      {error ? (
        <div
          className={styles.error}
        >
          {error}
        </div>
      ) : null}

      {cartedex ? (
        <>
          <section
            className={
              styles.progressPanel
            }
          >
            <div
              className={
                styles.progressHeader
              }
            >
              <div>
                <span>
                  {GAME_LABELS[game]}
                </span>

                <strong>
                  {selectedSet
                    ?.set_name
                    ?? setCode}
                </strong>
              </div>

              <div
                className={
                  styles.progressValue
                }
              >
                <strong>
                  {
                    cartedex.owned_cards
                  }
                  /
                  {
                    cartedex.total_cards
                  }
                </strong>

                <span>
                  {
                    cartedex
                      .completion_percent
                  }
                  %
                </span>
              </div>
            </div>

            <div
              className={
                styles.progressTrack
              }
            >
              <div
                className={
                  styles.progressFill
                }
                style={{
                  width:
                    `${cartedex.completion_percent}%`,
                }}
              />
            </div>
          </section>

          <section
            className={styles.grid}
          >
            {visibleCards.map(
              (card) => (
                <article
                  className={`${styles.card} ${
                    card.owned
                      ? styles.owned
                      : styles.missing
                  }`}
                  key={card.card_key}
                >
                  <div
                    className={
                      styles.imageWrap
                    }
                  >
                    {card.owned
                    && card.image_url ? (

                      card.game === "flags" ? (

                        <FlagThumb
                          src={card.image_url}
                          alt={card.name}
                        />

                      ) : (

                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={card.image_url}
                          alt={card.name}
                          draggable={false}
                        />

                      )

                    ) : (
                      <div
                        className={
                          styles.missingFace
                        }
                      >
                        <span
                          className={
                            styles.question
                          }
                        >
                          ?
                        </span>

                        <div
                          className={
                            styles.missingInfo
                          }
                        >
                          <strong>
                            {card.name}
                          </strong>

                          <span>
                            {cardCompactLabel(card)}
                          </span>
                        </div>
                      </div>
                    )}

                    {card.owned
                    && card.quantity > 1 ? (
                      <span
                        className={
                          styles.quantity
                        }
                      >
                        ×{card.quantity}
                      </span>
                    ) : null}
                  </div>

                  <button type="button" className={styles.favoriteButton}
                    aria-pressed={favorites.has(card.card_key)}
                    aria-label={`${favorites.has(card.card_key) ? "Retirer des" : "Ajouter aux"} favoris : ${card.name}`}
                    disabled={!favoritesReady || savingFavorite}
                    onClick={() => toggleFavorite(card)}>
                    {favorites.has(card.card_key) ? "★ Favori" : "☆ Ajouter aux favoris"}
                  </button>
                  <div
                    className={
                      styles.cardBody
                    }
                  >
                    <strong>
                      {card.name}
                    </strong>

                    <span>
                      {cardSubtitle(
                        card
                      )}
                    </span>

                    <small>
                      {card.owned
                        ? "Obtenue"
                        : "À obtenir"}
                    </small>
                  </div>
                </article>
              )
            )}
          </section>
          <p className={styles.resultCount} role="status">
            {visibleCards.length} / {cartedex.cards.length} cartes affichées dans cette extension.
            {visibleCards.length === 0 ? " Aucune carte ne correspond à tes filtres." : ""}
          </p>
        </>
      ) : loadingCards ? (
        <div
          className={styles.loading}
        >
          Chargement du Cartédex...
        </div>
      ) : null}
    </main>
  );
}
