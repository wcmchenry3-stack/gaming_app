import fruitVerticesRaw from "../../../assets/fruit-vertices.json";
import planetVerticesRaw from "../../../assets/planet-vertices.json";

export type VertexPoint = { x: number; y: number };

/**
 * Return normalized convex-hull vertices for a fruit, or null if the set
 * has no PNG assets (e.g. gems) or fewer than 3 vertices were extracted.
 *
 * @param setId   - FruitSet.id ("fruits" | "planets" | "gems" | ...)
 * @param nameKey - filename stem, lowercase (e.g. "cherry", "grapes")
 *
 * Vertices are centroid-centred and scaled so max distance from origin = 1.0.
 * Multiply each component by def.radius to get world-space coordinates.
 */
export function getVerticesForFruit(
  setId: string,
  nameKey: string,
): VertexPoint[] | null {
  let map: Record<string, [number, number][]> | null = null;
  if (setId === "fruits") map = fruitVerticesRaw;
  else if (setId === "planets") map = planetVerticesRaw;
  else return null; // gems or unknown set → circle fallback

  const raw = map[nameKey];
  if (!raw || raw.length < 3) return null;
  return raw.map(([x, y]) => ({ x, y }));
}
