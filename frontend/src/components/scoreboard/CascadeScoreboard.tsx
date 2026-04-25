import React from "react";
import { useTranslation } from "react-i18next";
import HeroStatScoreboard from "./HeroStatScoreboard";
import type { CascadeScoreboardSnapshot } from "../../game/cascade/CascadeScoreboardContext";

interface Props {
  snapshot: CascadeScoreboardSnapshot;
}

export default function CascadeScoreboard({ snapshot }: Props) {
  const { t } = useTranslation("cascade");

  const heroValue = snapshot.hasGame ? snapshot.score.toLocaleString("en-US") : "—";
  const heroSub = snapshot.hasGame
    ? t("scoreboard.heroSub", { bestFruit: snapshot.bestFruitName, merges: snapshot.mergeCount })
    : t("scoreboard.heroSubEmpty");

  const cards = [
    {
      key: "bestScore",
      label: t("scoreboard.bestScore"),
      value: snapshot.bestScore > 0 ? snapshot.bestScore.toLocaleString("en-US") : "—",
      accent: true,
    },
    {
      key: "bestFruit",
      label: t("scoreboard.bestFruit"),
      value: snapshot.hasGame ? snapshot.bestFruitName : "—",
    },
    {
      key: "gamesPlayed",
      label: t("scoreboard.gamesPlayed"),
      value: snapshot.gamesPlayed > 0 ? String(snapshot.gamesPlayed) : "—",
    },
    {
      key: "totalMerges",
      label: t("scoreboard.totalMerges"),
      value: snapshot.mergeCount > 0 ? String(snapshot.mergeCount) : "—",
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
