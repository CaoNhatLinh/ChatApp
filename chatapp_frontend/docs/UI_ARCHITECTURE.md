# NovaChat UI Architecture

## Scope

- Web routes and screen structure for the current project
- Public marketing pages: Home, About, Help, Privacy, NotFound
- Auth pages: Login, Register
- Product routes: Chat page, friends/messages switching, settings, profile

## Current Routes

### Public
- `/` and `/home` => `src/pages/HomePage.tsx`
- `/about` => `src/pages/AboutPage.tsx`
- `/help` => `src/pages/HelpPage.tsx`
- `/privacy` => `src/pages/PrivacyPage.tsx`
- `/terms` => `src/pages/terms/TermsPage.tsx`
- `/login` => `src/pages/LoginPage.tsx`
- `/register` => `src/pages/RegisterPage.tsx`
- `*` => `src/pages/NotFound.tsx`

### App
- `/app` => `src/pages/MessengerPage.tsx`
- `/messages` => `src/pages/MessagesPage.tsx`
- `/friends` => `src/pages/FriendsPage.tsx`
- `/search` => `src/pages/SearchPage.tsx`
- `/activity` => `src/pages/ActivityPage.tsx`
- `/settings` => `src/pages/SettingsPage.tsx`
- `/profile` => `src/pages/ProfilePage.tsx`

## Layout Components

- `src/pages/shared/layout/ShellFrame.tsx`  
- `src/pages/shared/layout/PublicShellHeader.tsx`  
- `src/pages/shared/layout/AppShellHeader.tsx`  
- `src/pages/shared/layout/AuthShellHeader.tsx`  
- `src/pages/shared/AppPageShell.tsx`  
  Shared shell for app pages. This now delegates to `src/pages/shared/layout/AppPageShell.tsx`.
- `src/pages/shared/PublicPageShell.tsx`  
  Shared shell for public pages: decorative ambient layer, centered container, and optional top actions.

- `src/widgets/messenger-layout/MessengerLayout.tsx`  
  App shell for chat view. It now delegates loading/error/content into dedicated components.

## Public Page Composition

- `src/pages/home/components/HomeTopBar.tsx` handles top action links.
- `src/pages/home/components/HomeHero.tsx`
- `src/pages/home/components/HomeFeatureGrid.tsx`
- `src/pages/home/components/HomeQuickLinks.tsx`

- `src/pages/about/components/AboutIntro.tsx`
- `src/pages/about/components/AboutValueCards.tsx`

- `src/pages/help/components/HelpFaqList.tsx`
- `src/pages/help/components/HelpTipCards.tsx`

- `src/pages/privacy/components/PrivacyPolicyCards.tsx`
- `src/pages/privacy/components/PrivacyPageCta.tsx`

- `src/pages/not-found/components/NotFoundVisual.tsx`
- `src/pages/not-found/components/NotFoundActions.tsx`

- `src/pages/profile/components/ProfileIdentityCard.tsx`
- `src/pages/profile/components/ProfileInfoGrid.tsx`
- `src/pages/profile/components/ProfileQuickLinks.tsx`
- `src/pages/profile/components/ProfileAccessNote.tsx`

## Auth UI Composition

- `src/features/auth/ui/AuthLayout.tsx` remains the shared container for auth routes.
- `src/features/auth/components/Login.tsx`
- `src/features/auth/components/Register.tsx`
- `src/features/auth/components/LoginForm.tsx`
- `src/features/auth/components/RegisterForm.tsx`
- `src/features/auth/ui/components/AuthField.tsx` (shared form field component)

## Messenger Layout Composition

- `src/widgets/messenger-layout/components/MessengerLayoutShell.tsx`
  Shared desktop/mobile shell, sidebar toggle behavior, ambient background layering.

- `src/widgets/messenger-layout/components/MessengerLoadingState.tsx`
- `src/widgets/messenger-layout/components/MessengerErrorState.tsx`

## CSS / Spacing System

- Base scale added in `src/index.css`:
  - `--space-2xs`, `--space-xs`, `--space-sm`, `--space-md`, `--space-lg`,
    `--space-xl`, `--space-2xl`, `--space-3xl`, `--space-4xl`
- Utility classes:
  - `layout-stack-tight`
  - `layout-stack`
  - `layout-stack-relaxed`
  - `layout-grid-auto`

## Editing Rules for New Screens

- Route files should compose the page from small, focused components.
- Keep route-level files short (orchestration + data flow only).
- Put spacing rhythm into utility containers first, then per-element styles.
- Shared interactive primitives (button, input, dialog, dropdown) should still use `shared/ui`.
