import React from "react";
import { useTranslation } from "react-i18next";
import HeroStatScoreboard from "./HeroStatScoreboard";
import type { Twenty48ScoreboardSnapshot } from "../../game/twenty48/Twenty48ScoreboardContext";

interface Props {
  snapshot: Twenty48ScoreboardSnapshot;
}

export default function Twenty48Scoreboard({ snapshot }: Props) {
  const { t } = useTranslation("twenty48");

  const heroValue = snapshot.hasGame ? snapshot.score.toLocaleString("en-US") : "—";
  const heroSub = snapshot.hasGame
    ? t("scoreboard.heroSub", { bestTile: snapshot.bestTile, moves: snapshot.moveCount })
    : t("scoreboard.heroSubEmpty");

  const cards = [
    {
      key: "bestScore",
      label: t("scoreboard.bestScore"),
      value: snapshot.bestScore > 0 ? snapshot.bestScore.toLocaleString("en-US") : "—",
      accent: true,
    },
    { key: "bestTile", label: t("scoreboard.bestTile"), value: "—" },
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
