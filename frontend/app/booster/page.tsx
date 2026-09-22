"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import BoosterRevealModal
  from "@/components/booster/BoosterRevealModal";

import BoosterPackPreview
  from "@/components/booster/BoosterPackPreview";

import SetCollectionProgress
  from "@/components/booster/SetCollectionProgress";

import {
  apiFetch,
} from "@/lib/api";

import {
  createClient,
} from "@/lib/supabase/client";

import type {
  RevealCard,
} from "@/lib/reveal-effects";


type Game =
  | "onepiece"
  | "pokemon"
  | "riftbound";


type SetSummary = {
  set_code: string;
  set_name: string;
  card_count: number | null;
};


type Card = {
  card_key: string;
  game: Game;
  product_set: string;
  card_number: string;
  name: string;
  rarity: string;
  variant: string;
  drop_class: string;
  image_url: string | null;
  collectible: boolean;
  slot: string | null;
  is_new?: boolean;
};


type Wallet = {
  balance_coins: number;
};


type BoosterResult = {
  opening_id: number;
  balance: number;
  price_coins: number;
  cards: Card[];
};


const GAME_LABELS: Record<
  Game,
  string
> = {
  onepiece: "One Piece",
  pokemon: "Pokémon",
  riftbound: "Riftbound",
};


export default function BoosterPage() {
  const router = useRouter();

  const supabase =
    useMemo(
      () => createClient(),
      []
    );


  const [
    game,
    setGame,
  ] =
    useState<Game>(
      "onepiece"
    );


  const [
    sets,
    setSets,
  ] =
    useState<SetSummary[]>(
      []
    );


  const [
    setCode,
    setSetCode,
  ] =
    useState("");


  const [
    balance,
    setBalance,
  ] =
    useState<number | null>(
      null
    );


  const [
    accessToken,
    setAccessToken,
  ] =
    useState<string | null>(
      null
    );


  const [
    revealCards,
    setRevealCards,
  ] =
    useState<RevealCard[]>(
      []
    );


  const [
    revealOpen,
    setRevealOpen,
  ] =
    useState(false);


  const [
    revealSetCode,
    setRevealSetCode,
  ] =
    useState("");


  const [
    loadingSets,
    setLoadingSets,
  ] =
    useState(false);


  const [
    opening,
    setOpening,
  ] =
    useState(false);


  const [
    error,
    setError,
  ] =
    useState("");


  const selectedSet =
    useMemo(
      () =>
        sets.find(
          (item) =>
            item.set_code ===
            setCode
        ),
      [
        sets,
        setCode,
      ]
    );


  /*
   * Chargement utilisateur
   * + session
   * + wallet
   */
  useEffect(() => {
    async function boot() {
      const {
        data: {
          session,
        },
      } =
        await supabase.auth
          .getSession();


      if (!session?.user) {
        router.replace(
          "/login"
        );

        return;
      }


      setAccessToken(
        session.access_token
      );


      try {
        const wallet =
          await apiFetch<Wallet>(
            "/api/wallet"
          );

        setBalance(
          wallet.balance_coins
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Erreur wallet."
        );
      }
    }


    boot();
  }, [
    router,
    supabase,
  ]);


  /*
   * Chargement des extensions
   * quand le jeu change.
   */
  useEffect(() => {
    async function loadSets() {
      setLoadingSets(true);
      setError("");

      setRevealOpen(false);
      setRevealCards([]);


      try {
        const response =
          await apiFetch<
            SetSummary[]
          >(
            `/api/catalog/${game}/sets`
          );


        setSets(
          response
        );


        setSetCode(
          response[0]
            ?.set_code ??
          ""
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
        setLoadingSets(
          false
        );
      }
    }


    loadSets();
  }, [
    game,
  ]);


  /*
   * Achat + génération du booster.
   */
  async function openBooster() {
    if (
      !setCode ||
      opening ||
      revealOpen
    ) {
      return;
    }


    setOpening(true);
    setError("");
    setRevealCards([]);


    try {
      const result =
        await apiFetch<
          BoosterResult
        >(
          "/api/boosters/open",
          {
            method: "POST",

            body:
              JSON.stringify({
                game,
                set_code:
                  setCode,
              }),
          }
        );


      setBalance(
        result.balance
      );


      const returnedCards:
        RevealCard[] =
        (
          result.cards ??
          []
        ).map(
          (card) => ({
            card_key:
              card.card_key,

            game:
              card.game ??
              game,

            name:
              card.name,

            image_url:
              card.image_url,

            rarity:
              card.rarity,

            variant:
              card.variant,

            drop_class:
              card.drop_class,

            card_number:
              card.card_number,

            collectible:
              card.collectible,

            is_new:
              card.is_new ??
              false,

            _slot:
              card.slot,
          })
        );


      if (
        returnedCards.length ===
        0
      ) {
        throw new Error(
          "Le backend n'a renvoyé aucune carte."
        );
      }


      setRevealCards(
        returnedCards
      );


      setRevealSetCode(
        setCode
      );


      setRevealOpen(
        true
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'ouvrir le booster."
      );
    } finally {
      setOpening(
        false
      );
    }
  }


  async function logout() {
    await supabase.auth
      .signOut();

    router.replace(
      "/login"
    );
  }


  return (
    <>
      <main
        className="appShell"
      >
        {/* =========================
            HEADER
        ========================= */}

        <header
          className="topbar"
        >
          <div>
            <div
              className="eyebrow"
            >
              TCG GAME
            </div>

            <strong>
              Booster Lab
            </strong>
          </div>


          <div
            className="topbarRight"
          >
            <div
              className="wallet"
            >
              {balance === null
                ? "—"
                : balance
                    .toLocaleString(
                      "fr-FR"
                    )
              }
              {" "}
              🪙
            </div>


            <button
              type="button"
              className="ghostButton"
              onClick={() =>
                router.push(
                  "/cartedex"
                )
              }
            >
              Cartédex
            </button>


            <button
              type="button"
              className="ghostButton"
              onClick={
                logout
              }
            >
              Déconnexion
            </button>
          </div>
        </header>


        {/* =========================
            HERO
        ========================= */}

        <section
          className="hero"
        >
          <div>
            <div
              className="eyebrow"
            >
              OUVERTURE
            </div>

            <h1>
              Ouvre un booster
              sans recharger la
              page.
            </h1>

            <p>
              Choisis ton jeu et
              ton extension,
              consulte ta
              progression puis
              ouvre directement
              le booster.
            </p>
          </div>
        </section>


        {/* =========================
            SELECTEURS + COLLECTION
        ========================= */}

        <section
          className="
            controls
            panel
            boosterControls
          "
        >
          <div
            className="
              boosterSelectors
            "
          >
            <label>
              Jeu

              <select
                value={game}
                onChange={(event) =>
                  setGame(
                    event.target.value as Game
                  )
                }
              >
                {Object.entries(
                  GAME_LABELS
                ).map(
                  ([
                    value,
                    label,
                  ]) => (
                    <option
                      key={
                        value
                      }
                      value={
                        value
                      }
                    >
                      {
                        label
                      }
                    </option>
                  )
                )}
              </select>
            </label>


            <label>
              Extension

              <select
                value={
                  setCode
                }
                disabled={
                  loadingSets ||
                  sets.length ===
                    0
                }
                onChange={(
                  event
                ) =>
                  setSetCode(
                    event
                      .target
                      .value
                  )
                }
              >
                {sets.map(
                  (set) => (
                    <option
                      key={
                        set
                          .set_code
                      }
                      value={
                        set
                          .set_code
                      }
                    >
                      {
                        set
                          .set_code
                      }

                      {" — "}

                      {
                        set
                          .set_name
                      }
                    </option>
                  )
                )}
              </select>
            </label>
          </div>


          {setCode &&
          accessToken ? (
            <SetCollectionProgress
              game={game}
              setCode={
                setCode
              }
              accessToken={
                accessToken
              }
            />
          ) : null}
        </section>


        {/* =========================
            INFO EXTENSION
        ========================= */}

        {selectedSet ? (
          <p
            className="setMeta"
          >
            {
              GAME_LABELS[
                game
              ]
            }

            {" · "}

            {
              selectedSet
                .set_name
            }

            {selectedSet
              .card_count
              ? ` · ${selectedSet.card_count} cartes`
              : ""}
          </p>
        ) : null}


        {/* =========================
            ERREUR
        ========================= */}

        {error ? (
          <div
            className="errorBox"
          >
            {error}
          </div>
        ) : null}


        {/* =========================
            BOOSTER
            HORS DU PANEL
        ========================= */}

        {setCode ? (
          <section
            className="
              boosterStandalone
            "
          >
            <BoosterPackPreview
              game={game}
              setCode={
                setCode
              }
              opening={
                opening
              }
              disabled={
                opening ||
                loadingSets
              }
              onOpen={
                openBooster
              }
            />
          </section>
        ) : null}
      </main>


      {/* =========================
          CINÉMATIQUE
      ========================= */}

      <BoosterRevealModal
        open={revealOpen}
        cards={
          revealCards
        }
        setCode={
          revealSetCode
        }
        onClose={() => {
          setRevealOpen(
            false
          );
        }}
      />
    </>
  );
}