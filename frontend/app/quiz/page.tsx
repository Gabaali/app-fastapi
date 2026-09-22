"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

import styles from "./Quiz.module.css";


type Difficulty = "easy" | "medium" | "hard";
type Category = "champions" | "monde";
type QuestionType = "qcm" | "direct";

type QuizQuestion = {
  id: string;
  type: QuestionType;
  question: string;
  choices: string[] | null;
  difficulty: Difficulty;
  reward_coins: number;
  category: Category;
  pool_exhausted: boolean;
};

type QuizAnswer = {
  correct: boolean;
  correct_answer: string;
  reward_coins: number;
  balance: number;
  reward_status:
    | "awarded"
    | "already_rewarded"
    | "already_attempted"
    | "daily_limit"
    | "wrong"
    | "none";
  daily_rewarded: number;
  daily_limit: number;
  source_label: string | null;
  source_url: string | null;
};

type QuizStats = {
  balance: number;
  daily_rewarded: number;
  daily_limit: number;
  daily_coins: number;
  daily_attempts: number;
  daily_correct: number;
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Facile",
  medium: "Intermédiaire",
  hard: "Difficile",
};

const CATEGORY_LABELS: Record<Category, string> = {
  champions: "Champions",
  monde: "Monde & factions",
};

export default function QuizPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [result, setResult] = useState<QuizAnswer | null>(null);
  const [stats, setStats] = useState<QuizStats | null>(null);
  const [answer, setAnswer] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [category, setCategory] = useState<Category | "">("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const loadStats = useCallback(async () => {
    const response = await apiFetch<QuizStats>("/api/quiz/stats");
    setStats(response);
  }, []);

  const loadQuestion = useCallback(async () => {
    setLoading(true);
    setError("");
    setResult(null);
    setAnswer("");

    const params = new URLSearchParams();
    if (difficulty) params.set("difficulty", difficulty);
    if (category) params.set("category", category);

    try {
      const response = await apiFetch<QuizQuestion>(
        `/api/quiz/question${params.size ? `?${params.toString()}` : ""}`,
      );
      setQuestion(response);
    } catch (err) {
      setQuestion(null);
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger une question.",
      );
    } finally {
      setLoading(false);
    }
  }, [difficulty, category]);

  useEffect(() => {
    async function boot() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.replace("/login");
        return;
      }

      try {
        await Promise.all([loadStats(), loadQuestion()]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Impossible de charger le quiz.",
        );
      }
    }

    boot();
  }, [loadQuestion, loadStats, router, supabase]);

  async function submit(value?: string) {
    if (!question || submitting || result) return;

    const finalAnswer = (value ?? answer).trim();
    if (!finalAnswer) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await apiFetch<QuizAnswer>("/api/quiz/answer", {
        method: "POST",
        body: JSON.stringify({
          question_id: question.id,
          answer: finalAnswer,
        }),
      });

      setAnswer(finalAnswer);
      setResult(response);
      setStats((current) => current ? {
        ...current,
        balance: response.balance,
        daily_rewarded: response.daily_rewarded,
        daily_limit: response.daily_limit,
        daily_coins: current.daily_coins + response.reward_coins,
        daily_attempts: current.daily_attempts + 1,
        daily_correct: current.daily_correct + (response.correct ? 1 : 0),
      } : current);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de valider la réponse.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  const progress = stats
    ? Math.min(100, (stats.daily_rewarded / stats.daily_limit) * 100)
    : 0;

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div>
          <span className={styles.eyebrow}>LORE LAB</span>
          <strong>Quiz Runeterra</strong>
        </div>

        <div className={styles.navActions}>
          <div className={styles.wallet}>
            {stats ? stats.balance.toLocaleString("fr-FR") : "—"} 🪙
          </div>
          <button type="button" className={styles.navButton} onClick={() => router.push("/booster")}>
            Boosters
          </button>
          <button type="button" className={styles.navButton} onClick={() => router.push("/cartedex")}>
            Cartédex
          </button>
          <button type="button" className={styles.navButton} onClick={logout}>
            Déconnexion
          </button>
        </div>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>GAGNE DES PIÈCES</span>
        <h1>Teste ton lore de Runeterra.</h1>
        <p>
          Réponds aux questions de lore pour créditer ton wallet. Les réponses sont
          vérifiées côté serveur, et une même question ne paie qu’une fois.
        </p>
      </section>

      <section className={styles.dashboard}>
        <div className={styles.statCard}>
          <span>Récompenses aujourd’hui</span>
          <strong>{stats ? `${stats.daily_rewarded}/${stats.daily_limit}` : "—"}</strong>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className={styles.statCard}>
          <span>Pièces gagnées aujourd’hui</span>
          <strong>{stats ? `+${stats.daily_coins.toLocaleString("fr-FR")} 🪙` : "—"}</strong>
        </div>
        <div className={styles.statCard}>
          <span>Bonnes réponses</span>
          <strong>
            {stats && stats.daily_attempts
              ? `${stats.daily_correct}/${stats.daily_attempts}`
              : "0"}
          </strong>
        </div>
      </section>

      <section className={styles.filters}>
        <label>
          Catégorie
          <select value={category} onChange={(event) => setCategory(event.target.value as Category | "")}>
            <option value="">Toutes</option>
            <option value="champions">Champions</option>
            <option value="monde">Monde & factions</option>
          </select>
        </label>

        <label>
          Difficulté
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty | "")}>
            <option value="">Toutes</option>
            <option value="easy">Facile</option>
            <option value="medium">Intermédiaire</option>
            <option value="hard">Difficile</option>
          </select>
        </label>

        <button type="button" className={styles.filterButton} onClick={loadQuestion} disabled={loading}>
          Nouvelle question
        </button>
      </section>

      {error ? <div className={styles.error}>{error}</div> : null}

      <section className={styles.quizCard}>
        {loading ? (
          <div className={styles.loading}>Chargement d’une question…</div>
        ) : question ? (
          <>
            <div className={styles.questionMeta}>
              <span>{CATEGORY_LABELS[question.category]}</span>
              <span>{DIFFICULTY_LABELS[question.difficulty]}</span>
              <strong>+{question.reward_coins} 🪙</strong>
            </div>

            <h2>{question.question}</h2>

            {question.pool_exhausted ? (
              <p className={styles.notice}>
                Tu as déjà répondu à tout le pool correspondant : cette question peut être rejouée,
                mais elle ne recréditera pas de pièces si elle a déjà été récompensée.
              </p>
            ) : null}

            {question.type === "qcm" ? (
              <div className={styles.choices}>
                {(question.choices ?? []).map((choice) => {
                  const isChosen = answer === choice;
                  const isCorrect = result && choice === result.correct_answer;
                  const isWrong = result && isChosen && !result.correct;

                  return (
                    <button
                      key={choice}
                      type="button"
                      className={`${styles.choice} ${isCorrect ? styles.choiceCorrect : ""} ${isWrong ? styles.choiceWrong : ""}`}
                      disabled={submitting || Boolean(result)}
                      onClick={() => {
                        setAnswer(choice);
                        submit(choice);
                      }}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
            ) : (
              <form className={styles.directForm} onSubmit={onSubmit}>
                <small className={styles.answerHint}>
                  Réponse libre : les mots-clés importants suffisent, inutile de recopier la formulation exacte.
                </small>
                <input
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="Ta réponse…"
                  autoComplete="off"
                  disabled={submitting || Boolean(result)}
                />
                <button type="submit" disabled={!answer.trim() || submitting || Boolean(result)}>
                  Valider
                </button>
              </form>
            )}

            {result ? (
              <div className={`${styles.result} ${result.correct ? styles.resultCorrect : styles.resultWrong}`}>
                <strong>{result.correct ? "Bonne réponse !" : "Raté."}</strong>
                <span>Réponse : {result.correct_answer}</span>
                {result.reward_status === "awarded" ? (
                  <span>+{result.reward_coins} pièces ajoutées à ton wallet.</span>
                ) : null}
                {result.reward_status === "already_rewarded" ? (
                  <span>Cette question avait déjà rapporté sa récompense.</span>
                ) : null}
                {result.reward_status === "already_attempted" ? (
                  <span>Seule la première tentative peut rapporter des pièces.</span>
                ) : null}
                {result.reward_status === "daily_limit" ? (
                  <span>Bonne réponse, mais ta limite de récompenses du jour est atteinte.</span>
                ) : null}
                {result.source_label ? (
                  <small>
                    Source : {result.source_url ? (
                      <a href={result.source_url} target="_blank" rel="noreferrer">{result.source_label}</a>
                    ) : result.source_label}
                  </small>
                ) : null}

                <button type="button" className={styles.nextButton} onClick={loadQuestion}>
                  Question suivante
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className={styles.loading}>Aucune question disponible.</div>
        )}
      </section>
    </main>
  );
}
