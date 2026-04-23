import React from "react";
import {
  Defs,
  FeGaussianBlur,
  FeMerge,
  FeMergeNode,
  Filter,
  G,
  Path,
  Rect,
  Svg,
  Text as SvgText,
} from "react-native-svg";
import { rankLabel } from "../cardId";
import { SUIT_PATHS } from "../classic/suitPaths";
import type { CardFaceProps } from "../types";

// Neon palette — always dark, ignores ThemeContext light/dark mode.
const BG = "#0f172a";
const BG_BACK = "#070d1a";
const BORDER = "#334155";
const SPADES_CLUBS = "#e2e8f0";
const HEARTS = "#f43f5e";
const DIAMONDS = HEARTS;
const RANK_TEXT = "#f1f5f9";
const BACK_GRID = "#06b6d4";

const FACE_LETTERS: Record<number, string> = { 11: "J", 12: "Q", 13: "K" };

function suitColor(suit: string): string {
  if (suit === "hearts") return HEARTS;
  if (suit === "diamonds") return DIAMONDS;
  return SPADES_CLUBS;
}

function suitEmoji(suit: string): string {
  if (suit === "spades") return "♠";
  if (suit === "hearts") return "♥";
  if (suit === "diamonds") return "♦";
  return "♣";
}

// Shared neon glow — blur halo under the sharp source graphic.
function GlowDefs() {
  return (
    <Defs>
      <Filter id="neon-glow" x="-30%" y="-30%" width="160%" height="160%">
        <FeGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
        <FeMerge>
          <FeMergeNode in="blur" />
          <FeMergeNode in="SourceGraphic" />
        </FeMerge>
      </Filter>
    </Defs>
  );
}

export default function NeonCardFace({
  suit,
  rank,
  width,
  height,
  faceDown,
  borderHighlight,
}: CardFaceProps) {
  const r = 8;

  if (faceDown) {
    return (
      <Svg width={width} height={height}>
        <Rect x={0} y={0} width={width} height={height} rx={r} fill={BG_BACK} />
        <Rect
          x={1}
          y={1}
          width={width - 2}
          height={height - 2}
          rx={r - 1}
          stroke={BORDER}
          strokeWidth={1}
          fill="none"
        />
        {/* Neon diamond-grid back */}
        <G opacity={0.35}>
          {Array.from({ length: 8 }, (_, i) => (
            <Path
              key={i}
              d={`M ${(i - 2) * 14} 0 L ${(i + 2) * 14} ${height}`}
              stroke={BACK_GRID}
              strokeWidth={1}
            />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <Path
              key={`h${i}`}
              d={`M 0 ${(i - 2) * 14} L ${width} ${(i + 2) * 14}`}
              stroke={BACK_GRID}
              strokeWidth={1}
            />
          ))}
        </G>
      </Svg>
    );
  }

  const color = suitColor(suit);
  const rl = rankLabel(rank);
  const faceLabel = FACE_LETTERS[rank];
  const cornerFontSize = Math.max(10, Math.round(width * 0.24));
  const smallSuitSize = Math.max(8, Math.round(width * 0.18));
  const cx = width / 2;
  const cy = height / 2;
  const suitViewSize = Math.round(Math.min(width, height) * 0.52);
  const suitX = cx - suitViewSize / 2;
  const suitY = cy - suitViewSize / 2;

  return (
    <Svg width={width} height={height}>
      <GlowDefs />

      {/* Card face — always dark */}
      <Rect x={0} y={0} width={width} height={height} rx={r} fill={BG} />
      <Rect
        x={1}
        y={1}
        width={width - 2}
        height={height - 2}
        rx={r - 1}
        stroke={borderHighlight ?? BORDER}
        strokeWidth={1}
        fill="none"
      />

      {/* Top-left corner */}
      <SvgText
        x={5}
        y={cornerFontSize + 2}
        fontSize={cornerFontSize}
        fontWeight="700"
        fill={RANK_TEXT}
      >
        {rl}
      </SvgText>
      <SvgText x={5} y={cornerFontSize + smallSuitSize + 4} fontSize={smallSuitSize} fill={color}>
        {suitEmoji(suit)}
      </SvgText>

      {/* Centre: suit path with glow or face letter */}
      {faceLabel ? (
        <>
          <Rect
            x={6}
            y={height * 0.22}
            width={width - 12}
            height={height * 0.56}
            rx={4}
            stroke={BORDER}
            strokeWidth={0.75}
            fill="none"
          />
          <SvgText
            x={cx}
            y={cy + suitViewSize * 0.28}
            fontSize={suitViewSize * 0.72}
            fontWeight="700"
            fill={color}
            textAnchor="middle"
            filter="url(#neon-glow)"
          >
            {faceLabel}
          </SvgText>
        </>
      ) : (
        <G transform={`translate(${suitX}, ${suitY}) scale(${suitViewSize / 500})`}>
          <Path d={SUIT_PATHS[suit]} fill={color} filter="url(#neon-glow)" />
        </G>
      )}

      {/* Bottom-right corner (rotated 180°) */}
      <G rotation={180} origin={`${cx}, ${cy}`}>
        <SvgText
          x={5}
          y={cornerFontSize + 2}
          fontSize={cornerFontSize}
          fontWeight="700"
          fill={RANK_TEXT}
        >
          {rl}
        </SvgText>
        <SvgText x={5} y={cornerFontSize + smallSuitSize + 4} fontSize={smallSuitSize} fill={color}>
          {suitEmoji(suit)}
        </SvgText>
      </G>
    </Svg>
  );
}
