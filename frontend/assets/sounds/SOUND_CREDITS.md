# BC Arcade — Sound Asset Credits

Attribution is tracked here even when the license does not require it.
This protects against provenance loss if a source URL becomes unavailable.

## License snapshot policy

When adding a sound:

1. Record the source URL, license name, and the full license text or a permalink
   to an archived copy (e.g. web.archive.org snapshot).
2. Record the download date — licenses can change for _new_ assets; your copy
   is protected under the terms in effect on the download date.
3. Use a semantic filename (`<game>-<event>.mp3`) — never commit the raw
   download filename. Keep the original filename here for traceability.
4. If attribution is required (CC-BY etc.), add the credit string to
   `frontend/src/screens/CreditsScreen.tsx` (or equivalent) as well.

---

## Hearts

### hearts-moon-shot.mp3

- **Event:** Shooting the moon (player takes all 13 hearts + Queen of Spades)
- **Original filename:** u_it78ck90s3-orchestral-win-331233.mp3
- **Source URL:** https://pixabay.com/sound-effects/orchestral-win-331233/
- **Creator:** u_it78ck90s3 on Pixabay
- **License:** Pixabay Content License
- **License URL:** https://pixabay.com/service/license-summary/
- **Attribution required:** No
- **Commercial use:** Yes
- **Download date:** 2026-04-25
- **Notes:** Orchestral win fanfare. Replaced original "wow" sting for a more triumphant moon-shot feel.
- **Replaced:** kaykay12-wow-171498.mp3 (https://pixabay.com/sound-effects/wow-171498/) — swapped 2026-04-25

### hearts-broken.mp3

- **Event:** Hearts broken (first heart played into a trick)
- **Original filename:** lordsonny-rock-break-hard-184891.mp3
- **Source URL:** https://pixabay.com/sound-effects/rock-break-hard-184891/
- **Creator:** lordsonny on Pixabay
- **License:** Pixabay Content License
- **License URL:** https://pixabay.com/service/license-summary/
- **Attribution required:** No
- **Commercial use:** Yes
- **Download date:** 2026-04-25
- **Notes:** Hard rock-break crack (~0.5s). Represents the moment hearts shatter open.

### hearts-queen-of-spades.mp3

- **Event:** Queen of Spades played into a trick
- **Original filename:** phoenix_connection_brazil-surprise-sound-effect-99300.mp3
- **Source URL:** https://pixabay.com/sound-effects/surprise-sound-effect-99300/
- **Creator:** phoenix_connection_brazil on Pixabay
- **License:** Pixabay Content License
- **License URL:** https://pixabay.com/service/license-summary/
- **Attribution required:** No
- **Commercial use:** Yes
- **Download date:** 2026-04-25
- **Notes:** Ominous surprise sting (~0.75s). Signals the Black Maria landing.

---

## FreeCell (#844)

### freecell-card-place.mp3

- **Event:** Card placed to tableau, free cell, or foundation
- **Original filename:** `571575__el_boss__playing-card-deal-variation-3.wav` (preview lq)
- **Source URL:** https://freesound.org/people/el_boss/sounds/571575/
- **Creator:** el_boss on Freesound
- **License:** Creative Commons Zero (CC0)
- **License URL:** https://creativecommons.org/publicdomain/zero/1.0/
- **Attribution required:** No
- **Commercial use:** Yes
- **Download date:** 2026-04-25
- **Notes:** Louder variation of a card dealing onto a wooden table; suitable for any card placement event.

### freecell-supermove.mp3

- **Event:** Multi-card supermove (≥2 cards moved at once)
- **Original filename:** `60013__qubodup__whoosh.wav` (preview lq)
- **Source URL:** https://freesound.org/people/qubodup/sounds/60013/
- **Creator:** qubodup on Freesound
- **License:** Creative Commons Zero (CC0)
- **License URL:** https://creativecommons.org/publicdomain/zero/1.0/
- **Attribution required:** No
- **Commercial use:** Yes
- **Download date:** 2026-04-25
- **Notes:** Short air whoosh. Represents the satisfying sweep of multiple cards moving together.

### freecell-foundation-complete.mp3

- **Event:** All 13 cards of one suit placed on its foundation (fires up to 4×)
- **Original filename:** `456967__FunWithSound__success-resolution-video-game-sound-effect-strings.mp3` (preview lq)
- **Source URL:** https://freesound.org/people/FunWithSound/sounds/456967/
- **Creator:** FunWithSound on Freesound
- **License:** Creative Commons Zero (CC0)
- **License URL:** https://creativecommons.org/publicdomain/zero/1.0/
- **Attribution required:** No
- **Commercial use:** Yes
- **Download date:** 2026-04-25
- **Notes:** Strings success sting. Rising resolution tone, perfect for completing a suit.

### freecell-game-win.mp3

- **Event:** All 52 cards placed in foundations — game complete
- **Original filename:** `466133__humanoide9000__victory-fanfare.mp3` (preview lq)
- **Source URL:** https://freesound.org/people/humanoide9000/sounds/466133/
- **Creator:** humanoide9000 on Freesound
- **License:** Creative Commons Attribution 4.0 (CC-BY 4.0)
- **License URL:** https://creativecommons.org/licenses/by/4.0/
- **Attribution required:** Yes — credit "humanoide9000 on Freesound"
- **Commercial use:** Yes (with attribution)
- **Download date:** 2026-04-25
- **Notes:** Short victory fanfare. Triumphant conclusion to a completed FreeCell game.

### freecell-invalid-move.mp3

- **Event:** Move rejected — wrong card, full free cell, or supermove limit exceeded
- **Original filename:** `493163__Breviceps__buzzer-wrong-answer-error.mp3` (preview lq)
- **Source URL:** https://freesound.org/people/Breviceps/sounds/493163/
- **Creator:** Breviceps on Freesound
- **License:** Creative Commons Zero (CC0)
- **License URL:** https://creativecommons.org/publicdomain/zero/1.0/
- **Attribution required:** No
- **Commercial use:** Yes
- **Download date:** 2026-04-25
- **Notes:** Short buzzer for wrong answer / error. Signals an invalid move without being jarring.

---

## Star Swarm (#803)

### starswarm-laser.ogg, starswarm-chargeshot.ogg, starswarm-explosion.ogg, starswarm-gameover.ogg, starswarm-waveclear.ogg

_(Previously placed — provenance to be confirmed)_

### starswarm-playerhit.ogg

- **Event:** Player ship takes a hit (life lost, not game over)
- **Original filename:** `forceField_000.ogg`
- **Source:** Kenney Sci-Fi Sounds v1.0 (www.kenney.nl)
- **License:** Creative Commons Zero (CC0)
- **License URL:** https://creativecommons.org/publicdomain/zero/1.0/
- **Attribution required:** No
- **Commercial use:** Yes
- **Download date:** 2026-04-26
- **Notes:** Force-field deflection sound. Signals a shield/hull hit without sounding like a full explosion.

### starswarm-challengingstage.ogg

- **Event:** Challenging Stage phase begins
- **Original filename:** `phaserUp5.ogg`
- **Source:** Kenney Digital Audio (www.kenney.nl)
- **License:** Creative Commons Zero (CC0)
- **License URL:** https://creativecommons.org/publicdomain/zero/1.0/
- **Attribution required:** No
- **Commercial use:** Yes
- **Download date:** 2026-04-26
- **Notes:** Rising phaser sting. Signals the start of the bonus Challenging Stage wave.

### starswarm-bg-1.mp3 — starswarm-bg-4.mp3

- **Event:** Background music (looping ambient track, one chosen at random per game)
- **Original filenames:**
  - `audiopapkin-ambient-soundscapes-003-space-atmosphere-303242.mp3` → bg-1
  - `audiopapkin-ambient-soundscapes-001-space-atmosphere-303246.mp3` → bg-2
  - `audiopapkin-ambient-soundscapes-004-space-atmosphere-303243.mp3` → bg-3
  - `audiopapkin-ambient-soundscapes-007-space-atmosphere-304974.mp3` → bg-4
- **Source URL:** https://pixabay.com/users/audiopapkin-42202696/ (Pixabay)
- **Creator:** audiopapkin on Pixabay
- **License:** Pixabay Content License
- **License URL:** https://pixabay.com/service/license-summary/
- **Attribution required:** No
- **Commercial use:** Yes
- **Download date:** 2026-04-26
- **Notes:** Ambient space-atmosphere soundscapes. Played at 20% volume (BG_VOLUME = 0.2) looped.
  File sizes are 4.4–6.1 MB each — exceed the 500 KB spec target. Compress with ffmpeg if needed:
  `ffmpeg -i starswarm-bg-N.mp3 -b:a 32k starswarm-bg-N-compressed.mp3`

---

## Yacht (#827)

### yacht-dice-roll.ogg

- **Event:** Dice rolled (every roll action)
- **Original filename:** `dice-shake-1.ogg` from Kenney Casino Audio 1.1
- **Source URL:** https://kenney.nl/assets/casino-audio
- **Creator:** Kenney Vleugels (Kenney.nl)
- **License:** Creative Commons Zero (CC0)
- **License URL:** https://creativecommons.org/publicdomain/zero/1.0/
- **Attribution required:** No
- **Commercial use:** Yes
- **Download date:** 2026-04-26
- **Notes:** Dice shaking sound from the Kenney Casino Audio pack.

### yacht-die-hold.ogg

- **Event:** Die toggled hold / release
- **Original filename:** `chip-lay-1.ogg` from Kenney Casino Audio 1.1
- **Source URL:** https://kenney.nl/assets/casino-audio
- **Creator:** Kenney Vleugels (Kenney.nl)
- **License:** Creative Commons Zero (CC0)
- **License URL:** https://creativecommons.org/publicdomain/zero/1.0/
- **Attribution required:** No
- **Commercial use:** Yes
- **Download date:** 2026-04-26
- **Notes:** Short chip-place click used as a satisfying toggle sound.

### yacht-yacht.mp3

- **Event:** Yacht scored (all 5 dice match)
- **Original filename:** (reuses `hearts-moon-shot.mp3` — see Hearts section above)
- **Source URL:** https://pixabay.com/sound-effects/orchestral-win-331233/
- **Creator:** u_it78ck90s3 on Pixabay
- **License:** Pixabay Content License
- **License URL:** https://pixabay.com/service/license-summary/
- **Attribution required:** No
- **Commercial use:** Yes
- **Notes:** Same orchestral win fanfare reused by Blackjack (#826) for big moments.

### yacht-straight.ogg

- **Event:** Large or small straight scored
- **Original filename:** `highUp.ogg` from Kenney Digital Audio
- **Source URL:** https://kenney.nl/assets/digital-audio
- **Creator:** Kenney Vleugels (Kenney.nl)
- **License:** Creative Commons Zero (CC0)
- **License URL:** https://creativecommons.org/publicdomain/zero/1.0/
- **Attribution required:** No
- **Commercial use:** Yes
- **Download date:** 2026-04-26
- **Notes:** Ascending digital tone — suits the "streak" feeling of a straight.

### yacht-upper-bonus.ogg

- **Event:** Upper section bonus reached (cumulative upper score ≥ 63)
- **Original filename:** `pepSound3.ogg` from Kenney Digital Audio
- **Source URL:** https://kenney.nl/assets/digital-audio
- **Creator:** Kenney Vleugels (Kenney.nl)
- **License:** Creative Commons Zero (CC0)
- **License URL:** https://creativecommons.org/publicdomain/zero/1.0/
- **Attribution required:** No
- **Commercial use:** Yes
- **Download date:** 2026-04-26
- **Notes:** Upbeat pep sound for a one-time bonus notification.

---

## Freesound CC0 License summary (as of 2026-04-25)

> Sounds licensed under Creative Commons Zero (CC0) have been dedicated to the
> public domain. You can copy, modify, distribute and perform them, even for
> commercial purposes, all without asking permission.
> See https://creativecommons.org/publicdomain/zero/1.0/ for full terms.

## Pixabay License summary (as of 2026-04-25)

> Content on Pixabay is made available under the Pixabay Content License, which
> allows use for free for commercial and non-commercial purposes, without
> attribution. You may not sell or redistribute Pixabay content as a standalone
> file. See https://pixabay.com/service/license-summary/ for full terms.

A copy of the full license has been archived at:
https://web.archive.org/web/2026/https://pixabay.com/service/terms/
