const _apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
const BASE_URL = _apiUrl.startsWith("http") ? _apiUrl : `https://${_apiUrl}.onrender.com`;

export interface ScoreEntry {
  player_name: string;
  score: number;
}

export interface LeaderboardResponse {
  scores: ScoreEntry[];
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json();
}

export const fruitMergeApi = {
  submitScore: (player_name: string, score: number) =>
    request<ScoreEntry>("/fruit-merge/score", {
      method: "POST",
      body: JSON.stringify({ player_name, score }),
    }),

  getLeaderboard: () => request<LeaderboardResponse>("/fruit-merge/scores"),
};
