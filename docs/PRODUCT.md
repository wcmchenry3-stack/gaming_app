# BC Games — Product Principles

## North Star

A calm, no-BS arcade of simple games designed for short moments — not long sessions.

## Product Rules (Non-Negotiable)

- Start playing in under 3 seconds
- No penalty for leaving mid-game
- No interruptions during gameplay
- No forced login — gameplay is never gated behind authentication
- Clean, minimal UI

## Never Build

- Countdown timers, time pressure, or cooldowns — informational elapsed displays (e.g. a stopwatch that pauses on background and stops on win, with no scoring impact) are allowed
- Grind loops
- Behavior manipulation (dark patterns)
- Forced ads to continue playing
- Complex user profiles
- Multiplayer
- Subscriptions
- Cross-game social leaderboards
- Advanced analytics beyond error reporting

## Game Roster Strategy

- Use the app yourself daily. Notice which game you open most and which feels frictionless.
- Add one game at a time.

## V1 Game Classification

| Game      | Status        | Notes                     |
| --------- | ------------- | ------------------------- |
| Yacht     | Public        | Core game                 |
| Blackjack | Public        | Core game                 |
| 2048      | Public        | Core game                 |
| Ludo      | Beta (hidden) | Needs AI/animation polish |
| Cascade   | Beta (hidden) | Has collision/drop bugs   |

## Identity Tiers

| Tier | Description                 | Status                 |
| ---- | --------------------------- | ---------------------- |
| 0    | Anonymous (UUID session)    | Done — ships with V1   |
| 1    | Optional name input         | Post-launch            |
| 2    | Google/Apple SSO (optional) | Post-launch — see #144 |

Login is always optional. Never block gameplay behind it. Prompt only after the user has played:

- "Save your progress?" triggers optional login
- "Try new games early?" triggers optional login

## Monetization (NOT in V1)

- **Phase 1 (launch):** Completely free, no ads, no payments
- **Phase 2 (after usage data):** Light ads between sessions only + $2.99 Remove Ads IAP
- **Optional:** $4.99 Premium (themes, etc.)
- **Golden rule:** Never remove free functionality. Only add paid enhancements.

## Beta Testing

- Use feature flags (#142) to gate beta games, not TestFlight
- TestFlight reserved for unstable features or major changes
- Initial beta testers: project owner + family
- Messaging: "Want to try new games early?"
