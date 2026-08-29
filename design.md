# Classloop design system

## Direction

Classloop uses a custom **Classroom Adventure Table** system: bright toy diorama, chunky, tactile, classroom-safe. It borrows the readable turn staging of casual mobile board games without copying Monopoly GO artwork, board geometry, icons, characters, or economy.

- Audience: teachers hosting a class and students joining from shared or personal devices.
- Primary job: keep the board and the current action readable before exposing authoring controls.
- Page family: **Game Stage** for play/dashboard, **Toy Workbench** for authoring, and **Split Auth** for teacher access.
- Tone: playful premium toy. Cheerful enough for a game, controlled enough for a classroom.
- Craft tier: pure CSS/DOM 2.5D board, pawn, landmark, and die artwork. No WebGL dependency.

## Visual rules

- The board is the largest object in the dashboard. Supporting panels behave like edge trays, not nested cards.
- White and sky-tinted surfaces sit on a deep navy outline. Important physical objects receive one hard contact shadow plus one soft scene shadow.
- Blue is the interface anchor. Coral is reserved for the roll action, amber for rewards, mint for rest/positive state, and violet for events. These semantic colours may occupy the board but stay sparse in authoring UI.
- Display type uses Bricolage Grotesque; Korean body copy and compact labels use Noto Sans KR; room codes use Geist Mono.
- Buttons, tabs, and links remain one line. Touch targets are at least 44px.
- Spatial motion is limited to the die roll, pawn hop, and tile arrival. Reduced motion keeps the result and state feedback without the travel path.

## Turn choreography

1. The active turn label and roll button become the strongest board elements.
2. The die travels in a broad, readable arc with two cartoon impacts.
3. The final face settles by 80% of the animation and remains readable for roughly 500ms.
4. The pawn hops one tile at a time; the next tile lifts before contact.
5. The arrival tile lifts and receives a non-colour outline.
6. Quiz and card content takes over the board centre as a stage overlay.

## Component language

- `GameBoard`: thick blue base, raised white tiles, green or theme-coloured centre terrain.
- `PhysicsDie`: oversized cream cube, 24px-equivalent corners, navy/coral pips, flat plastic highlights, drawn impact rays.
- `TokenMark`: resin pawn silhouette with a letter badge; colour and silhouette/label communicate identity together.
- `BoardTile`: number in the corner, Lucide icon, short label, and a thick lower edge.
- `Game Stage`: board first; game list and live session are secondary trays.
- `Toy Workbench`: quieter surfaces, same outlines/tokens, sticky stage preview.
- `Split Auth`: the same sky and tabletop materials, with a small CSS board scene rather than unrelated marketing art.

## Exports

`tokens.css` is the source of truth. The snippets below are portable mappings for the current Tailwind v4 project and future tooling.

### Tailwind v4

```css
@theme {
  --color-paper: oklch(96% 0.032 224);
  --color-paper-2: oklch(92% 0.052 224);
  --color-paper-3: oklch(88% 0.072 224);
  --color-ink: oklch(25% 0.065 258);
  --color-ink-2: oklch(34% 0.06 258);
  --color-rule: oklch(78% 0.055 235);
  --color-muted: oklch(40% 0.05 258);
  --color-accent: oklch(55% 0.18 252);
  --color-focus: oklch(43% 0.2 252);
  --font-display: var(--font-bricolage), var(--font-korean);
  --font-body: var(--font-korean);
  --font-outlier: var(--font-geist-mono);
  --spacing-3xs: 0.25rem;
  --spacing-2xs: 0.5rem;
  --spacing-xs: 0.75rem;
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
  --spacing-lg: 2rem;
  --radius-card: 0.875rem;
  --radius-input: 0.75rem;
  --radius-pill: 999px;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}
```

### DTCG tokens

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "paper": { "$value": "oklch(96% 0.032 224)", "$type": "color" },
    "paper-2": { "$value": "oklch(92% 0.052 224)", "$type": "color" },
    "paper-3": { "$value": "oklch(88% 0.072 224)", "$type": "color" },
    "ink": { "$value": "oklch(25% 0.065 258)", "$type": "color" },
    "ink-2": { "$value": "oklch(34% 0.06 258)", "$type": "color" },
    "rule": { "$value": "oklch(78% 0.055 235)", "$type": "color" },
    "muted": { "$value": "oklch(40% 0.05 258)", "$type": "color" },
    "accent": { "$value": "oklch(55% 0.18 252)", "$type": "color" },
    "focus": { "$value": "oklch(43% 0.2 252)", "$type": "color" }
  },
  "font": {
    "display": { "$value": "Bricolage Grotesque, Noto Sans KR, sans-serif", "$type": "fontFamily" },
    "body": { "$value": "Noto Sans KR, sans-serif", "$type": "fontFamily" },
    "outlier": { "$value": "Geist Mono, monospace", "$type": "fontFamily" }
  },
  "space": {
    "3xs": { "$value": "0.25rem", "$type": "dimension" },
    "2xs": { "$value": "0.5rem", "$type": "dimension" },
    "xs": { "$value": "0.75rem", "$type": "dimension" },
    "sm": { "$value": "1rem", "$type": "dimension" },
    "md": { "$value": "1.5rem", "$type": "dimension" },
    "lg": { "$value": "2rem", "$type": "dimension" }
  },
  "duration": {
    "micro": { "$value": "120ms", "$type": "duration" },
    "short": { "$value": "200ms", "$type": "duration" },
    "long": { "$value": "420ms", "$type": "duration" },
    "dice": { "$value": "3900ms", "$type": "duration" },
    "dice-reduced": { "$value": "1200ms", "$type": "duration" }
  }
}
```

### shadcn/ui variables

```css
:root {
  --background: 96% 0.032 224;
  --foreground: 25% 0.065 258;
  --card: 99% 0.012 95;
  --card-foreground: 25% 0.065 258;
  --popover: 99% 0.012 95;
  --popover-foreground: 25% 0.065 258;
  --primary: 55% 0.18 252;
  --primary-foreground: 98% 0.01 95;
  --secondary: 88% 0.072 224;
  --secondary-foreground: 25% 0.065 258;
  --muted: 92% 0.052 224;
  --muted-foreground: 40% 0.05 258;
  --accent: 70% 0.19 34;
  --accent-foreground: 22% 0.065 258;
  --destructive: 55% 0.2 25;
  --destructive-foreground: 98% 0.01 95;
  --border: 78% 0.055 235;
  --input: 78% 0.055 235;
  --ring: 43% 0.2 252;
  --radius: 0.875rem;
}
```
