"use client";

import {
  getBoosterImage,
} from "@/lib/tcg-assets";

type Props = {
  game: string;
  setCode: string;
  disabled?: boolean;
  opening?: boolean;
  onOpen: () => void;
};

export default function BoosterPackPreview({
  game,
  setCode,
  disabled = false,
  opening = false,
  onOpen,
}: Props) {
  const boosterImage =
    getBoosterImage(
      game,
      setCode
    );

  return (
    <button
      type="button"
      className="boosterPackPreview"
      onClick={onOpen}
      disabled={disabled}
      aria-label={`Ouvrir le booster ${setCode}`}
    >
      <div className="boosterPackGlow" />

      {boosterImage ? (
        <img
          src={boosterImage}
          alt={`Booster ${setCode}`}
          className="boosterPackImage"
          draggable={false}
        />
      ) : (
        <div className="boosterPackFallback">
          <strong>
            {setCode}
          </strong>
        </div>
      )}

      <div className="boosterPackHint">
        {opening
          ? "OUVERTURE..."
          : "TOUCHER POUR OUVRIR"}
      </div>
    </button>
  );
}