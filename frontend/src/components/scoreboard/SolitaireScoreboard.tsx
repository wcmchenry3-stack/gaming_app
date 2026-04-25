import React from "react";
import { useTranslation } from "react-i18next";
import HeroStatScoreboard from "./HeroStatScoreboard";
import type { SolitaireScoreboardSnapshot } from "../../game/solitaire/SolitaireScoreboardContext";

interface Props {
  snapshot: SolitaireScoreboardSnapshot;
}

export default function SolitaireScoreboard({ snapshot }: Props) {
  const { t } = useTranslation("solitaire");

  const heroValue = snapshot.hasGame ? String(snapshot.moves) : "—";
  const heroSub = snapshot.hasGame
    ? t("scoreboard.heroSub", {
        moves: snapshot.moves,
        foundations: snapshot.foundationsComplete,
      })
    : t("scoreboard.heroSubEmpty");

  const cards = [
    { key: "bestTime", label: t("scoreboard.bestTime"), value: "—", accent: true },
    { key: "bestMoves", label: t("scoreboard.bestMoves"), value: "—" },
    { key: "gamesPlayed", label: t("scoreboard.gamesPlayed"), value: "—" },
    { key: "gamesWon", label: t("scoreboard.gamesWon"), value: "—" },
  ] as const;

  return (
    <HeroStatScoreboard
      heroLabel={t("scoreboard.heroLabel")}
      heroValue={heroValue}
      heroSub={heroSub}
      cards={cards}
    />
  );
}
