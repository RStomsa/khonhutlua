# Tabler layouts — page skeletons

Every Tabler page is `.page` → (navigation) → `.page-wrapper` → `.page-header` + `.page-body` + `.footer`. Content lives in `.container-xl` (or `.container-fluid` for fluid layouts). Pick the layout in Step 0 and don't mix.

## Contents
- [1. Vertical sidebar (default for apps)](#1-vertical-sidebar)
- [2. Horizontal navbar](#2-horizontal-navbar)
- [3. Condensed (single-row header)](#3-condensed)
- [4. Fluid & boxed variants](#4-fluid--boxed)
- [5. Auth pages (login / register / forgot)](#5-auth-pages)
- [6. Error pages](#6-error-pages)
- [7. Settings page pattern (side tabs)](#7-settings-pattern)
- [8. Responsive behavior notes](#8-responsive-notes)

## 1. Vertical sidebar

Default for applications with more than ~6 navigation items. Dark sidebar over light content is the sanctioned theme mix.

```html
<div class="page">
  <aside class="navbar navbar-vertical navbar-expand-lg" data-bs-theme="dark">
    <div class="container-fluid">
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse"
              data-bs-target="#sidebar-menu" aria-controls="sidebar-menu"
              aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="navbar-brand navbar-brand-autodark">
        <a href="/">AppName</a> <!-- or an <img class="navbar-brand-image"> -->
      </div>
      <nav class="collapse navbar-collapse" id="sidebar-menu" aria-label="Sidebar">
        <ul class="navbar-nav pt-lg-3">
          <li class="nav-item active">
            <a class="nav-link" href="/">
              <span class="nav-link-icon d-md-none d-lg-inline-block"><i class="ti ti-home"></i></span>
              <span class="nav-link-title">Dashboard</span>
            </a>
          </li>
          <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle" href="#navbar-orders" data-bs-toggle="dropdown"
               data-bs-auto-close="false" role="button" aria-expanded="false">
              <span class="nav-link-icon d-md-none d-lg-inline-block"><i class="ti ti-package"></i></span>
              <span class="nav-link-title">Orders</span>
            </a>
            <div class="dropdown-menu">
              <a class="dropdown-item" href="/orders">All orders</a>
              <a class="dropdown-item" href="/orders/pending">Pending</a>
            </div>
          </li>
        </ul>
      </nav>
    </div>
  </aside>

  <div class="page-wrapper">
    <!-- optional top header inside page-wrapper: search, notifications, user menu -->
    <header class="navbar navbar-expand-md d-none d-lg-flex d-print-none">
      <div class="container-xl">
        <div class="navbar-nav flex-row order-md-last">
          <div class="nav-item dropdown">
            <a href="#" class="nav-link d-flex lh-1 p-0 px-2" data-bs-toggle="dropdown"
               aria-label="Open user menu">
              <span class="avatar avatar-sm">OK</span>
              <div class="d-none d-xl-block ps-2">
                <div>Jane Doe</div>
                <div class="mt-1 small text-secondary">Administrator</div>
              </div>
            </a>
            <div class="dropdown-menu dropdown-menu-end dropdown-menu-arrow">
              <a href="/settings" class="dropdown-item">Settings</a>
              <div class="dropdown-divider"></div>
              <a href="/logout" class="dropdown-item">Logout</a>
            </div>
          </div>
        </div>
      </div>
    </header>

    <div class="page-header d-print-none">…</div>
    <div class="page-body">
      <div class="container-xl">…</div>
    </div>
    <footer class="footer footer-transparent d-print-none">
      <div class="container-xl">
        <div class="row text-center align-items-center flex-row-reverse">
          <div class="col-12 col-lg-auto mt-3 mt-lg-0">© 2026 AppName</div>
        </div>
      </div>
    </footer>
  </div>
</div>
```

Key points:
- `data-bs-theme="dark"` on the `<aside>` only → dark sidebar, light content.
- `navbar-brand-autodark` inverts a light logo automatically in the dark sidebar.
- Nav groups use Bootstrap dropdown markup with `data-bs-auto-close="false"` so submenus stay open in vertical mode.
- Mark the current page's `<li>` with `.active`.

## 2. Horizontal navbar

Content-first tools with ≤6 top-level sections.

```html
<div class="page">
  <header class="navbar navbar-expand-md d-print-none">
    <div class="container-xl">
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbar-menu">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="navbar-brand navbar-brand-autodark d-none-navbar-horizontal pe-0 pe-md-3">
        <a href="/">AppName</a>
      </div>
      <div class="navbar-nav flex-row order-md-last">
        <!-- theme toggle, notifications, user dropdown -->
      </div>
    </div>
  </header>
  <header class="navbar-expand-md">
    <div class="collapse navbar-collapse" id="navbar-menu">
      <div class="navbar">
        <div class="container-xl">
          <ul class="navbar-nav">
            <li class="nav-item active">
              <a class="nav-link" href="/">
                <span class="nav-link-icon"><i class="ti ti-home"></i></span>
                <span class="nav-link-title">Home</span>
              </a>
            </li>
            <!-- more items; dropdowns identical to Bootstrap navbar dropdowns -->
          </ul>
        </div>
      </div>
    </div>
  </header>
  <div class="page-wrapper">…</div>
</div>
```

## 3. Condensed

Brand, menu, and user actions merged into a single header row — maximizes vertical space. Same markup as horizontal but with everything in the first `<header class="navbar navbar-expand-md">`; the nav `<ul>` sits inside the same container. Use for dense data tools on wide screens.

## 4. Fluid & boxed

- **Fluid**: add `layout-fluid` class to `<body>` — the CSS lifts `max-width` off every `container-*` inside. (Keep writing `container-xl` in markup; the body class does the widening.) For wide tables/dashboards on big monitors.
- **Boxed**: add `layout-boxed` class to `<body>`; the app renders in a centered, max-width shell with the page background visible around it.
- **Sticky header**: add `sticky-top` to the header `<header class="navbar … sticky-top">`.

### Full variant matrix (each has a demo page — see references/preview-map.md)

| Variant | How |
|---|---|
| Right sidebar | `navbar-vertical navbar-end` on the aside |
| Transparent sidebar | add `navbar-transparent` to the aside |
| Dark top navbar | `data-bs-theme="dark"` on the `<header>` |
| Overlapping navbar | `navbar-overlap` on a dark header — it paints a band below itself so the first row of cards overlaps into the header (hero-dashboard look) |
| Combo | dark vertical sidebar + condensed top navbar with brand hidden in the header (`d-none d-lg-flex` on the top navbar) |
| RTL | `dir="rtl"` on `<html>` + `tabler.rtl.min.css` |

## 5. Auth pages

No sidebar, no page-wrapper — a centered tight container.

```html
<body class="d-flex flex-column">
  <div class="page page-center">
    <div class="container container-tight py-4">
      <div class="text-center mb-4">
        <a href="/" class="navbar-brand navbar-brand-autodark">AppName</a>
      </div>
      <div class="card card-md">
        <div class="card-body">
          <h2 class="h2 text-center mb-4">Login to your account</h2>
          <form action="/login" method="post" autocomplete="off" novalidate>
            <div class="mb-3">
              <label class="form-label">Email address</label>
              <input type="email" class="form-control" placeholder="you@example.com" autocomplete="username">
            </div>
            <div class="mb-2">
              <label class="form-label">
                Password
                <span class="form-label-description"><a href="/forgot-password">I forgot password</a></span>
              </label>
              <input type="password" class="form-control" placeholder="Your password" autocomplete="current-password">
            </div>
            <div class="mb-2">
              <label class="form-check">
                <input type="checkbox" class="form-check-input"/>
                <span class="form-check-label">Remember me on this device</span>
              </label>
            </div>
            <div class="form-footer">
              <button type="submit" class="btn btn-primary w-100">Sign in</button>
            </div>
          </form>
        </div>
      </div>
      <div class="text-center text-secondary mt-3">
        Don't have account yet? <a href="/register" tabindex="-1">Sign up</a>
      </div>
    </div>
  </div>
</body>
```

Variants: `container-tight` keeps ~25rem width; add an illustration column with a `row g-0` split card for a two-pane login.

## 6. Error pages

```html
<div class="page page-center">
  <div class="container-tight py-4">
    <div class="empty">
      <div class="empty-header">404</div>
      <p class="empty-title">Oops… You just found an error page</p>
      <p class="empty-subtitle text-secondary">We are sorry but the page you are looking for was not found</p>
      <div class="empty-action">
        <a href="/" class="btn btn-primary"><i class="ti ti-arrow-left"></i> Take me home</a>
      </div>
    </div>
  </div>
</div>
```

## 7. Settings pattern

Card with a vertical pill nav in a left column and content panes on the right:

```html
<div class="card">
  <div class="row g-0">
    <div class="col-12 col-md-3 border-end">
      <div class="card-body">
        <h4 class="subheader">Business settings</h4>
        <div class="list-group list-group-transparent">
          <a href="#" class="list-group-item list-group-item-action active">My Account</a>
          <a href="#" class="list-group-item list-group-item-action">Notifications</a>
        </div>
      </div>
    </div>
    <div class="col-12 col-md-9 d-flex flex-column">
      <div class="card-body">…form…</div>
      <div class="card-footer bg-transparent mt-auto">
        <div class="btn-list justify-content-end">
          <a href="#" class="btn btn-link link-secondary">Cancel</a>
          <button type="submit" class="btn btn-primary">Save changes</button>
        </div>
      </div>
    </div>
  </div>
</div>
```

## 8. Responsive notes

- Sidebar collapse breakpoint is set by `navbar-expand-lg` (sidebar becomes a top collapsible bar below `lg`). Use `navbar-expand-md` for earlier expansion.
- Always keep the `navbar-toggler` button — removing it strands mobile users.
- Tables: wrap in `.table-responsive`; prefer `card-table` inside cards so the scroll area is flush.
- `row row-deck row-cards` makes card rows equal-height and consistently gapped — the default for dashboard grids.
- Hide print noise with `d-print-none` on headers, buttons, footers (already in the skeletons).
