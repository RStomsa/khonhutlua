# Tabler theming — tokens, dark mode, brand

## Contents
- [Token system](#token-system)
- [Attribute-driven theme system](#the-attribute-driven-theme-system-tabler-themescss)
- [Color palette & semantics](#color-palette--semantics)
- [Dark mode done right](#dark-mode)
- [Custom brand (font, primary, radius)](#custom-brand)
- [Density](#density)
- [RTL & i18n](#rtl--i18n)
- [Anti-slop rationale](#anti-slop-rationale)

## Token system

Everything themable is a `--tblr-*` CSS variable (Tabler extends Bootstrap 5.3's variable system). The ones you'll actually touch:

| Variable | Controls |
|---|---|
| `--tblr-primary` (+ `--tblr-primary-rgb`) | Primary/brand color everywhere |
| `--tblr-font-sans-serif` | App font stack |
| `--tblr-body-bg`, `--tblr-body-color` | Page background / text |
| `--tblr-border-radius` (+ `-sm`, `-lg`) | Corner radius system |
| `--tblr-border-color` | Hairlines, card borders |
| `--tblr-bg-surface`, `--tblr-bg-surface-secondary` | Card / raised surfaces |

Rule: components read tokens; you set tokens once in the theme block. If you catch yourself writing a hex value inside a component, stop and either use an existing utility (`text-secondary`, `bg-red-lt`, `border`) or promote the value to a token.

When setting `--tblr-primary`, also set `--tblr-primary-rgb` (as `R, G, B`) — focus rings and translucent fills derive from it.

## Color palette & semantics

Named palette (each with utilities `text-{c}`, `bg-{c}`, soft `bg-{c}-lt`): `blue azure indigo purple pink red orange yellow lime green teal cyan` + `dark muted secondary`.

Fix ONE semantic map per app and note it in the theme block:

```css
:root {
  /* semantic map:
     green  = success / active / paid
     yellow = pending / warning
     red    = failed / overdue / destructive
     azure  = informational
     secondary = draft / disabled                */
}
```

- Soft `-lt` variants inside tables and lists; solid variants only for high-priority signals.
- The brand primary is for actions and emphasis — do NOT reuse it as a status color.
- Charts: derive series colors from the palette variables, keep semantic consistency (a "failed" series is red there too).

## The attribute-driven theme system (tabler-themes.css)

Beyond raw CSS variables, Tabler ships an official attribute-based theming layer. Load `dist/css/tabler-themes.min.css`, then set attributes on `<html>`:

| Attribute | Values | Controls |
|---|---|---|
| `data-bs-theme` | `light` `dark` | Color scheme (core, no extra CSS needed) |
| `data-bs-theme-base` | `slate` `gray` `zinc` `neutral` `stone` | Gray-scale family (Tailwind-style neutrals) |
| `data-bs-theme-primary` | `blue` `azure` `indigo` `purple` `pink` `red` `orange` `yellow` `lime` `green` `teal` `cyan` | Primary color from the palette |
| `data-bs-theme-font` | `sans-serif` `serif` `monospace` `comic` | Font family preset |
| `data-bs-theme-radius` | `0` `0.5` `1` `1.5` `2` | Radius scale (0 = sharp, 2 = round) |

```html
<html data-bs-theme="dark" data-bs-theme-base="slate" data-bs-theme-primary="teal" data-bs-theme-radius="1.5">
```

`dist/js/tabler-theme.min.js` (placed un-deferred at the top of `<body>` — see javascript.md for why) persists these: it reads URL query params (`?theme=dark&theme-primary=teal`), stores them in localStorage under `tabler-theme*` keys, and applies the attributes before first paint.

**When to use which:** the attribute system covers palette-based branding with zero custom CSS and gives users a settings panel for free. Drop to raw `--tblr-*` variables when the brand color isn't in the palette or you need a custom font. Don't mix both mechanisms for the same property.

## Dark mode

Mechanism: `data-bs-theme="light|dark"` on `<html>` (whole app) or on any container (scoped — e.g. dark `<aside>` sidebar).

FOUC-free init — inline in `<head>` BEFORE the CSS link:

```html
<script>
  document.documentElement.setAttribute("data-bs-theme",
    localStorage.getItem("theme") ||
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
</script>
```

Toggle button (put in the header nav). Two sanctioned patterns:

**A) With `tabler-theme.js` loaded** (the preview's own pattern — plain links, zero custom JS; the script catches the URL param and persists it):

```html
<a href="?theme=dark" class="nav-link px-0 hide-theme-dark" title="Enable dark mode"
   data-bs-toggle="tooltip" data-bs-placement="bottom"><i class="ti ti-moon"></i></a>
<a href="?theme=light" class="nav-link px-0 hide-theme-light" title="Enable light mode"
   data-bs-toggle="tooltip" data-bs-placement="bottom"><i class="ti ti-sun"></i></a>
```

**B) Hand-rolled** (no page reload, when you're not using tabler-theme.js):

```html
<a href="#" class="nav-link px-0 hide-theme-dark" aria-label="Enable dark mode"
   onclick="setTheme('dark');return false"><i class="ti ti-moon"></i></a>
<a href="#" class="nav-link px-0 hide-theme-light" aria-label="Enable light mode"
   onclick="setTheme('light');return false"><i class="ti ti-sun"></i></a>
<script>
  function setTheme(t){
    localStorage.setItem("theme", t);
    document.documentElement.setAttribute("data-bs-theme", t);
  }
</script>
```

`hide-theme-dark` / `hide-theme-light` are Tabler utilities that show the right toggle per theme.

Dark-mode quality bar:
- Off-black surfaces come from Tabler's tokens — do not override with pure `#000`.
- Verify hierarchy parity: what is emphasized in light stays emphasized in dark.
- Custom brand colors must pass WCAG AA on both themes; if your primary is too dark for dark mode, define it per-theme:

```css
:root { --tblr-primary: #0054a6; --tblr-primary-rgb: 0, 84, 166; }
[data-bs-theme="dark"] { --tblr-primary: #4a9eff; --tblr-primary-rgb: 74, 158, 255; }
```

- Images/logos: `navbar-brand-autodark` inverts monochrome logos; supply a real dark variant otherwise.
- Charts: refresh chart colors on toggle (re-read the CSS variables and `updateOptions`).

## Custom brand

```html
<!-- 1. Font: load, then point the token at it -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --tblr-font-sans-serif: "Inter", -apple-system, "Segoe UI", sans-serif;
    --tblr-primary: #0054a6;
    --tblr-primary-rgb: 0, 84, 166;
    --tblr-border-radius: 6px; /* pick sharp (2-4px), soft (6-8px) or round — ONE system */
  }
</style>
```

Application UIs want workhorse fonts with good numerals and a tall x-height (Inter, IBM Plex Sans, Public Sans, Figma-era grotesks). Enable `tabular-nums` on numeric table columns. Save display-font adventures for the marketing site — inside an admin tool, typography personality lives in the brand mark and page titles, not body text.

Deeper customization (component-level restyling, compiled themes): fork the SCSS from `@tabler/core/src/scss` and override `$` variables at build time — only when CSS variables genuinely can't reach the target.

## Density

- Comfortable (default): standard `card`, `table`.
- Compact (ops/data tools): `table-sm` on tables, `card-sm` on cards, `g-2`/`g-3` grid gaps, `btn-sm` in table rows.
- Pick once (density lock); a page that mixes airy cards with cramped tables reads broken.

## RTL & i18n

- RTL build: `dist/css/tabler.rtl.min.css` + `dir="rtl"` on `<html>`.
- Use logical utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start/end`) — never `ml/mr` era classes — so layouts survive RTL.
- Leave 30–40% width headroom in buttons/labels for translation growth; test German-length strings in nav items.

## Anti-slop rationale

Why the bans in SKILL.md exist — internalize the reasoning, not just the rules:

- **Admin UIs are read 100× more than admired.** Every decorative element taxes daily scanning. The user's eye must land on anomalies (overdue, failed, spiking) instantly — which only works if the steady state is calm.
- **Consistency IS the aesthetic.** A Tabler app looks professional precisely when radius, spacing, icon stroke, and color semantics never waver. One rogue gradient or mismatched icon reads as a bug.
- **Fake-perfect demo data hides layout bugs.** Long German company names, ₺1.234.567,89 amounts, empty tables, and 0% progress bars are what production looks like — design for them from the first render.
- **States are the product.** Users spend real time in loading, empty, and error states. A skill-issue UI treats them as afterthoughts; a professional one designs them first.
- **Motion = information.** In an app, animation earns its place only by communicating state change (saved ✓, row added, panel opened). Everything else is friction on the 500th daily interaction.
