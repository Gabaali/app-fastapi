"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./BoosterRevealModal.module.css";

export default function BoosterFavoriteButton({ cardKey, name }: { cardKey: string; name: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) {
          if (!cancelled) setError("Connecte-toi pour enregistrer tes favoris.");
          return;
        }
        const { data, error: loadError } = await supabase.from("user_favorites")
          .select("card_key").eq("user_id", user.id).eq("card_key", cardKey).maybeSingle();
        if (loadError) throw loadError;
        if (cancelled) return;
        setUserId(user.id);
        setFavorite(!!data);
        setReady(true);
      } catch {
        if (!cancelled) setError("Impossible de charger les favoris. Vérifie leur configuration Supabase puis réessaie.");
      }
    }
    load();
    return () => { cancelled = true; };
  }, [supabase, cardKey]);

  async function toggle() {
    if (!ready || !userId || saving) return;
    setSaving(true);
    setError("");
    try {
      const { error: saveError } = favorite
        ? await supabase.from("user_favorites").delete().eq("user_id", userId).eq("card_key", cardKey)
        : await supabase.from("user_favorites").upsert(
          { user_id: userId, card_key: cardKey },
          { onConflict: "user_id,card_key", ignoreDuplicates: true }
        );
      if (saveError) throw saveError;
      setFavorite(!favorite);
    } catch {
      setError("Impossible de sauvegarder le favori. Réessaie dans un instant.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.boosterFavorite}>
      <button type="button" className={styles.boosterFavoriteButton}
        disabled={!ready || saving} aria-pressed={favorite}
        aria-label={`${favorite ? "Retirer des" : "Ajouter aux"} favoris : ${name}`}
        onClick={toggle}>
        {saving ? "Enregistrement…" : favorite ? "★ Retirer des favoris" : "☆ Ajouter aux favoris"}
      </button>
      {error ? <p className={styles.boosterFavoriteError} role="alert">{error}</p> : null}
    </div>
  );
}
