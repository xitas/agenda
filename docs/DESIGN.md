# Agenda: Design Guide

## 1. Personality

**Calm, quick, personal.** Agenda is a tool I open many times a day, so it has to feel light, show _today_ first, and take one keystroke or tap to add something. No clutter or dashboards: the content (my events) is the interface.

Principles:

1. **Today first.** Every platform opens on Today.
2. **Add in one step.** A quick-add field is always reachable.
3. **Quiet chrome, colorful content.** Neutral UI; color comes only from event categories.
4. **Same product, native feel.** Shared tokens and language, with platform-appropriate patterns (sidebar on desktop, tabs and sheets on mobile).

## 2. Design tokens

Defined once in `packages/tokens/tokens.ts`, emitted as CSS variables for web, desktop, and extension, and imported as a TS object in mobile. **Never hard-code a color or spacing value in an app.**

### Color: neutrals and brand

| Token           | Light     | Dark      | Use                                                                     |
| --------------- | --------- | --------- | ----------------------------------------------------------------------- |
| `bg`            | `#FAFAF9` | `#0C0C0E` | App background                                                          |
| `surface`       | `#FFFFFF` | `#16161A` | Cards, dialogs                                                          |
| `surface-2`     | `#F4F4F2` | `#1E1E23` | Hover rows, inputs                                                      |
| `border`        | `#E7E5E4` | `#2A2A30` | Decorative hairlines between areas                                      |
| `border-strong` | `#888380` | `#717175` | Edges that identify a control (inputs, secondary buttons), at least 3:1 |
| `text`          | `#1C1917` | `#EDEDEF` | Primary text                                                            |
| `text-muted`    | `#6B6560` | `#9A9AA3` | Secondary text, times                                                   |
| `accent`        | `#4F46E5` | `#818CF8` | Primary buttons, focus, "now" line                                      |
| `accent-fg`     | `#FFFFFF` | `#0C0C0E` | Text on accent                                                          |
| `danger`        | `#CB2323` | `#F87171` | Delete, errors                                                          |
| `danger-fg`     | `#FFFFFF` | `#0C0C0E` | Text on danger                                                          |
| `success`       | `#107937` | `#4ADE80` | Confirmations                                                           |

### Color: event categories

Each category has a soft background (event block fill) and a strong foreground (left bar and text).

| Name   | Strong (light) | Soft (light) | Strong (dark) | Soft (dark) |
| ------ | -------------- | ------------ | ------------- | ----------- |
| slate  | `#475569`      | `#F1F5F9`    | `#94A3B8`     | `#282A30`   |
| blue   | `#2460E3`      | `#EFF6FF`    | `#60A5FA`     | `#202A39`   |
| green  | `#117C38`      | `#F0FDF4`    | `#4ADE80`     | `#1D3228`   |
| amber  | `#A35904`      | `#FFFBEB`    | `#FBBF24`     | `#362E1B`   |
| red    | `#CB2323`      | `#FEF2F2`    | `#F87171`     | `#362326`   |
| violet | `#7C3AED`      | `#F5F3FF`    | `#A78BFA`     | `#2A2639`   |
| pink   | `#C5236B`      | `#FDF2F8`    | `#F472B6`     | `#352330`   |
| teal   | `#0B7970`      | `#F0FDFA`    | `#2DD4BF`     | `#193131`   |

**Dark soft fills** are a tint, not a block: each is its strong color at 14% over the dark `surface` (`#16161A`), precomputed as hex so web and mobile use the same values. A test in `packages/tokens` recomputes them.

Color is **never the only signal**: events also show their title and time, and categories have names.

**Contrast:** every text color on every background it is used on is at least 4.5:1 (WCAG AA), with a 5:1 margin in the light theme; control edges and focus rings are at least 3:1. `packages/tokens` has a test that computes these ratios for both themes, so a token change that breaks contrast fails CI. The light `danger`, `success` and the blue, green, amber, red, pink and teal strongs were darkened from the first draft of this table to meet it; hues are unchanged.

### Typography

- **Font:** Inter (web, desktop, extension); the system font on mobile (SF Pro / Roboto) for a native feel. Enable `font-variant-numeric: tabular-nums` for times.
- **Scale (px):** 12 caption · 14 body-sm · 16 body · 18 title-sm · 22 title · 28 display
- **Weights:** 400 regular, 500 medium (event titles, buttons), 600 semibold (headings). No bold-heavy UI.
- **Line height:** 1.5 body, 1.25 headings.

### Spacing, radius, elevation

- **Spacing:** 4-pt scale: 4, 8, 12, 16, 24, 32, 48
- **Layout:** breakpoints are 768 px (`breakpoint.narrow`) and 1024 px (`breakpoint.wide`). From 1024 up: the sidebar. Between 768 and 1023: no sidebar, the nav sits in the top bar and the calendar opens in a dialog. Below 768: a bottom nav, 64 px tall (`size.bottomNav`). Toasts sit 24 px above the bottom edge on wide screens and 80 px on narrow ones (`toastOffset`, derived from the nav height + 16 px) so they never cover the nav, plus the safe-area inset on phones.
- **Radius:** `sm 6` (inputs, chips) · `md 10` (cards, event blocks) · `lg 16` (dialogs, sheets) · `full` (pills, avatars)
- **Elevation:** use borders by default. Shadows only on floating layers (dialogs, menus, popovers): `0 8px 24px rgb(0 0 0 / .12)` light, and a stronger border instead of a shadow in dark mode. Tokens: `shadow-floating`, `floating-border` (`#E7E5E4` light, `#4A4A52` dark, clearly stronger than the hairline) and `overlay`, the backdrop behind a modal dialog (black at 40% light, `rgb(0 0 0 / 0.4)`; black at 60% dark, `rgb(0 0 0 / 0.6)`; a neutral black dims without tinting the page grey).

### Motion

- 150 ms for hover/press, 200–250 ms for dialogs and sheets, easing `cubic-bezier(.2,.8,.2,1)`
- Respect `prefers-reduced-motion` (turn transitions into instant changes)

### Icons

Lucide (web: `lucide-react`; mobile: `lucide-react-native`), 20 px in UI and 16 px inline, with a 1.75 stroke.

## 3. Core components

| Component                | Notes                                                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **QuickAdd**             | Single input: "Dentist tomorrow 4pm #red". Shows a live parsed preview chip ("Thu 16 Oct · 16:00"). Enter saves; Esc clears.                    |
| **EventCard**            | 3 px left bar in category strong color, soft fill, title (500), time range (muted, tabular). Compact variant for month cells and the extension. |
| **DayColumn / TimeGrid** | Hour rows of 48 px; a "now" line in `accent`; all-day strip at the top.                                                                         |
| **MonthGrid**            | Up to 3 events per cell, then "+N more". Today gets an accent ring.                                                                             |
| **EventEditor**          | Dialog (web/desktop) or bottom sheet (mobile). Fields: title, date/time, all-day toggle, color, reminders, location, notes.                     |
| **Button**               | Variants: `primary` (accent), `secondary` (surface + border), `ghost`, `danger`. Heights 32 / 40 (web), 44 (mobile).                            |
| **EmptyState**           | Icon + one friendly line + quick-add hint. Example: "Nothing today. Enjoy the space."                                                           |
| **Toast**                | Bottom-center; supports **Undo** for deletes (preferred over confirm dialogs).                                                                  |

## 4. Layout per platform

**Web / Desktop (≥ 1024 px):** left sidebar (240 px) with mini-month and categories; main area with the view switcher (Today · Week · Month) and QuickAdd at the top. Below 768 px the sidebar collapses and the layout follows the mobile pattern.

**Desktop extras:** the tray menu shows the next 5 events. The global-hotkey quick-add window is 560×72 px, centered, with no chrome, and closes on save or blur.

**Chrome popup (360×520):** header (date and settings icon), QuickAdd, today's list, and a footer link "Open full Agenda →". **Side panel:** a vertical week list.

**Mobile:** bottom tabs (Today · Calendar · Search · Settings), a floating **+** button bottom-right (or QuickAdd at the top of Today), and the editor as a bottom sheet. Swipe left on an event to delete (with Undo).

## 5. Interaction and shortcuts (web/desktop)

| Key                 | Action                           |
| ------------------- | -------------------------------- |
| `N` or `Ctrl/Cmd+K` | Focus QuickAdd                   |
| `T`                 | Go to Today                      |
| `D` / `W` / `M`     | Day / Week / Month view          |
| `←` / `→`           | Previous / next period           |
| `/`                 | Search                           |
| `E` / `Delete`      | Edit / delete the selected event |
| `?`                 | Shortcut help                    |

## 6. Accessibility

- WCAG 2.2 AA contrast (4.5:1 for text). Check both themes.
- A visible focus ring on every focusable element: `2px solid accent` with a 2 px offset.
- Touch targets ≥ 44×44 px on mobile.
- Dialogs trap focus and Esc closes them; all icons-only buttons have `aria-label`.
- Times are announced fully ("Thursday 16 October, 4 PM"), not "16:00".

## 7. Voice and copy

- Short, friendly, and direct. Use sentence case everywhere ("Add event", not "Add Event").
- Say what happened and offer the next step: "Event deleted. Undo".
- Errors explain the fix: "Couldn't reach the server. Your changes are saved and will sync when you're back online."
- Date format follows the device locale; the default is `Thu, 16 Oct` and 24-hour or 12-hour time per locale.

## 8. From v0 to v1

| v0                                                | v1                                         |
| ------------------------------------------------- | ------------------------------------------ |
| Table with #, Agenda, Date, View/Edit/Del buttons | Time-based views with clickable EventCards |
| Bootstrap modals for everything                   | Editor dialog/sheet + inline QuickAdd      |
| Confirm-before-delete                             | Delete instantly + Undo toast              |
| Date only (DD/MM/YYYY)                            | Date + time, all-day, locale formatting    |
| Import/Export buttons in the main header          | Moved to Settings → Data                   |
