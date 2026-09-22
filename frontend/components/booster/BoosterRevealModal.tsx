"use client";

import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  gameLabel,
  getRevealProfile,
  rarityRank,
  sortCardsForReveal,
  type RevealCard,
  type RevealProfile,
} from "@/lib/reveal-effects";
import styles from "./BoosterRevealModal.module.css";
import {
  getCardBack,
} from "@/lib/tcg-assets";
import {
  getBoosterImage,
} from "@/lib/tcg-assets";
type Props = {
  open: boolean;
  cards: RevealCard[];
  setCode?: string;
  onClose: () => void;
};

type Scene = "pack" | "cards" | "summary";

function cardId(card: RevealCard, index: number) {
  return String(card.card_key ?? card.source_id ?? `${card.name}-${index}`);
}

function deterministic(index: number, salt: number) {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function cardDetails(card: RevealCard) {
  return [card.card_number, card.rarity, card.variant, card.drop_class]
    .map((value) => String(value ?? "").trim())
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .join(" · ");
}

export default function BoosterRevealModal({
  open,
  cards,
  setCode,
  onClose,
}: Props) {
  const sortedCards = useMemo(() => sortCardsForReveal(cards), [cards]);

  const [scene, setScene] = useState<Scene>("pack");
  const [packOpening, setPackOpening] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealing, setRevealing] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [suspense, setSuspense] = useState(false);
  const [impactActive, setImpactActive] = useState(false);
  
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const timersRef = useRef<number[]>([]);

  const current = sortedCards[index];
  const [
    teaserActive,
    setTeaserActive,
  ] = useState(false);
  const profile = useMemo(
    () => (current ? getRevealProfile(current) : null),
    [current]
  );
  const hasTeaserReveal =
    (profile?.impactLevel ?? 0) >= 4;

  const materializeMs =
    hasTeaserReveal ? 100 : 0;
  const teaserMs =
    profile &&
    profile.impactLevel >= 4
      ? Math.min(
          4000,
          Math.round(
            2000 +
              Math.max(
                0,
                profile.rank - 85
              ) *
                150
          )
        )
      : 0;

  const revealDurationMs =
    profile
      ? Math.round(
          profile.durationMs *
            (
              profile.impactLevel >= 5
                ? 1.20
                : profile.impactLevel >= 4
                  ? 1.12
                  : 1
            )
        )
      : 0;
  const clearTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };
  useEffect(() => {
    if (!open) {
      return;
    }

    // Nettoyage des timers d'une ancienne ouverture.
    timersRef.current.forEach((timer) => {
      window.clearTimeout(timer);
    });

    timersRef.current = [];

    // Réinitialisation complète du modal.
    setScene("pack");
    setPackOpening(false);
    setIndex(0);

    setRevealing(false);
    setRevealed(false);
    setSuspense(false);

    setImpactActive(false);
    setTeaserActive(false);

    const element = tiltRef.current;

    if (element) {
      element.style.setProperty(
        "--tilt-x",
        "0deg"
      );

      element.style.setProperty(
        "--tilt-y",
        "0deg"
      );

      element.style.setProperty(
        "--mx",
        "50%"
      );

      element.style.setProperty(
        "--my",
        "50%"
      );
    }
  }, [open]);
 useEffect(() => {
  if (
    !open ||
    scene !== "cards" ||
    !current ||
    !profile
  ) {
    return;
  }

  setRevealing(false);
  setRevealed(false);
  setImpactActive(false);
  setSuspense(false);
  setTeaserActive(
    hasTeaserReveal
  );

  let startTimer:
    number | undefined;

  let infoTimer:
    number | undefined;

  let impactTimer:
    number | undefined;

  let finishTimer:
    number | undefined;

  // =========================================
  // CAS 1 : cartes AVEC teaser
  // reconstruction -> apparition directe
  // =========================================
  if (hasTeaserReveal) {
    const overlapMs = 150;

    // La vraie carte apparaît légèrement AVANT
    // la disparition complète de la reconstruction.
    infoTimer = window.setTimeout(() => {
      setRevealed(true);
    }, Math.max(0, teaserMs - overlapMs));

    // L'explosion démarre juste après,
    // alors que les dernières étincelles sont encore visibles.
    impactTimer = window.setTimeout(() => {
      setImpactActive(true);
    }, Math.max(0, teaserMs - 100));

    // La reconstruction disparaît seulement à la toute fin.
    startTimer = window.setTimeout(() => {
      setTeaserActive(false);
    }, teaserMs);

    return () => {
      if (startTimer !== undefined) {
        window.clearTimeout(startTimer);
      }

      if (infoTimer !== undefined) {
        window.clearTimeout(infoTimer);
      }

      if (impactTimer !== undefined) {
        window.clearTimeout(impactTimer);
      }
    };
  }

  // =========================================
  // CAS 2 : cartes normales
  // comportement habituel avec flip
  // =========================================
  startTimer = window.setTimeout(() => {
    setTeaserActive(false);
    setRevealing(true);

    const isBasic =
      profile.rank <= 20;

    const infoDelay =
      isBasic
        ? 90
        : Math.max(
            180,
            Math.round(
              revealDurationMs * 0.52
            )
          );

    infoTimer =
      window.setTimeout(() => {
        setRevealed(true);
      }, infoDelay);

    if (
      profile.impactLevel > 0
    ) {
      impactTimer =
        window.setTimeout(() => {
          setImpactActive(true);
        }, revealDurationMs * 0.60);
    }

    finishTimer =
      window.setTimeout(() => {
        setRevealing(false);
      }, revealDurationMs);

  }, 80);

  return () => {
    if (startTimer !== undefined) {
      window.clearTimeout(
        startTimer
      );
    }

    if (infoTimer !== undefined) {
      window.clearTimeout(
        infoTimer
      );
    }

    if (impactTimer !== undefined) {
      window.clearTimeout(
        impactTimer
      );
    }

    if (finishTimer !== undefined) {
      window.clearTimeout(
        finishTimer
      );
    }
  };
}, [
  open,
  scene,
  index,
  current,
  profile,
  teaserMs,
  revealDurationMs,
  hasTeaserReveal,
  materializeMs,
]);

  useEffect(() => {
    return () => clearTimers();
  }, []);

  // Révélation automatique.
  //
  // Common / Uncommon : apparition simple et rapide, sans rotation.
  // Rare+ : retournement 3D. Les infos deviennent disponibles dès que
  // la face avant est lisible, sans attendre la fin complète de la rotation.
  // L'impact de rareté est déclenché juste avant la fin du retournement.

  if (!open || !current || !profile) return null;

  const resetCardState = () => {
    clearTimers();
    setRevealing(false);
    setRevealed(false);
    setSuspense(false);
    setImpactActive(false);
    setTeaserActive(false);
    resetTilt();
  };

  const openPack = () => {
    if (packOpening) return;
    setPackOpening(true);

    const timer = window.setTimeout(() => {
      setScene("cards");
      setPackOpening(false);
    }, 720);

    timersRef.current.push(timer);
  };

  const nextCard = () => {
    if (!revealed) return;

    if (index >= sortedCards.length - 1) {
      clearTimers();
      setImpactActive(false);
      setScene("summary");
      return;
    }

    // On retire directement la carte courante et React monte la suivante
    // avec une nouvelle key. L'ancienne carte ne rejoue donc jamais le flip
    // en sens inverse avant de disparaître.
    clearTimers();
    resetTilt();
    setImpactActive(false);
    setSuspense(false);
    setRevealing(false);
    setRevealed(false);
    setIndex((value) => value + 1);
  };

  function resetTilt() {
    const element = tiltRef.current;
    if (!element) return;
    element.style.setProperty("--tilt-x", "0deg");
    element.style.setProperty("--tilt-y", "0deg");
    element.style.setProperty("--mx", "50%");
    element.style.setProperty("--my", "50%");
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!revealed || !tiltRef.current) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));

    const tiltY = (x * 2 - 1) * 10;
    const tiltX = -(y * 2 - 1) * 8;

    tiltRef.current.style.setProperty("--tilt-x", `${tiltX.toFixed(2)}deg`);
    tiltRef.current.style.setProperty("--tilt-y", `${tiltY.toFixed(2)}deg`);
    tiltRef.current.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    tiltRef.current.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
  };


const cssVars = {
  "--primary": profile.primary,
  "--secondary": profile.secondary,
  "--accent": profile.accent,
  "--duration": `${
    hasTeaserReveal
      ? materializeMs
      : revealDurationMs
  }ms`,
} as CSSProperties;
 

  return (
    <div
      className={`${styles.overlay} ${styles[`tier_${profile.tier}`]}`}
      style={cssVars}
      role="dialog"
      aria-modal="true"
      aria-label="Ouverture du booster"
    >
      <div className={styles.backgroundGrid} />
      <div className={styles.vignette} />

      <header className={styles.topbar}>
        <div className={styles.brandBlock}>
          <span className={styles.eyebrow}>BOOSTER OPENING</span>
          <strong>{gameLabel(current.game)}</strong>
          {setCode ? <span className={styles.setCode}>{setCode}</span> : null}
        </div>

        {scene === "cards" ? (
          <div className={styles.counter}>
            <span>{index + 1}</span>
            <span className={styles.counterSlash}>/</span>
            <span>{sortedCards.length}</span>
          </div>
        ) : null}

        <button className={styles.closeButton} type="button" onClick={onClose}>
          Fermer
        </button>
      </header>

      {scene === "pack" ? (
        <PackIntro
          game={gameLabel(current.game)}
          gameKey={current.game}
          setCode={setCode}
          opening={packOpening}
          onOpen={openPack}
        />
      ) : null}

      {scene === "cards" ? (
        <main className={styles.cardScene}>
          <section className={styles.metaColumn}>
            <span className={styles.metaEyebrow}>
              {revealed ? "CARTE RÉVÉLÉE" : "CARTE MYSTÈRE"}
            </span>

            <h2 className={styles.cardName}>
              {revealed ? current.name : "???"}
            </h2>

            <p className={styles.cardDetails}>
              {revealed ? cardDetails(current) || "Carte du booster" : suspense ? "Suspense..." : "Révélation en cours..."}
            </p>

            {revealed && profile.label ? (
              <div className={styles.rarityBadge}>{profile.label}</div>
            ) : null}
            {revealed ? (
              <div
                className={
                  current.is_new
                    ? styles.newCardBadge
                    : styles.ownedCardBadge
                }
              >
                {current.is_new
                  ? "✦ NOUVELLE CARTE"
                  : "DÉJÀ POSSÉDÉE"}
              </div>
            ) : null}
          </section>

          <section className={styles.centerStage}>
            <Aura profile={profile} active={revealing || revealed} />

            

            {impactActive && profile.particles > 0 ? (
              <Particles
                key={`${cardId(current, index)}-impact`}
                profile={profile}
              />
            ) : null}

            {impactActive && profile.impactLevel > 0 ? (
              <RarityImpact
                key={`${cardId(current, index)}-rarity-impact`}
                profile={profile}
              />
            ) : null}
            
            {teaserActive &&
            profile.impactLevel >= 4 ? (
              <SparkBuildTeaser
                key={`${cardId(
                  current,
                  index
                )}-build`}
                card={current}
                profile={profile}
                durationMs={teaserMs}
              />
            ) : null}
            <div
              key={cardId(current, index)}
              ref={tiltRef}
              className={`${styles.tiltFrame} ${
                teaserActive && !revealed
                  ? styles.cardHiddenDuringBuild
                  : ""
              } ${
                revealed
                  ? styles.inspectable
                  : ""
              }`}
              onPointerMove={onPointerMove}
              onPointerLeave={resetTilt}
            >
              <div
                className={styles.cardButton}
                aria-label={
                  revealed
                    ? current.name
                    : "Révélation automatique de la carte"
                }
              >
                {hasTeaserReveal ? (
                  /* ======================================
                    GROS HIT :
                    PAS DE DOS, PAS DE FLIP
                    ====================================== */
                  <div
                    className={`${styles.directRevealCard} ${
                      revealed
                        ? styles.directRevealCardVisible
                        : ""
                    }`}
                  >
                    <CardArtwork card={current} />

                    {profile.holo ? (
                      <div
                        className={styles.holo}
                        aria-hidden="true"
                      />
                    ) : null}

                    {revealed &&
                    profile.rank >= 70 ? (
                      <div
                        className={styles.edgeGlow}
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                ) : profile.rank <= 20 ? (
                  /* ======================================
                    COMMON / UNCOMMON :
                    APPARITION SIMPLE
                    ====================================== */
                  <div
                    className={`${styles.card3d} ${styles.cardBasic} ${
                      revealing || revealed
                        ? styles.cardBasicVisible
                        : ""
                    }`}
                  >
                    <div
                      className={`${styles.cardFace} ${styles.cardFront} ${styles.basicFront}`}
                    >
                      <CardArtwork card={current} />
                    </div>
                  </div>
                ) : (
                  /* ======================================
                    RARE / SR / EPIC :
                    FLIP NORMAL
                    ====================================== */
                  <div
                    className={`${styles.card3d} ${
                      revealing || revealed
                        ? styles.cardFlipped
                        : ""
                    }`}
                  >
                    <div
                      className={`${styles.cardFace} ${styles.cardBack}`}
                    >
                      {getCardBack(current.game) ? (
                        <img
                          className={styles.realCardBack}
                          src={
                            getCardBack(
                              current.game
                            )!
                          }
                          alt=""
                          draggable={false}
                        />
                      ) : (
                        <div
                          className={styles.backFrame}
                        >
                          <div
                            className={styles.backOrb}
                          />

                          <span
                            className={styles.backSmall}
                          >
                            TCG
                          </span>

                          <strong>
                            BOOSTER LAB
                          </strong>
                        </div>
                      )}
                    </div>

                    <div
                      className={`${styles.cardFace} ${styles.cardFront}`}
                    >
                      <CardArtwork card={current} />

                      {profile.holo ? (
                        <div
                          className={styles.holo}
                          aria-hidden="true"
                        />
                      ) : null}

                      {revealed &&
                      profile.rank >= 70 ? (
                        <div
                          className={styles.edgeGlow}
                          aria-hidden="true"
                        />
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className={styles.mobileMeta}>
              <strong>
                {revealed
                  ? current.name
                  : "Carte mystère"}
              </strong>

              {revealed ? (
                <>
                  <span>
                    {cardDetails(current)}
                  </span>

                  <div
                    className={
                      current.is_new
                        ? styles.mobileNewCard
                        : styles.mobileOwnedCard
                    }
                  >
                    {current.is_new
                      ? "✦ NOUVELLE CARTE"
                      : "DÉJÀ POSSÉDÉE"}
                  </div>
                </>
              ) : null}
            </div>
          </section>

          <section className={styles.actionColumn}>
            {revealed ? (
              <button type="button" className={styles.nextButton} onClick={nextCard}>
                <span>
                  {index === sortedCards.length - 1
                    ? "Voir le récapitulatif"
                    : "Carte suivante"}
                </span>
                <strong>→</strong>
              </button>
            ) : (
              <div className={styles.waitingText}>
                {suspense ? "Quelque chose arrive..." : "Révélation..."}
              </div>
            )}
          </section>
        </main>
      ) : null}

      {scene === "summary" ? (
        <Summary cards={sortedCards} onClose={onClose} />
      ) : null}
    </div>
  );
}

function PackIntro({
  game,
  gameKey,
  setCode,
  opening,
  onOpen,
}: {
  game: string;
  gameKey: string;
  setCode?: string;
  opening: boolean;
  onOpen: () => void;
}) {
  const boosterImage =
    getBoosterImage(
      gameKey,
      setCode
    );

  return (
    <main className={styles.packScene}>
      <div className={styles.packAura} />

      <button
        type="button"
        className={`${styles.packButton} ${
          opening
            ? styles.packOpening
            : ""
        }`}
        onClick={onOpen}
        disabled={opening}
      >
        {boosterImage ? (
          <>
            <img
              className={
                styles.realBoosterImage
              }
              src={boosterImage}
              alt={`${game} ${setCode ?? ""}`}
              draggable={false}
            />

            <div
              className={
                styles.realBoosterOverlay
              }
            >
              <small>
                {opening
                  ? "OUVERTURE..."
                  : "TOUCHER POUR OUVRIR"}
              </small>
            </div>
          </>
        ) : (
          <>
            {/* Fallback :
                booster générique actuel */}
            <div
              className={`${styles.packHalf} ${styles.packTop}`}
            >
              <div
                className={
                  styles.packFoil
                }
              />
            </div>

            <div
              className={`${styles.packHalf} ${styles.packBottom}`}
            >
              <div
                className={
                  styles.packFoil
                }
              />
            </div>

            <div
              className={
                styles.packContent
              }
            >
              <span
                className={
                  styles.packKicker
                }
              >
                TCG GAME
              </span>

              <strong>
                {game}
              </strong>

              <span>
                {setCode || "BOOSTER"}
              </span>

              <div
                className={
                  styles.packLine
                }
              />

              <small>
                {opening
                  ? "OUVERTURE..."
                  : "TOUCHER POUR OUVRIR"}
              </small>
            </div>

            <div
              className={
                styles.tearLine
              }
            />
          </>
        )}
      </button>

      <p
        className={
          styles.packInstruction
        }
      >
        Les cartes seront révélées
        du bulk vers les hits.
      </p>
    </main>
  );
}

function SparkBuildTeaser({
  card,
  profile,
  durationMs,
}: {
  card: RevealCard;
  profile: RevealProfile;
  durationMs: number;
}) {
  const count =
    profile.impactLevel >= 5
      ? 300
      : 150;

  const sparks = useMemo(() => {
    return Array.from(
      { length: count },
      (_, index) => {
        const side = index % 4;

        const position =
          deterministic(
            index,
            profile.rank + 21
          );

        const interior =
          index % 6 === 0;

        let tx = 50;
        let ty = 50;

        if (interior) {
          tx =
            14 +
            deterministic(
              index,
              profile.rank + 31
            ) *
              72;

          ty =
            10 +
            deterministic(
              index,
              profile.rank + 32
            ) *
              80;
        } else if (side === 0) {
          // Bord supérieur
          tx = 7 + position * 86;
          ty = 2;
        } else if (side === 1) {
          // Bord droit
          tx = 98;
          ty = 7 + position * 86;
        } else if (side === 2) {
          // Bord inférieur
          tx = 7 + position * 86;
          ty = 98;
        } else {
          // Bord gauche
          tx = 2;
          ty = 7 + position * 86;
        }

        const angle =
          deterministic(
            index,
            profile.rank + 40
          ) *
          Math.PI *
          2;

        const distance =
          130 +
          deterministic(
            index,
            profile.rank + 41
          ) *
            260;

        const sx =
          Math.cos(angle) *
          distance;

        const sy =
          Math.sin(angle) *
          distance;

        const delay =
          deterministic(
            index,
            profile.rank + 42
          ) *
          durationMs *
          0.42;

        const particleDuration =
          durationMs *
          (
            0.42 +
            deterministic(
              index,
              profile.rank + 43
            ) *
              0.30
          );

        const size =
          2 +
          deterministic(
            index,
            profile.rank + 44
          ) *
            5;

        const colorIndex =
          index % 3;

        const color =
          colorIndex === 0
            ? profile.primary
            : colorIndex === 1
              ? profile.secondary
              : profile.accent;

        return {
          tx,
          ty,
          sx,
          sy,
          delay,
          particleDuration,
          size,
          color,
        };
      }
    );
  }, [
    count,
    durationMs,
    profile,
  ]);

  return (
    <div
      className={
        styles.sparkBuild
      }
      style={
        {
          "--build-duration":
            `${durationMs}ms`,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <div
        className={
          styles.sparkBuildGhost
        }
      />
      <div
        className={
          styles.sparkBuildArtwork
        }
      >
        <CardArtwork card={card} />

        {profile.holo ? (
          <div
            className={styles.holo}
            aria-hidden="true"
          />
        ) : null}
      </div>

      <div
        className={
          styles.sparkBuildCore
        }
      />
      <div
        className={
          styles.sparkBuildCore
        }
      />

      {sparks.map(
        (spark, index) => (
          <span
            key={index}
            className={
              index % 5 === 0
                ? `${styles.sparkBuildParticle} ${styles.sparkBuildStar}`
                : styles.sparkBuildParticle
            }
            style={
              {
                "--tx":
                  `${spark.tx}%`,

                "--ty":
                  `${spark.ty}%`,

                "--sx":
                  `${spark.sx}px`,

                "--sy":
                  `${spark.sy}px`,

                "--spark-delay":
                  `${spark.delay}ms`,

                "--spark-duration":
                  `${spark.particleDuration}ms`,

                "--spark-size":
                  `${spark.size}px`,

                "--spark-color":
                  spark.color,
              } as CSSProperties
            }
          />
        )
      )}
    </div>
  );
}
function RarityImpact({
  profile,
}: {
  profile: RevealProfile;
}) {
  const level = profile.impactLevel;

  if (level === 0) {
    return null;
  }

  const sparkCount =
    level >= 5
      ? 28
      : level >= 4
        ? 22
        : level >= 3
          ? 16
          : 10;

  const fireworkCount =
    level >= 5 ? 5 : 3;

  return (
    <div
      className={`${styles.impactLayer} ${
        styles[`impactLevel${level}`]
      }`}
      aria-hidden="true"
    >
      {/* RARE :
          simple onde */}
      {level === 1 && (
        <span
          className={`${styles.impactRing} ${styles.impactRing1}`}
        />
      )}

      {/* SR :
          petites étincelles */}
      {level >= 2 && (
        <div className={styles.sparkBurst}>
          {Array.from({
            length: sparkCount,
          }).map((_, index) => (
            <span
              key={index}
              className={styles.spark}
              style={
                {
                  "--i": index,
                  "--count": sparkCount,
                  "--spark-distance":
                    `${
                      150 +
                      (index % 5) * 18
                    }px`,
                  "--spark-delay":
                    `${(index % 4) * 18}ms`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}

      {/* EPIC :
          étoile / explosion centrale */}
      {level >= 3 && (
        <>
          <span
            className={styles.starBurst}
          />

          <span
            className={styles.energyFlash}
          />
        </>
      )}

      {/* ALT / HYPER / SP :
          feu d'artifice */}
      {level >= 4 && (
        <div
          className={
            styles.fireworkStage
          }
        >
          {Array.from({
            length: fireworkCount,
          }).map(
            (_, fireworkIndex) => (
              <Firework
                key={fireworkIndex}
                index={fireworkIndex}
                level={level}
              />
            )
          )}
        </div>
      )}

      {/* MANGA / SIGNATURE /
          ULTIMATE :
          pluie de paillettes */}
      {level >= 5 && (
        <>
          <div
            className={
              styles.glitterRain
            }
          >
            {Array.from({
              length: 34,
            }).map((_, index) => (
              <span
                key={index}
                className={
                  styles.glitter
                }
                style={
                  {
                    "--gx":
                      `${
                        5 +
                        ((index * 37) %
                          90)
                      }%`,
                    "--gdelay":
                      `${
                        (index % 9) *
                        55
                      }ms`,
                    "--gduration":
                      `${
                        850 +
                        (index % 6) *
                          110
                      }ms`,
                  } as CSSProperties
                }
              />
            ))}
          </div>

          <span
            className={
              styles.chaseFlash
            }
          />
        </>
      )}
    </div>
  );
}
function Firework({
  index,
  level,
}: {
  index: number;
  level: number;
}) {
  const particleCount =
    level >= 5 ? 18 : 14;
  
  const positions = [
    {
      x: "-22%",
      y: "18%",
      delay: "0ms",
    },
    {
      x: "-36%",
      y: "-24%",
      delay: "120ms",
    },
    {
      x: "34%",
      y: "-28%",
      delay: "220ms",
    },
    
    {
      x: "26%",
      y: "22%",
      delay: "320ms",
    },
    {
      x: "0%",
      y: "-38%",
      delay: "420ms",
    },
    {
      x: "4%",
      y: "34%",
      delay: "520ms",
    },
  ];

  const position =
    positions[
      index % positions.length
    ];

  return (
    <div
      className={styles.firework}
      style={
        {
          "--firework-x":
            position.x,
          "--firework-y":
            position.y,
          "--firework-delay":
            position.delay,
        } as CSSProperties
      }
    >
      <span
        className={
          styles.fireworkCore
        }
      />

      {Array.from({
        length: particleCount,
      }).map((_, particleIndex) => (
        <span
          key={particleIndex}
          className={
            styles.fireworkParticle
          }
          style={
            {
              "--i": particleIndex,
              "--count":
                particleCount,
              "--distance":
                `${
                  125 +
                  (particleIndex %
                    4) *
                    28
                }px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
function Aura({
  profile,
  active,
}: {
  profile: RevealProfile;
  active: boolean;
}) {
  if (!active || profile.rank <= 20) return null;

  return (
    <div
      className={`${styles.aura} ${profile.rank >= 85 ? styles.auraChase : ""}`}
      aria-hidden="true"
    />
  );
}

function Particles({ profile }: { profile: RevealProfile }) {
  const particles = useMemo(
    () =>
      Array.from({ length: profile.particles }, (_, index) => {
        const angle = deterministic(index, profile.rank) * Math.PI * 2;
        const distance = 110 + deterministic(index, profile.rank + 1) * 260;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        const size = 2 + deterministic(index, profile.rank + 2) * 7;
        const delay = deterministic(index, profile.rank + 3) * 0.45;
        const duration = 0.8 + deterministic(index, profile.rank + 4) * 1.15;
        const colorIndex = index % 3;
        const color =
          colorIndex === 0
            ? profile.primary
            : colorIndex === 1
              ? profile.secondary
              : profile.accent;

        return { x, y, size, delay, duration, color };
      }),
    [profile]
  );

  return (
    <div className={styles.particleLayer} aria-hidden="true">
      {particles.map((particle, index) =>
        index % 4 === 0 ? (
          <span
            key={index}
            className={`${styles.particle} ${styles.starParticle}`}
            style={
              {
                "--x": `${particle.x}px`,
                "--y": `${particle.y}px`,
                "--size": `${particle.size * 1.6}px`,
                "--delay": `${particle.delay}s`,
                "--particle-duration": `${particle.duration}s`,
                "--particle-color": particle.color,
              } as CSSProperties
            }
          >
            ✦
          </span>
        ) : (
          <span
            key={index}
            className={styles.particle}
            style={
              {
                "--x": `${particle.x}px`,
                "--y": `${particle.y}px`,
                "--size": `${particle.size}px`,
                "--delay": `${particle.delay}s`,
                "--particle-duration": `${particle.duration}s`,
                "--particle-color": particle.color,
              } as CSSProperties
            }
          />
        )
      )}
    </div>
  );
}

function CardArtwork({ card }: { card: RevealCard }) {
  const source = card.image_url || card.image || "";

  if (!source) {
    return (
      <div className={styles.missingArtwork}>
        <span>TCG</span>
        <strong>{card.name}</strong>
      </div>
    );
  }

  return (
    // Les URLs R2 sont déjà optimisées et n'ont pas besoin de next/image ici.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={styles.cardImage} src={source} alt={card.name} draggable={false} />
  );
}

function Summary({ cards, onClose }: { cards: RevealCard[]; onClose: () => void }) {
  const best = useMemo(
    () => [...cards].sort((a, b) => rarityRank(b) - rarityRank(a))[0],
    [cards]
  );

  const bestProfile = getRevealProfile(best);

  return (
    <main className={styles.summaryScene}>
      <div className={styles.summaryHeader}>
        <span className={styles.metaEyebrow}>OUVERTURE TERMINÉE</span>
        <h2>Ton booster</h2>
        <p>
          Meilleur hit : <strong>{best.name}</strong>
          {bestProfile.label ? ` · ${bestProfile.label}` : ""}
        </p>
      </div>

      <div className={styles.summaryGrid}>
        {cards.map((card, index) => {
          const profile = getRevealProfile(card);
          
          const source = card.image_url || card.image || "";

          return (
            <article
              className={styles.summaryCard}
              key={cardId(card, index)}
              style={
                {
                  "--summary-color": profile.primary,
                } as CSSProperties
              }
            >
              <div className={styles.summaryImageWrap}>
                {source ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={source} alt={card.name} draggable={false} />
                ) : (
                  <div className={styles.summaryMissing}>{card.name}</div>
                )}
              </div>
              <strong>{card.name}</strong>
              <span>{profile.label || card.rarity || "Carte"}</span>
            </article>
          );
        })}
      </div>

      <button className={styles.summaryClose} type="button" onClick={onClose}>
        Retour au Booster Lab
      </button>
    </main>
  );
}
