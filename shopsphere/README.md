# ShopSphere — Phase 1: Landing Experience

Enterprise-grade e-commerce landing page. Vanilla HTML5/CSS3/ES6+, zero
frameworks, live product data from DummyJSON.

## Run it

No build step. Either:
- Open `index.html` directly in a browser, or
- Serve it locally (recommended, avoids any `file://` CORS quirks):
  ```
  npx serve .
  # or
  python3 -m http.server 8080
  ```

## What's implemented in this phase

- **Design system** (`css/tokens.css`) — a real token set (color, type,
  space, radius, motion) rather than hard-coded values, so the rest of the
  app inherits one visual language.
- **Signature motif — "The Signal"**: a gradient waveform that appears as a
  scroll-linked line under the header, in the hero's aurora mesh, and in
  buttons/badges — a visual metaphor for "intelligent search finds the
  signal in the noise."
- **Header**: sticky, blurred, scroll-aware, live search with debounced
  DummyJSON queries, match highlighting, recent + popular searches
  (persisted to `localStorage`), full keyboard support, mobile drawer.
- **Hero**: GSAP-powered line-reveal headline, animated aurora background,
  parallax product cards (ScrollTrigger), animated stat counters — all
  gated behind `prefers-reduced-motion`.
- **Categories, Trending (tabbed), Flash Sale (live countdown), Best
  Sellers, New Arrivals**: real product cards rendered from the DummyJSON
  API, with loading skeletons, graceful offline fallback, wishlist toggle,
  add-to-cart with toast confirmation — cart/wishlist persist across
  reloads via `localStorage`.
- **Testimonials**: Swiper carousel.
- **Newsletter, footer, back-to-top, scroll progress bar.**
- **Accessibility**: skip link, semantic landmarks, visible focus rings,
  aria-labels on icon buttons, `prefers-reduced-motion` and
  `prefers-contrast` support, keyboard-operable search and drawer.

## Folder structure

```
shopsphere/
├── index.html
├── css/
│   ├── tokens.css      design tokens (source of truth for theming)
│   ├── base.css         reset, typography, layout, buttons
│   ├── header.css       header, nav, search, mobile drawer, signal-line
│   ├── hero.css         hero + aurora mesh
│   ├── components.css   product cards, categories, flash sale, toasts
│   └── footer.css       footer, reveal-on-scroll utilities
└── js/
    └── main.js          state, API layer, rendering, interactions
```

`main.js` is organized in six clearly commented sections (utilities/state,
header/nav, loader/scroll/reveal, search, product rendering, cart/wishlist/
toasts/countdown) so any engineer can find and extend a feature without
reading the whole file.

## Roadmap — remaining phases

This response covers Phases 1–6 (requirements → design system → IA →
wireframe → structure → home page). Still ahead, each best done as its own
focused pass rather than rushed in bulk:

| Phase | Scope |
|---|---|
| 7 | Marketplace page: full grid, filtering sidebar (category/brand/price/rating/color/size), sort, pagination |
| 8 | Cart page: line-item editing, coupon logic, tax/shipping calc |
| 9 | Wishlist page |
| 10 | Checkout flow: address → payment UI → review → confirmation + success animation |
| 11 | Deeper API integration: retry/backoff, request caching layer, currency conversion |
| 12 | Extended motion pass (page transitions, magnetic buttons everywhere, mouse follower) |
| 13 | Performance pass (Lighthouse audit, image strategy, critical CSS) |
| 14 | Accessibility audit against WCAG 2.2 AA |
| 15 | Cross-browser QA |
| 16 | Final code review |

Tell me which phase to build next and I'll pick up exactly where this
leaves off.
