# Tabler preview map — the official cookbook

preview.tabler.io is Tabler's canonical usage reference: ~127 demo pages built by the framework author. When building any screen, **mirror the matching demo page instead of inventing structure**. Live page: `https://preview.tabler.io/{name}.html`. Source (Astro): `https://github.com/tabler/tabler/tree/main/preview/pages/{name}.astro` — pages compose components from `shared/components/`, so the rendered HTML on preview.tabler.io is the flattened, copy-friendly form.

## Task → demo page index

**Dashboards & data**

| Task | Page(s) |
|---|---|
| General admin dashboard | `index` (the flagship — study first) |
| CRM / sales dashboard | `dashboard-crm` |
| Finance/trading dashboard | `dashboard-crypto` |
| Stat/KPI card variety | `widgets`, `card-actions`, `cards` |
| Every chart pattern (48 configs: line, area, bar, donut, heatmap, candlestick…) | `charts` |
| Sortable/filterable tables | `tables`, `datatables` (List.js wiring) |
| Key-value detail views | `datagrid` |
| Status/monitoring | `uptime`, `logs`, `tracking`, `activity` |

**Application screens**

| Task | Page(s) |
|---|---|
| Chat / messaging | `chat` |
| Mail client | `email-inbox`, `emails` |
| Kanban board | `tasks` (columns = `col-12 col-md-6 col-lg`, cards = `card card-sm`, filter tabs = `nav nav-bordered`, drag via SortableJS) |
| Todo/checklist | `tasks-list` |
| Invoice (print-ready) | `invoice` |
| Pricing / plans / checkout | `pricing`, `pricing-table`, `pay`, `payment-providers`, `settings-plan`, `trial-ended` |
| User directory & cards | `users` |
| Profile page | `profile` |
| Settings (side-nav pattern) | `settings` |
| Search results | `search-results` |
| Listings/marketplace | `job-listing` |
| Media library / gallery | `gallery`, `photogrid`, `music`, `lightbox` |
| Calendar | `fullcalendar` |
| Maps | `maps`, `maps-vector`, `map-fullsize` |
| Multi-step wizard | `wizard`, `steps` |
| First-run / onboarding / product tour | `onboarding`, `tour` (driver.js) |
| FAQ / legal | `faq`, `terms-of-service`, `license` |

**Auth & system pages**

| Task | Page(s) |
|---|---|
| Login (4 flavors) | `sign-in` (tight), `sign-in-cover` (split w/ image), `sign-in-illustration`, `sign-in-link` (magic link) |
| Register / recovery | `sign-up`, `forgot-password` |
| 2FA | `2-step-verification`, `2-step-verification-code` |
| Lock screen | `auth-lock` |
| Errors | `error-404`, `error-500`, `error-maintenance` |
| Skeleton / loader | `blank`, `page-loader`, `placeholder` |

**Layout variants** (each `layout-*` page demos one composition)

| Variant | Page | Mechanism |
|---|---|---|
| Vertical sidebar (default) | `layout-vertical` | `aside.navbar-vertical` |
| Right sidebar | `layout-vertical-right` | add `navbar-end` to the aside |
| Transparent sidebar | `layout-vertical-transparent` | add `navbar-transparent` |
| Horizontal | `layout-horizontal` | two headers (brand row + menu row) |
| Condensed | `layout-condensed` | single merged header row |
| Combo (sidebar + top navbar) | `layout-combo` | dark sidebar + condensed header, brand hidden in header |
| Fluid | `layout-fluid`, `layout-fluid-vertical` | `layout-fluid` class on `<body>` |
| Boxed | `layout-boxed` | `layout-boxed` class on `<body>` |
| Dark navbar | `layout-navbar-dark` | `data-bs-theme="dark"` on header |
| Overlapping navbar | `layout-navbar-overlap` | `navbar-overlap` on dark header — content cards overlap into the header band |
| Sticky navbar | `layout-navbar-sticky` | `sticky-top` |
| RTL | `layout-rtl` | `dir="rtl"` + `tabler.rtl.css` |
| Nav patterns / breadcrumbs | `navigation` |

**Component demo pages** (one page per component, same name): `accordion alerts avatars badges buttons card-gradients cards-masonry carousel colorpicker colors cookie-banner dropdowns dropzone empty flags icons illustrations inline-player lists markdown modals offcanvas pagination patterns progress scroll-spy segmented-control signatures social-icons sortable stars-rating tabs tags toasts typography wysiwyg form-elements form-layout text-features` — and `all-elements` as a single-page component census.

## Preview taste conventions (verified from source)

These are the author's own habits across the demos — adopt them:

1. **Stat grid formula**: `row row-cards` → `col-sm-6 col-lg-3` cards; each card = soft `-lt` icon tile in a semantic color + subheader + value + signed delta. Semantic tile colors vary per metric (green=won, red=due, azure=pipeline…), while the ONE brand primary stays reserved for actions.
2. **Metric header formula**: `.subheader` label → `.h1 mb-0` value + colored `fw-medium` delta on one baseline (`d-flex align-items-baseline gap-2`), custom legend chips (`<span class="legend bg-primary"></span>` + `text-secondary` label) instead of the chart library's legend.
3. **Charts**: container `div` carries `role="img"` + `aria-label`; `chart-sm` for sparklines, `chart-lg` for card charts; colors always resolved from CSS variables (via `tabler.getColor` in your code).
4. **Tooltips are the house enhancer** — by far the most-used JS behavior in the preview. Every icon-only control gets `title` + `data-bs-toggle="tooltip"` (auto-initialized; see javascript.md).
5. **Theme toggle** = plain links, not JS handlers, when `tabler-theme.js` is loaded: `<a href="?theme=dark" class="nav-link px-0 hide-theme-dark">` / `?theme=light` + `hide-theme-light`. The script reads the URL param, persists to localStorage, strips nothing else.
6. **Vertical stacks** use Tabler's `space-y` / `space-y-*` (flex-column + gap) instead of chained `mb-*`; bordered item lists use `divide-y`.
7. **Muted icon links**: `link-secondary` on icon-only anchors (hover restores emphasis) — not `text-secondary` on buttons.
8. **Sidebar `<nav>`** wraps the menu collapse with `aria-label="Sidebar"`; dark sidebar via `data-bs-theme="dark"` on the `<aside>` only.
9. **Vendor discipline**: each demo page declares exactly the libs it needs (the repo's `core/libs.json` is the official vendor registry) — pages don't globally load every plugin, and neither should you.

## When to fetch

If web access is available and the task matches a demo page, fetch the live page's HTML (`https://preview.tabler.io/{name}.html`) and lift its structure — it is always more current and more idiomatic than reconstructing from memory. Replace demo branding, nav, and data per the anti-slop bans in SKILL.md.
