import type { DeckTheme } from "../types";
import ClassicCardFace from "./ClassicCardFace";

const ClassicDeck: DeckTheme = {
  id: "classic",
  name: "Classic",
  CardFace: ClassicCardFace,
};

export default ClassicDeck;
