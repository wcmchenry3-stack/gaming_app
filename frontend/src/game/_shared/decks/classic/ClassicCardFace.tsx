import React from "react";
import { G, Path, Rect, Svg, Text as SvgText } from "react-native-svg";
import { rankLabel, RED_SUITS } from "../cardId";
import { SUIT_PATHS } from "./suitPaths";
import type { CardFaceProps } from "../types";

const FACE_LETTERS: Record<number, string> = { 11: "J", 12: "Q", 13: "K" };

export default function ClassicCardFace({
  suit,
  rank,
  width,
  height,
  faceDown,
  cardBg,
  cardBgBack,
  border,
  textColor,
  redSuitColor,
}: CardFaceProps) {
  const r = 8; // border radius

  if (faceDown) {
    return (
      <Svg width={width} height={height}>
        <Rect x={0} y={0} width={width} height={height} rx={r} fill={cardBgBack} />
        <Rect
          x={1}
          y={1}
          width={width - 2}
          height={height - 2}
          rx={r - 1}
          stroke={border}
          strokeWidth={1}
          fill="none"
        />
        {/* Diamond-grid back pattern */}
        <G opacity={0.25}>
          {Array.from({ length: 8 }, (_, i) => (
            <Path
              key={i}
              d={`M ${(i - 2) * 14} 0 L ${(i + 2) * 14} ${height}`}
              stroke={border}
              strokeWidth={1}
            />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <Path
              key={`h${i}`}
              d={`M 0 ${(i - 2) * 14} L ${width} ${(i + 2) * 14}`}
              stroke={border}
              strokeWidth={1}
            />
          ))}
        </G>
      </Svg>
    );
  }

  const isRed = RED_SUITS.has(suit);
  const suitColor = isRed ? redSuitColor : textColor;
  const rl = rankLabel(rank);
  const faceLabel = FACE_LETTERS[rank];
  const cornerFontSize = Math.max(10, Math.round(width * 0.24));
  const smallSuitSize = Math.max(8, Math.round(width * 0.18));
  const cx = width / 2;
  const cy = height / 2;

  // Centre content scales with card size
  const suitViewSize = Math.round(Math.min(width, height) * 0.52);
  const suitX = cx - suitViewSize / 2;
  const suitY = cy - suitViewSize / 2;

  return (
    <Svg width={width} height={height}>
      {/* Card face */}
      <Rect x={0} y={0} width={width} height={height} rx={r} fill={cardBg} />
      <Rect
        x={1}
        y={1}
        width={width - 2}
        height={height - 2}
        rx={r - 1}
        stroke={border}
        strokeWidth={1}
        fill="none"
      />

      {/* Top-left corner: rank */}
      <SvgText
        x={5}
        y={cornerFontSize + 2}
        fontSize={cornerFontSize}
        fontWeight="700"
        fill={suitColor}
      >
        {rl}
      </SvgText>

      {/* Top-left corner: small suit */}
      <SvgText
        x={5}
        y={cornerFontSize + smallSuitSize + 4}
        fontSize={smallSuitSize}
        fill={suitColor}
      >
        {suit === "spades" ? "♠" : suit === "hearts" ? "♥" : suit === "diamonds" ? "♦" : "♣"}
      </SvgText>

      {/* Centre: suit path or face letter */}
      {faceLabel ? (
        <>
          {/* Double border for face cards */}
          <Rect
            x={6}
            y={height * 0.22}
            width={width - 12}
            height={height * 0.56}
            rx={4}
            stroke={border}
            strokeWidth={0.75}
            fill="none"
          />
          <SvgText
            x={cx}
            y={cy + suitViewSize * 0.28}
            fontSize={suitViewSize * 0.72}
            fontWeight="700"
            fill={suitColor}
            textAnchor="middle"
          >
            {faceLabel}
          </SvgText>
        </>
      ) : (
        <Svg x={suitX} y={suitY} width={suitViewSize} height={suitViewSize} viewBox="0 0 500 500">
          <Path d={SUIT_PATHS[suit]} fill={suitColor} />
        </Svg>
      )}

      {/* Bottom-right corner (rotated 180°) */}
      <G rotation={180} origin={`${cx}, ${cy}`}>
        <SvgText
          x={5}
          y={cornerFontSize + 2}
          fontSize={cornerFontSize}
          fontWeight="700"
          fill={suitColor}
        >
          {rl}
        </SvgText>
        <SvgText
          x={5}
          y={cornerFontSize + smallSuitSize + 4}
          fontSize={smallSuitSize}
          fill={suitColor}
        >
          {suit === "spades" ? "♠" : suit === "hearts" ? "♥" : suit === "diamonds" ? "♦" : "♣"}
        </SvgText>
      </G>
    </Svg>
  );
}
