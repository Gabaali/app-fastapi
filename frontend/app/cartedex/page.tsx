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


type Game =
  | "onepiece"
  | "pokemon"
  | "riftbound";

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
  };


function cardSubtitle(
  card: CartedexCard,
) {
  return [
    card.card_number,
    card.rarity,
    card.variant,
  ]
    .map((value) =>
      String(value ?? "").trim()
    )
    .filter(
      (value, index, values) =>
        value
        && values.indexOf(value)
          === index
    )
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
    async function checkAuth() {
      const {
        data: { user },
      } =
        await supabase.auth
          .getUser();

      if (!user) {
        router.replace("/login");
      }
    }

    checkAuth();
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
            {cartedex.cards.map(
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
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={
                          card.image_url
                        }
                        alt={card.name}
                        draggable={false}
                      />
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
                            {card.rarity
                              || "Rareté inconnue"}
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
