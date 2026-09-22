"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getApiBaseUrl,
} from "@/lib/api";


type CartedexCard = {
  rarity?: string | null;
  drop_class?: string | null;

  quantity?: number;
  owned?: boolean;
};


type CartedexResponse = {
  owned_cards: number;
  total_cards: number;

  completion_percent: number;

  cards: CartedexCard[];
};


type RarityStat = {
  rarity: string;
  owned: number;
  total: number;
};


type Props = {
  game: string;
  setCode: string;
  accessToken?: string | null;
};


export default function SetCollectionProgress({
  game,
  setCode,
  accessToken,
}: Props) {
  const [
    data,
    setData,
  ] =
    useState<CartedexResponse | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);


  useEffect(() => {
    if (
      !game ||
      !setCode ||
      !accessToken
    ) {
      setData(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const response =
          await fetch(
            `${getApiBaseUrl()}/api/cartedex/${game}/${setCode}`,
            {
              headers: {
                Authorization:
                  `Bearer ${accessToken}`,
              },
            }
          );

        if (!response.ok) {
          throw new Error(
            `Cartédex ${response.status}`
          );
        }

        const payload =
          await response.json();

        if (!cancelled) {
          setData(payload);
        }
      } catch (error) {
        console.error(
          "Erreur progression Cartédex:",
          error
        );

        if (!cancelled) {
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [
    game,
    setCode,
    accessToken,
  ]);


  const rarities =
    useMemo<RarityStat[]>(() => {
      if (!data) {
        return [];
      }

      const stats =
        new Map<
          string,
          {
            owned: number;
            total: number;
          }
        >();

      for (
        const card
        of data.cards ?? []
      ) {
        const rarity = (
          card.rarity ||
          card.drop_class ||
          "Autre"
        ).trim();

        const current =
          stats.get(rarity) ?? {
            owned: 0,
            total: 0,
          };

        current.total += 1;

        const isOwned =
          card.owned === true ||
          Number(
            card.quantity ?? 0
          ) > 0;

        if (isOwned) {
          current.owned += 1;
        }

        stats.set(
          rarity,
          current
        );
      }

      return Array.from(
        stats.entries()
      )
        .map(
          ([
            rarity,
            value,
          ]) => ({
            rarity,
            ...value,
          })
        )
        .sort(
          (a, b) =>
            b.total - a.total
        );
    }, [data]);


  if (loading) {
    return (
      <div className="setProgressPanel">
        Chargement du Cartédex...
      </div>
    );
  }


  if (!data) {
    return null;
  }


  const percent =
    Math.max(
      0,
      Math.min(
        100,
        data.completion_percent ?? 0
      )
    );


  return (
    <section
      className="setProgressPanel"
    >
      <div
        className="setProgressHeader"
      >
        <div>
          <span>COLLECTION :  </span>

          <strong>
            {data.owned_cards}
            {" / "}
            {data.total_cards}
          </strong>
        </div>

        <strong
          className="setProgressPercent"
        >
          {percent.toFixed(1)}%
        </strong>
      </div>


      <div
        className="setProgressTrack"
      >
        <div
          className="setProgressFill"
          style={{
            width:
              `${percent}%`,
          }}
        />
      </div>


      <div
        className="rarityProgressGrid"
      >
        {rarities.map(
          (rarity) => {
            const rarityPercent =
              rarity.total
                ? (
                    rarity.owned /
                    rarity.total
                  ) *
                  100
                : 0;

            return (
              <div
                key={
                  rarity.rarity
                }
                className={
                  "rarityProgressItem"
                }
              >
                <div>
                  <strong>
                    {
                      rarity.rarity
                    }
                  </strong>

                  <span> : {rarity.owned}/{rarity.total} </span>
                </div>

                <div
                  className={
                    "rarityMiniTrack"
                  }
                >
                  <div
                    className={
                      "rarityMiniFill"
                    }
                    style={{
                      width:
                        `${
                          rarityPercent
                        }%`,
                    }}
                  />
                </div>
              </div>
            );
          }
        )}
      </div>
    </section>
  );
}