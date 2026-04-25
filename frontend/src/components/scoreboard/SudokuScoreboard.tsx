import React from "react";
import { useTranslation } from "react-i18next";
import HeroStatScoreboard from "./HeroStatScoreboard";
import type { SudokuScoreboardSnapshot } from "../../game/sudoku/SudokuScoreboardContext";

interface Props {
  snapshot: SudokuScoreboardSnapshot;
}

function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export default function SudokuScoreboard({ snapshot }: Props) {
  const { t } = useTranslation("sudoku");

  const heroValue = snapshot.hasGame ? formatElapsed(snapshot.elapsed) : "—";
  const heroSub = snapshot.hasGame
    ? t("scoreboard.heroSub", {
        difficulty: t(`difficulty.${snapshot.difficulty}`),
        errors: snapshot.errorCount,
      })
    : t("scoreboard.heroSubEmpty");

  const cards = [
    { key: "easyBestTime", label: t("scoreboard.easyBestTime"), value: "—", accent: true },
    { key: "mediumBestTime", label: t("scoreboard.mediumBestTime"), value: "—" },
    { key: "hardBestTime", label: t("scoreboard.hardBestTime"), value: "—" },
    { key: "gamesSolved", label: t("scoreboard.gamesSolved"), value: "—" },
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
