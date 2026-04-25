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
    {
      key: "bestTile",
      label: t("scoreboard.bestTile"),
      value: snapshot.allTimeBestTile > 0 ? snapshot.allTimeBestTile.toLocaleString("en-US") : "—",
    },
    {
      key: "gamesPlayed",
      label: t("scoreboard.gamesPlayed"),
      value: snapshot.gamesPlayed > 0 ? snapshot.gamesPlayed.toLocaleString("en-US") : "—",
    },
    {
      key: "gamesWon",
      label: t("scoreboard.gamesWon"),
      value: snapshot.gamesWon > 0 ? snapshot.gamesWon.toLocaleString("en-US") : "—",
    },
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
