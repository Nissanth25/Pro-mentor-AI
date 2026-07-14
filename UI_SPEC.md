UI Design Spec — ProMentor AI

Purpose
- Provide concise design tokens, component states, and micro-interaction notes for developers and designers.

Color Tokens
- Backgrounds:
  - `--bg`: primary page background (dark/navy or white in minimal)
  - `--bg2`: secondary surface
  - `--bg3`: card/panel surface
- Text:
  - `--text`: primary text
  - `--text2`: secondary/supporting text
  - `--text3`: tertiary/labels
- Accent:
  - `--accent-1`: primary action (coral / teal / mint depending on theme)
  - `--accent-2`: secondary accent
  - `--grad`: primary gradient (used for hero headings, major CTA)

Typography
- Headings: `Outfit`, heavy weight for H1/H2. Tight letter-spacing (-0.02em).
- Body: `Inter`, weights 400/600 for readable UI copy.
- Code/monospace: `JetBrains Mono` for key file paths and inline code.
- Sizes:
  - H1 hero: clamp(36px, 5vw, 62px)
  - Base: 14px
  - Buttons: 14–16px depending on size

Spacing & Radii
- Radii: `--r-sm` = 8px, `--r-md` = 12px, `--r-lg` = 18px
- Consistent 16–24px paddings in cards and forms

Components
- Button (`.btn`, `.btn-primary`, `.btn-outline`):
  - States: default, hover (translateY -3px), active (scale down 0.997), focus (focus-ring)
  - Micro-interaction: ripple on click (span.ripple animation)
- Glass Card (`.glass-card`):
  - Background: subtle gradient + border; backdrop-filter blur(10px)
  - Hover: raise via `transform` + `box-shadow` for depth
- Feature Card (`.feat-card`):
  - Rounded (14px), hover tilt (translateY / rotate), subtle overlay
- Modal (`.modal-dialog`):
  - Centered, max-width 760px, `glass-card` surface, close in top-right

Accessibility
- Use at least 4px focus ring on interactive elements (`--focus-ring`)
- Prefer text alternatives (emoji + text labels), semantic elements for forms
- Ensure contrast: test token pairs (e.g., `--text` on `--bg`) and tune per theme

Micro-interactions
- Hero orbs: slow float animation (`orbFloat`) for ambient motion
- Floating cards: subtle vertical float (`floatCard`) to suggest liveliness
- Buttons: ripple and slight lift on hover
- Feature selection: flip/tilt and checkmark on selection

Onboarding Flow
- Modal with 3 short steps and clear actions: Skip or Start Guided Run
- Auto-show only once per user (persisted in `localStorage` key `pm_seen_onboarding`)
- `Start Guided Run` opens Wizard and focuses the first form field

Implementation Notes
- Themes applied via `body[data-theme="warm"]` or `body[data-theme="minimal"]`.
- Theme selector control: `#theme-select` (value: default|warm|minimal)
- Onboarding modal id: `#onboarding-modal`; triggered programmatically or via `#open-onboarding-btn`.

Files updated by this change
- `style.css`: added theme variables, modal styles, and ripple styles
- `index.html`: added theme selector and onboarding markup
- `app.js`: theme management, onboarding show/hide, button ripple handler

If you want, I can:
- Generate two additional alternate CSS files for export
- Produce a small Figma-ready token JSON
- Adjust color contrast to meet WCAG AA for specific themes

