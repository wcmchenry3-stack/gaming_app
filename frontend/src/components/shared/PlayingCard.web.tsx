/**
 * PlayingCard — web implementation using the cardmeister <playing-card> custom element.
 *
 * Cardmeister is public domain (The Unlicense). Script is served from
 * /elements.cardmeister.full.js (frontend/public/) and loaded once on first render.
 *
 * Card attributes driven by the active theme so cards look correct in dark mode:
 *   cardcolor  → colors.surface   (dark slate card face)
 *   suitcolor  → white for ♠/♣, theme red for ♥/♦
 *   backcolor  → colors.surfaceAlt
 *   bordercolor→ colors.border (or colors.accent when highlighted)
 *
 * To swap the deck: replace this file with a different web implementation that
 * accepts the same PlayingCardProps interface.
 */

import React, { useEffect, useRef } from "react";
import { useTheme } from "../../theme/ThemeContext";
import { type PlayingCardProps } from "./PlayingCard";
import { cardmeisterId } from "./cardId";

// Load the cardmeister script once per page load.
let scriptInjected = false;
function ensureCardmeisterScript() {
  if (scriptInjected || typeof document === "undefined") return;
  scriptInjected = true;
  if (!document.getElementById("cardmeister-script")) {
    const s = document.createElement("script");
    s.id = "cardmeister-script";
    s.src = "/elements.cardmeister.full.js";
    document.head.appendChild(s);
  }
}

export default function PlayingCard({
  suit,
  rank,
  faceDown = false,
  width = 52,
  height = 74,
  rotation = 0,
  highlighted = false,
  disabled = false,
  onPress,
  accessibilityLabel,
}: PlayingCardProps) {
  const { colors } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ensureCardmeisterScript();
  }, []);

  // Rebuild the <playing-card> element whenever props change.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const el = document.createElement("playing-card") as HTMLElement;

    if (faceDown) {
      el.setAttribute("rank", "0");
      el.setAttribute("backcolor", colors.surfaceAlt);
    } else {
      el.setAttribute("cid", cardmeisterId(suit, rank));
      el.setAttribute("cardcolor", colors.surface);
      // suitcolor: comma-separated spades,hearts,diamonds,clubs
      el.setAttribute("suitcolor", `${colors.text},${colors.error},${colors.error},${colors.text}`);
      el.setAttribute("rankcolor", colors.text);
    }

    el.setAttribute("bordercolor", highlighted ? colors.accent : colors.border);
    el.setAttribute("borderradius", "8");
    el.style.width = "100%";
    el.style.height = "100%";
    el.style.display = "block";

    container.innerHTML = "";
    container.appendChild(el);
  }, [suit, rank, faceDown, highlighted, colors]);

  const rotateStyle = rotation !== 0 ? `rotate(${rotation}deg)` : undefined;

  return (
    <div
      ref={containerRef}
      onClick={disabled ? undefined : onPress}
      role={onPress ? "button" : "img"}
      aria-label={accessibilityLabel}
      aria-disabled={disabled || undefined}
      style={{
        width,
        height,
        margin: 4,
        cursor: onPress && !disabled ? "pointer" : undefined,
        opacity: disabled ? 0.4 : 1,
        transform: rotateStyle,
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}
