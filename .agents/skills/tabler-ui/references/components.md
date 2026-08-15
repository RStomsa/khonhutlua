# Tabler components — copy-paste catalog

Check here BEFORE writing anything custom. Full docs per component: `https://docs.tabler.io/ui/components/<name>/`.

## Contents
- [Cards & stat cards](#cards)
- [Tables](#tables)
- [Datagrid (key-value details)](#datagrid)
- [Forms & validation](#forms)
- [Buttons](#buttons)
- [Badges & status](#badges--status)
- [Avatars](#avatars)
- [Dropdowns](#dropdowns)
- [Modals](#modals)
- [Toasts & alerts](#toasts--alerts)
- [Tabs & segmented control](#tabs)
- [Steps & timeline](#steps--timeline)
- [Empty, loading & error states](#states)
- [Pagination](#pagination)
- [Charts (ApexCharts)](#charts)
- [Vendor libraries](#vendor-libraries)

## Cards

```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Title</h3>
    <div class="card-actions">
      <a href="#" class="btn btn-outline-secondary btn-sm">Action</a>
    </div>
  </div>
  <div class="card-body">…</div>
  <div class="card-footer">…</div>
</div>
```

Useful modifiers: `card-sm` (compact), `card-borderless`, `card-active`, `card-stacked`, `card-link` (whole card clickable, wrap in `<a>`), `card-status-top bg-danger` (colored status strip), `ribbon` (`<div class="ribbon bg-red">NEW</div>` inside the card).

**Stat card** (remember: never a bare number — always delta/sparkline/target):

```html
<div class="card">
  <div class="card-body">
    <div class="d-flex align-items-center">
      <div class="subheader">Revenue</div>
      <div class="ms-auto lh-1">
        <span class="text-secondary">Last 7 days</span>
      </div>
    </div>
    <div class="d-flex align-items-baseline">
      <div class="h1 mb-0 me-2">$4,300</div>
      <div class="me-auto">
        <span class="text-green d-inline-flex align-items-center lh-1">
          8% <i class="ti ti-trending-up ms-1"></i>
        </span>
      </div>
    </div>
    <div id="chart-revenue" class="chart-sm"></div> <!-- optional sparkline -->
  </div>
</div>
```

Grid of stat cards: `<div class="row row-deck row-cards">` with `col-sm-6 col-lg-3` columns.

## Tables

Standard data table inside a card (flush edges via `card-table`):

```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Invoices</h3>
    <div class="card-actions"><a href="#" class="btn btn-primary"><i class="ti ti-plus"></i> New invoice</a></div>
  </div>
  <div class="table-responsive">
    <table class="table table-vcenter card-table">
      <thead>
        <tr>
          <th>No.</th>
          <th>Client</th>
          <th>Status</th>
          <th class="text-end">Amount</th>
          <th class="w-1"></th> <!-- actions column, shrink-to-fit -->
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="text-secondary">INV-2041</td>
          <td>Acme GmbH</td>
          <td><span class="badge bg-yellow-lt">Pending</span></td>
          <td class="text-end tabular-nums">€12,480.00</td>
          <td>
            <div class="btn-list flex-nowrap justify-content-end">
              <a href="#" class="btn btn-ghost-secondary btn-icon" aria-label="Edit"><i class="ti ti-pencil"></i></a>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <div class="card-footer d-flex align-items-center">
    <p class="m-0 text-secondary">Showing <span>1</span> to <span>10</span> of <span>42</span> entries</p>
    <ul class="pagination m-0 ms-auto">…</ul>
  </div>
</div>
```

Modifiers: `table-striped`, `table-hover`, `table-sm` (compact density), `table-vcenter` (vertical centering — almost always wanted), sortable header `<th><button class="table-sort" data-sort="name">Name</button></th>` (pairs with List.js, see vendors). Right-align numeric columns; `w-1` shrinks a column to content width.

## Datagrid

Key-value detail blocks (detail pages, drawers, confirm summaries):

```html
<div class="datagrid">
  <div class="datagrid-item">
    <div class="datagrid-title">Registrar</div>
    <div class="datagrid-content">Third Party</div>
  </div>
  <div class="datagrid-item">
    <div class="datagrid-title">Status</div>
    <div class="datagrid-content">
      <span class="status status-green"><span class="status-dot status-dot-animated"></span> Active</span>
    </div>
  </div>
</div>
```

## Forms

```html
<div class="mb-3">
  <label class="form-label required">Project name</label>
  <input type="text" class="form-control" name="name" placeholder="e.g. Q3 rollout">
  <small class="form-hint">Visible to all team members.</small>
</div>

<div class="mb-3">
  <label class="form-label">Type</label>
  <select class="form-select" name="type">
    <option value="internal">Internal</option>
  </select>
</div>

<label class="form-check form-switch mb-3">
  <input class="form-check-input" type="checkbox" checked>
  <span class="form-check-label">Enable notifications</span>
</label>

<!-- Validation: server- or client-set -->
<div class="mb-3">
  <label class="form-label required">Email</label>
  <input type="email" class="form-control is-invalid" value="not-an-email">
  <div class="invalid-feedback">Enter a valid email address.</div>
</div>
```

More: input groups (`input-group` + `input-group-text`), `input-icon` (icon inside field), selectgroup pills (`form-selectgroup` — radio/checkbox rendered as pills, great for filters), image/color checks, `form-fieldset` (grouped bordered section). Form footer: `<div class="form-footer">` holds the submit.

Validation rules: mark truly required labels with `.required`; success state `is-valid` + `valid-feedback` only when confirmation adds value; never rely on placeholder as label.

## Buttons

- Hierarchy: `btn btn-primary` (max one per view) → `btn btn-outline-secondary` → `btn btn-ghost-secondary` → `btn btn-link link-secondary` (cancel).
- Icon buttons: `btn btn-icon` + `aria-label` (mandatory).
- Groups: wrap multiple buttons in `<div class="btn-list">` (wrapping) — not raw siblings.
- Sizes: `btn-sm`, `btn-lg`; shapes: `btn-pill`, `btn-square`; loading: add `btn-loading` class.
- Semantic buttons (`btn-danger` etc.) only for genuinely destructive/confirming actions.

## Badges & status

```html
<span class="badge bg-green-lt">Paid</span>       <!-- soft, for table cells -->
<span class="badge bg-red">Failed</span>          <!-- solid, for high alert -->
<span class="badge badge-outline text-blue">Beta</span>

<span class="status status-green">
  <span class="status-dot status-dot-animated"></span> Online
</span>
```

Prefer soft `-lt` badges inside tables (lower visual noise). Keep one consistent color→meaning map across the whole app (e.g. green=success/active, yellow=pending, red=failed/overdue, azure=info, secondary=draft) — document it in the theme block comment.

## Avatars

```html
<span class="avatar">JD</span>
<span class="avatar avatar-sm" style="background-image: url(/u/42.jpg)"></span>
<span class="avatar avatar-sm bg-blue-lt">OK</span>
<div class="avatar-list avatar-list-stacked">
  <span class="avatar avatar-xs">A</span><span class="avatar avatar-xs">B</span>
  <span class="avatar avatar-xs">+8</span>
</div>
```

(`style="background-image"` is the sanctioned exception to the no-inline-style rule.)

## Dropdowns

Bootstrap 5 markup; Tabler adds `dropdown-menu-arrow`, icons in items:

```html
<div class="dropdown">
  <a href="#" class="btn btn-ghost-secondary btn-icon" data-bs-toggle="dropdown" aria-label="More">
    <i class="ti ti-dots-vertical"></i>
  </a>
  <div class="dropdown-menu dropdown-menu-end">
    <a class="dropdown-item" href="#"><i class="ti ti-pencil dropdown-item-icon"></i> Edit</a>
    <div class="dropdown-divider"></div>
    <a class="dropdown-item text-danger" href="#"><i class="ti ti-trash dropdown-item-icon"></i> Delete</a>
  </div>
</div>
```

## Modals

```html
<div class="modal modal-blur fade" id="modal-delete" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-sm modal-dialog-centered">
    <div class="modal-content">
      <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      <div class="modal-status bg-danger"></div>
      <div class="modal-body text-center py-4">
        <i class="ti ti-alert-triangle icon mb-2 text-danger icon-lg"></i>
        <h3>Are you sure?</h3>
        <div class="text-secondary">Do you really want to remove 3 invoices? This cannot be undone.</div>
      </div>
      <div class="modal-footer">
        <div class="w-100">
          <div class="row">
            <div class="col"><button class="btn w-100" data-bs-dismiss="modal">Cancel</button></div>
            <div class="col"><button class="btn btn-danger w-100">Delete</button></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- trigger: data-bs-toggle="modal" data-bs-target="#modal-delete" -->
```

Form modals: normal `modal-dialog` with `modal-header`/`modal-body`/`modal-footer`; `modal-lg`/`modal-full-width` for wide content. Destructive actions ALWAYS confirm via the small centered pattern above.

## Toasts & alerts

Alert (inline, persistent):
```html
<div class="alert alert-success alert-dismissible" role="alert">
  <div class="d-flex">
    <div class="me-2"><i class="ti ti-check icon alert-icon"></i></div>
    <div>
      <h4 class="alert-heading">Saved</h4>
      <div class="alert-description">Your settings have been updated.</div>
    </div>
  </div>
  <a class="btn-close" data-bs-dismiss="alert" aria-label="close"></a>
</div>
```

Toast (transient feedback) uses Bootstrap toast markup in a `toast-container position-fixed bottom-0 end-0 p-3`. Show via JS (`new bootstrap.Toast(el).show()`) or declaratively with Tabler's addition — a trigger button with `data-bs-toggle="toast" data-bs-target="#my-toast"` (no Bootstrap equivalent; wired by tabler.js). Use toasts for action feedback, alerts for state that must persist.

## Tabs

```html
<div class="card">
  <div class="card-header">
    <ul class="nav nav-tabs card-header-tabs" role="tablist">
      <li class="nav-item"><a href="#tab-1" class="nav-link active" data-bs-toggle="tab">Details</a></li>
      <li class="nav-item"><a href="#tab-2" class="nav-link" data-bs-toggle="tab">Activity</a></li>
    </ul>
  </div>
  <div class="card-body">
    <div class="tab-content">
      <div class="tab-pane active show" id="tab-1">…</div>
      <div class="tab-pane" id="tab-2">…</div>
    </div>
  </div>
</div>
```

The working mechanism is the per-link `data-bs-toggle="tab"` (a `<ul>`-level `data-bs-toggle="tabs"` seen in older demos is inert). Because links carry real `href="#tab-id"` anchors, tabler.js auto-activates the matching tab from the URL hash — tabs are deep-linkable for free (see `references/javascript.md`).

Segmented control (view switchers, e.g. day/week/month): `<nav class="nav nav-segmented" role="tablist">` with `nav-link` buttons — prefer over pill tabs for mutually exclusive views.

## Switch icon (favorite/star toggles)

Pure-Tabler component, auto-wired by tabler.js via `data-bs-toggle="switch-icon"` — full markup and the state-persistence caveat in `references/javascript.md`.

## Steps & timeline

Steps (wizards): `<div class="steps steps-green steps-counter">` with `<a class="step-item active">`. Timeline (activity feeds): `ul.timeline` > `li.timeline-event` with `timeline-event-icon` + card body — check docs page for full markup before use.

## States

**Empty (mandatory for every list/table/search):**
```html
<div class="empty">
  <div class="empty-icon"><i class="ti ti-mood-sad icon"></i></div>
  <p class="empty-title">No results found</p>
  <p class="empty-subtitle text-secondary">Try adjusting your search or filter to find what you're looking for.</p>
  <div class="empty-action">
    <a href="#" class="btn btn-primary"><i class="ti ti-plus"></i> Add your first project</a>
  </div>
</div>
```
First-use empty states get a CTA; filtered-empty states get "clear filters".

**Loading:** skeletons via `.placeholder` (`<div class="placeholder placeholder-lg col-9"></div>` inside a `placeholder-glow` card), or `spinner-border` for inline/button loading (`btn-loading`). Prefer skeleton cards that match the final layout.

**Error:** an `alert alert-danger` in place of the data, with a retry button — never a blank area or console-only failure.

## Pagination

```html
<ul class="pagination m-0 ms-auto">
  <li class="page-item disabled"><a class="page-link" href="#"><i class="ti ti-chevron-left"></i> prev</a></li>
  <li class="page-item active"><a class="page-link" href="#">1</a></li>
  <li class="page-item"><a class="page-link" href="#">2</a></li>
  <li class="page-item"><a class="page-link" href="#">next <i class="ti ti-chevron-right"></i></a></li>
</ul>
```

## Charts

Tabler's demo standard is **ApexCharts**. Load `https://cdn.jsdelivr.net/npm/apexcharts@latest/dist/apexcharts.min.js`, then:

```html
<div id="chart-revenue" class="chart-sm" role="img" aria-label="Revenue, last 10 weeks"></div>
<script>
  new ApexCharts(document.getElementById("chart-revenue"), {
    chart: { type: "area", height: 40, sparkline: { enabled: true }, fontFamily: "inherit", animations: { enabled: false } },
    stroke: { width: 2, curve: "smooth" },
    fill: { opacity: 0.16 },
    colors: [tabler.getColor("primary")], // official helper from tabler.min.js — reads --tblr-* vars
    series: [{ name: "Revenue", data: [37,35,44,28,36,24,65,31,37,39] }],
    tooltip: { theme: "dark" },
    xaxis: { labels: { show: false }, tooltip: { enabled: false } },
    yaxis: { labels: { show: false } },
  }).render();
</script>
```

Rules:
- Colors via `tabler.getColor("primary")` / `tabler.getColor("green", 0.2)` — never hardcoded (details in `references/javascript.md`). Init scripts must run after `tabler.min.js`.
- `fontFamily: "inherit"`; `animations: false` in data-dense dashboards.
- Chart `div` gets `role="img"` + `aria-label` (the chart is invisible to screen readers otherwise).
- Sizing conventions: `chart-sm` (sparkline height) / `chart-lg` (full card chart).
- Custom legend chips next to the metric: `<span class="legend bg-primary"></span> <span class="text-secondary">This year</span>` — disable ApexCharts' own legend when you do this.
- On theme toggle, re-read colors and `chart.updateOptions({ colors: […] })`.

## Vendor libraries

Tabler's blessed companions (all optional, load only what's used):

The official vendor registry is `core/libs.json` in the Tabler repo — these are the blessed pairings (load only what the page uses; `tabler-vendors.css` supplies matching skins):

| Need | Library | Wiring |
|---|---|---|
| Rich selects / tags | Tom Select — **bundled in `@tabler/core/dist/libs`** | manual `new TomSelect(el)` |
| Date / range picker | Litepicker — **bundled in `dist/libs`** | manual init; pair with `input-icon` calendar icon |
| Input masks | IMask | auto via `data-mask` attribute (see javascript.md) |
| Animated counters | countUp.js | auto via `data-countup` attribute |
| Textarea autosize | autosize | auto via `data-bs-toggle="autosize"` |
| Charts | ApexCharts | manual init, colors via `tabler.getColor` — see above |
| Table sort/filter (client-side) | List.js | pairs with `.table-sort` headers — see `datatables` demo |
| Drag & drop / kanban | SortableJS | `tasks`, `sortable` demos |
| Calendar | FullCalendar | `fullcalendar` demo |
| File upload | Dropzone | Tabler skin in `tabler-vendors.css` |
| Maps | jsVectorMap / Mapbox / Google Maps | region dashboards |
| Range slider | noUiSlider | Tabler's range-slider component |
| Star rating | star-rating.js | with Tabler `stars` styles |
| Color picker | Coloris | `colorpicker` demo |
| WYSIWYG | HugeRTE | `wysiwyg` demo |
| Lightbox | fslightbox | `gallery`/`lightbox` demos |
| Audio/video player | Plyr | `inline-player` component |
| Signatures | signature_pad | `signatures` demo |
| Product tours | driver.js | `tour` demo |
| Copy-to-clipboard | clipboard.js | code/token fields |
| Masonry grid | Masonry | `cards-masonry` demo |

"Auto" rows are wired by tabler.min.js at load — you only add the attribute and load the lib **before** tabler.min.js. Full contract in `references/javascript.md`. Server-driven apps: prefer server-side sorting/paging over List.js beyond ~500 rows.

## Layout utilities worth knowing

- `space-y` / `space-y-{n}` and `space-x` — flex stacks with gap; the preview's preferred way to stack cards/list items instead of chained `mb-*`.
- `divide-y` — hairline separators between children (activity feeds, notification lists) without per-item borders.
- `nav-bordered` — underline-style tab nav (used as kanban/list filters in the demos).
- `lh-1` on icon+text rows; `link-secondary` for muted icon-only anchors.
- Marketing layer (`tabler-marketing.css` only): `.shape` icon tiles, hero/section classes — don't pull these into app pages.
