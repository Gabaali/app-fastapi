"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import styles from "./Labyrinth.module.css";

type Tile = { x: number; y: number; kind: string; visited: boolean; reachable: boolean };
type Upgrade = { key: string; name: string; description: string; level: number; max_level: number; cost: number };
type Game = {
  version: number; balance_coins: number; entry_cost: number; completed: number;
  last_event: string; upgrade_options: Upgrade[];
  probabilities: Record<"treasure" | "trap" | "empty" | "shrine", number>;
  run: null | { x: number; y: number; status: string; health: number; energy: number; loot: number; blessing: number; tiles: Tile[] };
};
const icons: Record<string, string> = { unknown: "", wall: "", path: "?", entrance: "⌂", exit: "⚑", treasure: "◆", trap: "✕", shrine: "✦", empty: "·" };
const labels: Record<string, string> = { unknown: "Inconnue", wall: "Mur", path: "Passage à explorer", entrance: "Entrée", exit: "Sortie", treasure: "Trésor découvert", trap: "Piège découvert", shrine: "Sanctuaire découvert", empty: "Couloir exploré" };
const outcomes = [{ key: "treasure", label: "Trésor", icon: "◆" }, { key: "trap", label: "Piège", icon: "✕" }, { key: "empty", label: "Couloir", icon: "·" }, { key: "shrine", label: "Sanctuaire", icon: "✦" }] as const;
const format = (value: number) => value.toLocaleString("fr-FR");

export default function LabyrinthPage() {
  const [game, setGame] = useState<Game | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setGame(await apiFetch<Game>("/api/labyrinth")); }
    catch (err) { setError(err instanceof Error ? err.message : "Impossible de charger la partie."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!game || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      setGame(await apiFetch<Game>("/api/labyrinth/action", {
        method: "POST", body: JSON.stringify({ action, expected_version: game.version, ...extra }),
      }));
    } catch (err) {
      // Reload after conflicts or a lost response: never repeat a reward action automatically.
      try { setGame(await apiFetch<Game>("/api/labyrinth")); } catch { /* Keep last known state. */ }
      setError(err instanceof Error ? err.message : "Action impossible.");
    } finally { pending.current = false; setBusy(false); }
  }
  const run = game?.run;
  const active = run?.status === "active";
  const explored = run?.tiles.filter(tile => tile.visited).length ?? 0;

  return <main className={styles.shell}>
    <header className={styles.header}>
      <Link className={styles.brand} href="/booster">TCG GAME <span> / EXPÉDITIONS</span></Link>
      <nav aria-label="Navigation"><Link href="/booster">Boosters</Link><Link href="/cartedex">Cartédex</Link><span className={styles.wallet}>{game ? format(game.balance_coins) : "—"} 🪙</span></nav>
    </header>
    <section className={styles.intro}>
      <p className={styles.eyebrow}>CHAQUE PAS EST UN CHOIX</p>
      <h1>Le Labyrinthe<span>des fortunes</span></h1>
      <p>Explore l’inconnu, remplis ton sac et choisis le bon moment pour rentrer.</p>
    </section>
    {error && <div className={styles.error} role="alert">{error} <button disabled={busy || loading} onClick={() => void load()}>Actualiser</button> <Link href="/login">Se connecter</Link></div>}
    {loading && !game && <p role="status">Chargement de ton expédition…</p>}
    {game && <div className={styles.layout}>
      <section className={styles.boardPanel} aria-label="Expédition">
        <div className={styles.boardHeader}><div><p className={styles.eyebrow}>EXPÉDITION {active ? "EN COURS" : "AU CAMP"}</p><h2>{active ? "Où vas-tu ensuite ?" : "L’inconnu t’attend"}</h2></div><span>{game.completed} sortie{game.completed > 1 ? "s" : ""} trouvée{game.completed > 1 ? "s" : ""}</span></div>
        {run ? <>
          <div className={styles.stats}>
            <div><span>VITALITÉ</span><strong>{"♥".repeat(run.health)}{"♡".repeat(3-run.health)}</strong></div>
            <div><span>ÉNERGIE</span><strong>{run.energy} / 24</strong></div>
            <div><span>BUTIN DU SAC</span><strong>{format(run.loot)} 🪙</strong></div>
          </div>
          <div className={styles.grid} role="group" aria-label="Labyrinthe, neuf lignes et neuf colonnes">
            {run.tiles.map(tile => {
              const current = tile.x === run.x && tile.y === run.y;
              return <button key={`${tile.x},${tile.y}`} type="button"
                className={`${styles.tile} ${styles[tile.kind] ?? ""} ${tile.reachable ? styles.reachable : ""} ${current ? styles.current : ""}`}
                disabled={!tile.reachable || busy || loading}
                aria-label={`${labels[tile.kind] ?? tile.kind}, ligne ${tile.y+1}, colonne ${tile.x+1}${current ? ", ta position" : ""}${tile.reachable ? ", accessible" : ""}`}
                onClick={() => void act("move", { x: tile.x, y: tile.y })}>{current ? "●" : icons[tile.kind]}</button>;
            })}
          </div>
          <div className={styles.legend}><span>● Ta position</span><span>? À explorer</span><span>⚑ Sortie</span><span>{explored} tuiles explorées</span></div>
        </> : <div className={styles.emptyBoard}><div>⌘</div><h3>Un nouveau chemin à chaque départ</h3><p>Un labyrinthe aléatoire, trois cœurs, et 24 tuiles à explorer. Les passages voisins se dévoilent à chaque pas.</p></div>}
        <div className={styles.event} role="status" aria-live="polite">{game.last_event}</div>
        <div className={styles.actions}>
          {active ? <button className={styles.primary} disabled={busy || loading} onClick={() => void act("retreat")}>Rentrer au camp · sécuriser {format(run?.loot ?? 0)} 🪙</button> : <button className={styles.primary} disabled={busy || loading || game.balance_coins < game.entry_cost} onClick={() => void act("start")}>Nouvelle expédition · {game.entry_cost} 🪙</button>}
          <p>{busy ? "Action en cours…" : active ? "Clique sur une tuile voisine éclairée. Les retours sur tes pas sont gratuits." : `La sortie rapporte 150 pièces de bonus. Frais de départ : ${game.entry_cost} pièces.`}</p>
        </div>
      </section>
      <aside className={styles.sidebar}>
        <section className={styles.panel}><p className={styles.eyebrow}>LE PROCHAIN PAS</p><h2>Tes probabilités</h2><p>Sur chaque nouvelle tuile de passage.</p>
          {outcomes.map(({ key, label, icon }) => <div key={key} className={styles.odds}><div><span>{icon} {label}</span><strong>{game.probabilities[key]} %</strong></div><div className={styles.track}><div className={styles[key]} style={{ width: `${game.probabilities[key]}%` }} /></div></div>)}
          {!!run?.blessing && active && <p className={styles.blessing}>✦ Bénédiction : encore {run.blessing} tuile{run.blessing > 1 ? "s" : ""}.</p>}
        </section>
        <section className={styles.panel}><p className={styles.eyebrow}>PRÉPARE TON PROCHAIN VOYAGE</p><h2>Améliorations permanentes</h2><p>{active ? "Disponibles à ton retour au camp." : "Investis tes pièces pour les prochaines expéditions."}</p>
          {game.upgrade_options.map(upgrade => <div className={styles.upgrade} key={upgrade.key}><div><h3>{upgrade.name}</h3><span>Niv. {upgrade.level} / {upgrade.max_level}</span></div><p>{upgrade.description}</p><button disabled={busy || loading || active || upgrade.level === upgrade.max_level || game.balance_coins < upgrade.cost} onClick={() => void act("upgrade", { upgrade: upgrade.key })}>{upgrade.level === upgrade.max_level ? "Niveau maximal" : `Améliorer · ${format(upgrade.cost)} 🪙`}</button></div>)}
        </section>
      </aside>
    </div>}
    <section className={styles.rules}><h2>Les règles du voyage</h2><p>Un trésor donne entre 25 et 70 pièces avant bonus. Un piège retire un cœur et 25 % du butin du sac avant protection. À zéro cœur, tout le sac est perdu. Le sanctuaire augmente de 10 points la chance de trésor et réduit autant celle d’un piège pendant trois nouvelles tuiles. À zéro énergie, tu peux encore rentrer au camp. Ton portefeuille reçoit le butin uniquement au retour ou à la sortie.</p></section>
  </main>;
}
