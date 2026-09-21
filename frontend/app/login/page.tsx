"use client";

import {
  FormEvent,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/client";


export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState("");

  async function login(
    event: FormEvent,
  ) {
    event.preventDefault();

    setBusy(true);
    setMessage("");

    const { error } =
      await supabase.auth
        .signInWithPassword({
          email,
          password,
        });

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/booster");
  }

  async function signup() {
    setBusy(true);
    setMessage("");

    const { error } =
      await supabase.auth.signUp({
        email,
        password,
      });

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(
      "Compte créé. Connecte-toi ou confirme l'email selon la configuration Supabase.",
    );
  }

  return (
    <main className="centerPage">
      <form
        className="panel authPanel"
        onSubmit={login}
      >
        <div className="eyebrow">
          TCG GAME
        </div>

        <h1>Connexion</h1>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            autoComplete="email"
            required
          />
        </label>

        <label>
          Mot de passe
          <input
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            autoComplete="current-password"
            minLength={6}
            required
          />
        </label>

        <button
          className="primaryButton"
          disabled={busy}
          type="submit"
        >
          {busy
            ? "Connexion..."
            : "Se connecter"}
        </button>

        <button
          className="secondaryButton"
          disabled={busy}
          type="button"
          onClick={signup}
        >
          Créer le compte
        </button>

        {message && (
          <p className="message">
            {message}
          </p>
        )}
      </form>
    </main>
  );
}
