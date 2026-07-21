<!-- SEED -->
---
name: NovaChat
description: Conversational web app shell with real-time messaging and friend management
colors:
  primary: oklch(0.55 0.17 257)
  primary-foreground: oklch(0.99 0.01 262)
  secondary: oklch(0.94 0.01 250)
  secondary-foreground: oklch(0.28 0.02 250)
  muted: oklch(0.94 0.005 250)
  muted-foreground: oklch(0.48 0.03 250)
  accent: oklch(0.96 0.025 250)
  accent-foreground: oklch(0.16 0.01 270)
  background: oklch(0.98 0.004 265)
  foreground: oklch(0.16 0.01 270)
  card: oklch(1 0 0)
  card-foreground: oklch(0.16 0.01 270)
  border: oklch(0.9 0.005 250)
  input: oklch(0.93 0.005 250)
  ring: oklch(0.58 0.17 257)
  destructive: oklch(0.56 0.16 23)
  destructive-foreground: oklch(0.98 0.01 23)
  success: oklch(0.56 0.14 155)
  warning: oklch(0.84 0.13 85)
  panel: oklch(0.99 0 0)
  sidebar: oklch(0.97 0.008 270)
typography:
  display:
    fontFamily: "Merriweather, Georgia, serif"
    fontSize: "clamp(2.5rem, 7vw, 4.5rem)"
    fontWeight: 900
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Merriweather, Georgia, serif"
    fontSize: "clamp(1.8rem, 4.8vw, 3rem)"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.125rem, 2.4vw, 1.5rem)"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 600
    lineHeight: 1.25
rounded:
  sm: "0.75rem"
  md: "0.625rem"
  lg: "0.875rem"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  "2xl": "2.5rem"
  "3xl": "3rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
    size: "var(--text-base)"
  button-secondary:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
    size: "var(--text-base)"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.lg}"
    padding: "1.25rem"
  surface:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
---

# Design System: NovaChat

## 1. Overview

**Creative North Star: "The Fast Relay"**

NovaChat focuses on speed, readability and direct action. The shell favors a clear hierarchy for chat, conversation state and friend navigation. Visual treatment is restrained and supports message flow first, emotion second.

Key Characteristics:
- High readability on light neutral surfaces.
- Intentional spacing rhythm with dense action rows and calm section breaks.
- State-first UI for read/unread, online, loading and errors.

## 2. Colors

Palette uses one main saturated color with mostly neutral supporting tones.

### Primary
- Nova Primary (`oklch(0.55 0.17 257)`): main action, CTA and emphasis.

### Secondary
- Nova Secondary (`oklch(0.94 0.01 250)`): soft panels and gentle grouping.

### Neutral
- Canvas (`oklch(0.98 0.004 265)`): page background.
- Ink (`oklch(0.16 0.01 270)`): body and title text.
- Divider (`oklch(0.9 0.005 250)`): borders and separators.

### Named Rules
**The Sparse Accent Rule.** Primary remains a secondary visual weight on data-heavy screens; it serves actions, not texture.

## 3. Typography

Display: Merriweather + Manrope.

### Hierarchy
- **Display**: clamp headline, strongest line.
- **Headline**: prominent section heading.
- **Title**: standard card/page labels.
- **Body**: standard readable paragraphs.
- **Label**: compact actions and metadata.

## 4. Elevation

Flat base + small, controlled elevation only on active or hover surfaces.

### Shadow Vocabulary
- `surface-elevated`: `0 12px 30px -24px rgb(0 0 0 / 0.45)` for card-level lifts.
- `neo-shadow-sm`: `0 4px 12px -10px rgb(0 0 0 / 0.35)` for subtle lift.

## 5. Components

### Buttons
- Primary: filled action with focus-visible state.
- Secondary: outline/neutral actions with strong contrast.

### Cards / Containers
- Rounded radius is `lg` scale.
- Borders plus minimal shadows.

### Inputs / Forms
- Strong focus treatment with visible ring.
- Error states use destructive contrast.

### Navigation
- Public top bar + auth anchors.
- Responsive collapse for stacked flow in mobile width.

### Signature Components
- Chat sidebar + chat window as the central dual pane.
- Profile and settings entry as quick access hubs.

## 6. Do's and Don'ts

### Do
- Do keep contrast above minimum and avoid muted-on-muted combinations.
- Do separate sections by spacing and border rhythm.
- Do keep border radius controlled for cards.

### Don't
- Don't repeat the same card pattern for every page.
- Don't use thick side borders as decorative marks.
- Don't add decorative shadows to static neutral containers.
