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
  const supabase = createClient();

  const [game, setGame] =
    useState<Game>("onepiece");

  const [sets, setSets] =
    useState<SetSummary[]>([]);

  const [setCode, setSetCode] =
    useState("");

  const [balance, setBalance] =
    useState<number | null>(null);

  const [cards, setCards] =
    useState<Card[]>([]);

  const [
    loadingSets,
    setLoadingSets,
  ] = useState(false);

  const [opening, setOpening] =
    useState(false);

  const [error, setError] =
    useState("");

  const selectedSet = useMemo(
    () =>
      sets.find(
        (item) =>
          item.set_code === setCode,
      ),
    [sets, setCode],
  );

  useEffect(() => {
    async function boot() {
      const {
        data: { user },
      } = await supabase.auth
        .getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        const wallet =
          await apiFetch<Wallet>(
            "/api/wallet",
          );

        setBalance(
          wallet.balance_coins,
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Erreur wallet.",
        );
      }
    }

    boot();
  }, [router, supabase]);

  useEffect(() => {
    async function loadSets() {
      setLoadingSets(true);
      setError("");
      setCards([]);

      try {
        const response =
          await apiFetch<SetSummary[]>(
            `/api/catalog/${game}/sets`,
          );

        setSets(response);
        setSetCode(
          response[0]?.set_code ?? "",
        );
      } catch (err) {
        setSets([]);
        setSetCode("");

        setError(
          err instanceof Error
            ? err.message
            : "Impossible de charger les extensions.",
        );
      } finally {
        setLoadingSets(false);
      }
    }

    loadSets();
  }, [game]);

  async function openBooster() {
    if (!setCode || opening) {
      return;
    }

    setOpening(true);
    setError("");

    // Réaction immédiate de l'interface.
    setCards([]);

    try {
      const result =
        await apiFetch<BoosterResult>(
          "/api/boosters/open",
          {
            method: "POST",
            body: JSON.stringify({
              game,
              set_code: setCode,
            }),
          },
        );

      setBalance(result.balance);
      setCards(result.cards);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'ouvrir le booster.",
      );
    } finally {
      setOpening(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <div className="eyebrow">
            TCG GAME
          </div>
          <strong>Booster Lab</strong>
        </div>

        <div className="topbarRight">
          <div className="wallet">
            {balance === null
              ? "—"
              : balance.toLocaleString(
                  "fr-FR",
                )}{" "}
            🪙
          </div>

          <button
            className="ghostButton"
            onClick={logout}
          >
            Déconnexion
          </button>
        </div>
      </header>

      <section className="hero">
        <div>
          <div className="eyebrow">
            OUVERTURE
          </div>

          <h1>
            Ouvre un booster sans
            recharger la page.
          </h1>

          <p>
            React garde l'interface
            en mémoire. FastAPI n'est
            appelé que lorsque les
            données doivent changer.
          </p>
        </div>
      </section>

      <section className="controls panel">
        <label>
          Jeu
          <select
            value={game}
            onChange={(event) =>
              setGame(
                event.target
                  .value as Game,
              )
            }
          >
            {Object.entries(
              GAME_LABELS,
            ).map(
              ([value, label]) => (
                <option
                  key={value}
                  value={value}
                >
                  {label}
                </option>
              ),
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
                event.target.value,
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

        <button
          className=
            "primaryButton openButton"
          disabled={
            !setCode || opening
          }
          onClick={openBooster}
        >
          {opening
            ? "Ouverture..."
            : "Ouvrir le booster"}
        </button>
      </section>

      {selectedSet && (
        <p className="setMeta">
          {GAME_LABELS[game]}
          {" · "}
          {selectedSet.set_name}
          {selectedSet.card_count
            ? ` · ${selectedSet.card_count} cartes`
            : ""}
        </p>
      )}

      {error && (
        <div className="errorBox">
          {error}
        </div>
      )}

      {opening && (
        <section className=
          "openingStage"
        >
          <div className="pack">
            <span>
              {GAME_LABELS[game]}
            </span>
            <strong>{setCode}</strong>
            <small>BOOSTER</small>
          </div>

          <p>Ouverture...</p>
        </section>
      )}

      {!opening
        && cards.length > 0
        && (
          <section className=
            "cardsGrid"
          >
            {cards.map(
              (card, index) => (
                <article
                  className="cardTile"
                  key={
                    `${card.card_key}-${index}`
                  }
                  style={{
                    animationDelay:
                      `${index * 45}ms`,
                  }}
                >
                  <div className=
                    "cardImage"
                  >
                    {card.image_url ? (
                      <img
                        src={
                          card.image_url
                        }
                        alt={card.name}
                      />
                    ) : (
                      <div className=
                        "cardPlaceholder"
                      >
                        {
                          card.product_set
                        }
                      </div>
                    )}
                  </div>

                  <div className=
                    "cardBody"
                  >
                    <small>
                      {card.slot}
                    </small>

                    <strong>
                      {card.name}
                    </strong>

                    <span>
                      {card.card_number}
                      {card.rarity
                        ? ` · ${card.rarity}`
                        : ""}
                    </span>
                  </div>
                </article>
              ),
            )}
          </section>
        )}
    </main>
  );
}
