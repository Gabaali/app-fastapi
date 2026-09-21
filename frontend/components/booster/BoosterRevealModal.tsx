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

  const tiltRef = useRef<HTMLDivElement | null>(null);
  const timersRef = useRef<number[]>([]);

  const current = sortedCards[index];
  const profile = useMemo(
    () => (current ? getRevealProfile(current) : null),
    [current]
  );

  const clearTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  useEffect(() => {
    if (!open) return;

    setScene("pack");
    setPackOpening(false);
    setIndex(0);
    setRevealing(false);
    setRevealed(false);
    setSuspense(false);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      clearTimers();
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    return () => clearTimers();
  }, []);

  // Révélation automatique :
  // - la première carte se révèle dès que le booster est ouvert ;
  // - les suivantes se révèlent dès que l'utilisateur clique sur
  //   "Carte suivante", sans clic supplémentaire sur la carte.
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
    setSuspense(
      profile.suspenseMs > 0
    );

    let revealInfoTimer:
      number | undefined;

    let finishTimer:
      number | undefined;

    const startTimer =
      window.setTimeout(() => {
        setSuspense(false);
        setRevealing(true);

        // Common / Uncommon :
        // apparition simple, infos presque immédiates.
        //
        // Cartes avec rotation :
        // les infos apparaissent dès que la face avant
        // devient réellement visible.
        const infoDelay =
          profile.rank <= 20
            ? 100
            : Math.max(
                180,
                Math.round(
                  profile.durationMs * 0.52
                )
              );

        revealInfoTimer =
          window.setTimeout(() => {
            setRevealed(true);
          }, infoDelay);

        // Les effets continuent éventuellement après
        // l'apparition des infos.
        finishTimer =
          window.setTimeout(() => {
            setRevealing(false);
          }, profile.durationMs);
      }, 80 + profile.suspenseMs);

    return () => {
      window.clearTimeout(
        startTimer
      );

      if (
        revealInfoTimer !== undefined
      ) {
        window.clearTimeout(
          revealInfoTimer
        );
      }

      if (
        finishTimer !== undefined
      ) {
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
  ]);

  if (!open || !current || !profile) return null;

  const resetCardState = () => {
    clearTimers();
    setRevealing(false);
    setRevealed(false);
    setSuspense(false);
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
      setScene("summary");
      return;
    }

    clearTimers();
    resetTilt();

    // React groupe ces changements :
    // l'ancienne carte est retirée directement,
    // la suivante est créée face cachée.
    setRevealing(false);
    setRevealed(false);
    setSuspense(false);

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
    "--duration": `${profile.durationMs}ms`,
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
          </section>

          <section className={styles.centerStage}>
            <Aura profile={profile} active={revealing || revealed} />

            {profile.shockwave && revealing ? (
              <>
                <div className={`${styles.shockwave} ${styles.shockwaveOne}`} />
                <div className={`${styles.shockwave} ${styles.shockwaveTwo}`} />
              </>
            ) : null}

            {profile.flash && revealing ? <div className={styles.flash} /> : null}

            {suspense ? (
              <div className={styles.suspenseOverlay}>
                <div className={styles.suspensePulse} />
                <span>...</span>
              </div>
            ) : null}

            {(revealing || revealed) && profile.particles > 0 ? (
              <Particles
                key={`${cardId(current, index)}-${revealing ? "reveal" : "hold"}`}
                profile={profile}
              />
            ) : null}

            <div
              key={cardId(current, index)}
              ref={tiltRef}
              className={`${styles.tiltFrame} ${revealed ? styles.inspectable : ""}`}
              onPointerMove={onPointerMove}
              onPointerLeave={resetTilt}
            >
              <div
                className={styles.cardButton}
                aria-label={revealed ? current.name : "Révélation automatique de la carte"}
              >
              <div
                    className={
                      profile.rank <= 20
                        ? `${styles.card3d} ${styles.cardBasic} ${
                            revealing || revealed
                              ? styles.cardBasicVisible
                              : ""
                          }`
                        : `${styles.card3d} ${
                            revealing || revealed
                              ? styles.cardFlipped
                              : ""
                          }`
                    }
                >
                  <div className={`${styles.cardFace} ${styles.cardBack}`}>
                    <div className={styles.backFrame}>
                      <div className={styles.backOrb} />
                      <span className={styles.backSmall}>TCG</span>
                      <strong>BOOSTER LAB</strong>
                      <span className={styles.tapHint}>
                        {suspense ? "..." : "RÉVÉLATION..."}
                      </span>
                    </div>
                  </div>

                  <div className={`${styles.cardFace} ${styles.cardFront}`}>
                    <CardArtwork card={current} />

                    {profile.holo ? (
                      <div className={styles.holo} aria-hidden="true" />
                    ) : null}

                    {revealed && profile.rank >= 70 ? (
                      <div className={styles.edgeGlow} aria-hidden="true" />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.mobileMeta}>
              <strong>{revealed ? current.name : "Carte mystère"}</strong>
              {revealed ? <span>{cardDetails(current)}</span> : null}
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
  setCode,
  opening,
  onOpen,
}: {
  game: string;
  setCode?: string;
  opening: boolean;
  onOpen: () => void;
}) {
  return (
    <main className={styles.packScene}>
      <div className={styles.packAura} />

      <button
        type="button"
        className={`${styles.packButton} ${opening ? styles.packOpening : ""}`}
        onClick={onOpen}
        disabled={opening}
      >
        <div className={`${styles.packHalf} ${styles.packTop}`}>
          <div className={styles.packFoil} />
        </div>

        <div className={`${styles.packHalf} ${styles.packBottom}`}>
          <div className={styles.packFoil} />
        </div>

        <div className={styles.packContent}>
          <span className={styles.packKicker}>TCG GAME</span>
          <strong>{game}</strong>
          <span>{setCode || "BOOSTER"}</span>
          <div className={styles.packLine} />
          <small>{opening ? "OUVERTURE..." : "TOUCHER POUR OUVRIR"}</small>
        </div>

        <div className={styles.tearLine} />
      </button>

      <p className={styles.packInstruction}>
        Les cartes seront révélées du bulk vers les hits.
      </p>
    </main>
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
