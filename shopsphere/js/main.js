/* ==========================================================================
   SHOPSPHERE — main.js
   Modular vanilla ES6+. No frameworks. Sections:
   1. Utilities & state          4. Search
   2. Header / nav / drawer      5. Product rendering (API + cards)
   3. Loader / scroll / reveal   6. Cart, wishlist, toasts, countdown
   ========================================================================== */

'use strict';

/* ============================================================
   1. UTILITIES & STATE
   ============================================================ */
const Store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
};

const State = {
  cart: Store.get('shopsphere_cart', []),
  wishlist: Store.get('shopsphere_wishlist', []),
  recentSearches: Store.get('shopsphere_recent_searches', []),
  productCache: null,
};

const debounce = (fn, wait = 250) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
};

const money = (n) => `$${Number(n).toFixed(2)}`;

const starString = (rating) => {
  const full = Math.round(rating);
  return '★★★★★☆☆☆☆☆'.slice(5 - full, 10 - full);
};

/* ============================================================
   2. HEADER / NAV / MOBILE DRAWER
   ============================================================ */
function initHeader() {
  const header = document.querySelector('.site-header');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const drawer = document.querySelector('.nav-drawer');
  const openBtn = document.querySelector('.nav-toggle');
  const closeBtn = drawer?.querySelector('.mobile-drawer-close');
  const backdrop = drawer?.querySelector('.mobile-drawer-backdrop');
  const open = () => { drawer.classList.add('is-open'); document.body.style.overflow = 'hidden'; openBtn.setAttribute('aria-expanded', 'true'); };
  const close = () => { drawer.classList.remove('is-open'); document.body.style.overflow = ''; openBtn.setAttribute('aria-expanded', 'false'); };
  openBtn?.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  backdrop?.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  drawer?.querySelectorAll('nav a').forEach((link) => link.addEventListener('click', close));
}

/* ============================================================
   3. LOADER / SCROLL PROGRESS / REVEAL SYSTEM
   ============================================================ */
function initLoader() {
  const loader = document.querySelector('.page-loader');
  window.addEventListener('load', () => {
    setTimeout(() => loader?.classList.add('is-hidden'), 350);
  });
}

function initScrollProgress() {
  const bar = document.getElementById('scroll-progress');
  const backToTop = document.querySelector('.back-to-top');
  const root = document.documentElement;
  const onScroll = () => {
    const scrolled = root.scrollTop;
    const height = root.scrollHeight - root.clientHeight;
    const pct = height > 0 ? (scrolled / height) * 100 : 0;
    bar.style.width = pct + '%';
    root.style.setProperty('--scroll-progress', Math.min(pct / 100 * 4, 1)); // signal-line fills fast near top
    backToTop.classList.toggle('is-visible', scrolled > 600);
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  backToTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  onScroll();
}

function initReveal() {
  const targets = document.querySelectorAll('[data-reveal], [data-reveal-stagger]');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
  targets.forEach((t) => io.observe(t));
}

/* Magnetic buttons — subtle attraction toward cursor */
function initMagnetic() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('.magnetic').forEach((el) => {
    const strength = 18;
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${(x / r.width) * strength}px, ${(y / r.height) * strength}px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = 'translate(0,0)'; });
  });
}

/* Hero text reveal + aurora parallax via GSAP if available, CSS fallback otherwise */
function initHeroMotion() {
  const lines = document.querySelectorAll('.hero .reveal-inner');
  if (window.gsap) {
    gsap.set(lines, { yPercent: 110 });
    gsap.to(lines, { yPercent: 0, duration: 1, ease: 'power4.out', stagger: 0.08, delay: 0.15 });
    gsap.from('.hero-eyebrow, .hero p.lede, .hero-cta-row, .hero-stats', {
      opacity: 0, y: 16, duration: 0.8, stagger: 0.08, delay: 0.35, ease: 'power2.out'
    });
    gsap.from('.hero-card', { opacity: 0, y: 40, duration: 1, stagger: 0.12, delay: 0.3, ease: 'power3.out' });

    // Gentle idle float, bounded to a few pixels — intentionally NOT scroll-linked.
    // A scroll-scrubbed version previously pushed cards past the hero's clipped
    // edge as the page scrolled, cropping them. This stays fully inside the card's
    // own space regardless of scroll position.
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.hero-card').forEach((card, i) => {
        gsap.to(card, {
          y: (i % 2 === 0 ? -10 : 10),
          duration: 3 + i * 0.4,
          ease: 'sine.inOut',
          repeat: -1,
          yoyo: true,
          delay: 0.8 + i * 0.2,
        });
      });
    }
  } else {
    lines.forEach((l) => l.style.transform = 'translateY(0)');
  }
}

/* ============================================================
   4. INTELLIGENT SEARCH
   ============================================================ */
const POPULAR_SEARCHES = ['Wireless Headphones', 'Running Shoes', 'Smart Watch', 'Sunglasses', 'Backpack', 'Skincare'];

function highlight(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return `${text.slice(0, idx)}<mark>${text.slice(idx, idx + query.length)}</mark>${text.slice(idx + query.length)}`;
}

function initSearch() {
  const inputs = document.querySelectorAll('.js-search-input');
  inputs.forEach((input) => {
    const panel = input.closest('.header-search, .mobile-drawer').querySelector('.search-panel');
    if (!panel) return;

    const renderIdle = () => {
      panel.innerHTML = `
        <h4>Recent searches</h4>
        <div class="search-chip-row">
          ${(State.recentSearches.length ? State.recentSearches : ['No recent searches yet']).map((s) =>
            State.recentSearches.length ? `<button class="search-chip" data-term="${s}">${s}</button>` : `<span class="search-empty" style="padding:0">${s}</span>`
          ).join('')}
        </div>
        <h4>Popular searches</h4>
        <div class="search-chip-row">
          ${POPULAR_SEARCHES.map((s) => `<button class="search-chip" data-term="${s}">${s}</button>`).join('')}
        </div>`;
      panel.querySelectorAll('.search-chip[data-term]').forEach((chip) => {
        chip.addEventListener('click', () => { input.value = chip.dataset.term; runSearch(chip.dataset.term); input.focus(); });
      });
    };

    const runSearch = debounce(async (query) => {
      if (!query || query.trim().length < 2) { renderIdle(); return; }
      panel.innerHTML = `<div class="search-empty">Searching…</div>`;
      const products = await fetchAllProducts();
      const matches = products.filter((p) => p.title.toLowerCase().includes(query.toLowerCase())).slice(0, 6);

      if (!matches.length) {
        panel.innerHTML = `<div class="search-empty">No products match "${query}". Try a different term.</div>`;
        return;
      }
      panel.innerHTML = `
        <h4>${matches.length} result${matches.length > 1 ? 's' : ''}</h4>
        ${matches.map((p) => `
          <a class="search-result-row" href="#" data-id="${p.id}">
            <img src="${p.thumbnail}" alt="" loading="lazy">
            <span class="name">${highlight(p.title, query)}</span>
            <span class="price">${money(p.price)}</span>
          </a>`).join('')}`;
      panel.querySelectorAll('.search-result-row').forEach((row) => {
        row.addEventListener('click', (e) => {
          e.preventDefault();
          panel.classList.remove('is-open');
          openProductModal(row.dataset.id, row);
        });
      });
    }, 300);

    input.addEventListener('focus', () => { panel.classList.add('is-open'); if (!input.value) renderIdle(); });
    input.addEventListener('input', (e) => runSearch(e.target.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        const term = input.value.trim();
        State.recentSearches = [term, ...State.recentSearches.filter((s) => s !== term)].slice(0, 5);
        Store.set('shopsphere_recent_searches', State.recentSearches);
      }
      if (e.key === 'Escape') { panel.classList.remove('is-open'); input.blur(); }
    });
    document.addEventListener('click', (e) => {
      if (!input.closest('.header-search, .mobile-drawer')?.contains(e.target)) panel.classList.remove('is-open');
    });
  });
}

/* ============================================================
   5. PRODUCT DATA (DummyJSON) + RENDERING
   ============================================================ */

/* Curation: products listed here are filtered out everywhere — every
   grid, tab, and search result — rather than hidden in just one place. */
const EXCLUDED_PRODUCT_TITLES = ['red lipstick'];
const isExcluded = (p) => EXCLUDED_PRODUCT_TITLES.includes((p.title || '').trim().toLowerCase());

async function fetchAllProducts() {
  if (State.productCache) return State.productCache;
  try {
    const res = await fetch('https://dummyjson.com/products?limit=0');
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    State.productCache = data.products.filter((p) => !isExcluded(p));
    return State.productCache;
  } catch (err) {
    console.error('[ShopSphere] product fetch failed, using fallback set', err);
    return FALLBACK_PRODUCTS;
  }
}

async function fetchByCategory(category, limit = 8) {
  try {
    // over-fetch a small buffer so filtering out excluded items never
    // shrinks the grid below the requested count
    const res = await fetch(`https://dummyjson.com/products/category/${encodeURIComponent(category)}?limit=${limit + 6}`);
    if (!res.ok) throw new Error('bad response');
    const data = await res.json();
    return data.products.filter((p) => !isExcluded(p));
  } catch (err) {
    const all = await fetchAllProducts();
    return all.slice(0, limit);
  }
}

/* Minimal offline fallback so the UI never breaks if the API is unreachable */
const FALLBACK_PRODUCTS = Array.from({ length: 8 }).map((_, i) => ({
  id: `local-${i}`,
  title: 'Product unavailable offline',
  price: 0,
  discountPercentage: 0,
  rating: 4,
  thumbnail: `https://picsum.photos/seed/shopsphere-fallback-${i}/600/600`,
  category: 'general'
}));

function productCardHTML(p, opts = {}) {
  const discount = p.discountPercentage ? Math.round(p.discountPercentage) : 0;
  const original = discount ? (p.price / (1 - discount / 100)) : null;
  const isNew = opts.badgeNew;
  const isWishlisted = State.wishlist.includes(String(p.id));
  return `
    <article class="product-card" data-id="${p.id}" data-price="${p.price}" data-title="${p.title.toLowerCase()}" data-rating="${p.rating || 0}">
      <div class="product-media">
        <span class="badge-row">
          ${isNew ? `<span class="badge badge--new">New</span>` : ''}
          ${discount ? `<span class="badge badge--sale">-${discount}%</span>` : ''}
        </span>
        <button class="wishlist-btn ${isWishlisted ? 'is-active' : ''}" aria-label="Toggle wishlist" data-action="wishlist">
          <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
        </button>
        <img src="${p.thumbnail}" alt="${p.title}" loading="lazy" width="300" height="300">
        <span class="quick-view-btn" data-action="quickview">Quick view</span>
      </div>
      <div class="product-info">
        <p class="product-cat">${p.category}</p>
        <h3 class="product-name">${p.title}</h3>
        <p class="product-rating"><span class="stars">${starString(p.rating || 4)}</span> ${(p.rating || 4).toFixed(1)}</p>
        <div class="product-price-row">
          <span class="price-now">${money(p.price)}</span>
          ${original ? `<span class="price-was">${money(original)}</span><span class="price-off">Save ${discount}%</span>` : ''}
        </div>
        <div class="add-to-cart-row">
          <button class="add-to-cart-btn" data-action="cart">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>
            Add to cart
          </button>
        </div>
      </div>
    </article>`;
}

function skeletonCardsHTML(n = 8) {
  return Array.from({ length: n }).map(() => `
    <article class="product-card skeleton-card">
      <div class="product-media skeleton"></div>
      <div class="skeleton-line w60 skeleton"></div>
      <div class="skeleton-line w40 skeleton"></div>
    </article>`).join('');
}

async function renderProductSection(gridEl, { category = null, sort = null, badgeNew = false, limit = 8 } = {}) {
  gridEl.innerHTML = skeletonCardsHTML(limit);
  let products = category ? await fetchByCategory(category, limit) : (await fetchAllProducts()).slice(0, limit);

  if (sort === 'rating') products = [...products].sort((a, b) => b.rating - a.rating);
  if (sort === 'priceAsc') products = [...products].sort((a, b) => a.price - b.price);
  if (sort === 'priceDesc') products = [...products].sort((a, b) => b.price - a.price);
  if (sort === 'discount') products = [...products].sort((a, b) => (b.discountPercentage || 0) - (a.discountPercentage || 0));

  gridEl.innerHTML = products.slice(0, limit).map((p) => productCardHTML(p, { badgeNew })).join('');
  bindProductCardEvents(gridEl);
}

function initTabs() {
  document.querySelectorAll('.tab-row').forEach((row) => {
    const grid = document.querySelector(row.dataset.target);
    row.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        row.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        renderProductSection(grid, {
          category: btn.dataset.category || null,
          sort: btn.dataset.sort || null,
          badgeNew: row.dataset.badgeNew === 'true',
          limit: 8
        });
      });
    });
  });
}

/* ---- Custom cursor: dot + trailing ring, mouse devices only ---- */
function initCustomCursor() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.body.classList.add('has-custom-cursor');
  const dot = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  if (!dot || !ring) return;

  const moveDot = window.gsap ? gsap.quickTo(dot, 'x', { duration: 0.05, ease: 'none' }) : null;
  const moveDotY = window.gsap ? gsap.quickTo(dot, 'y', { duration: 0.05, ease: 'none' }) : null;
  const moveRing = window.gsap ? gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power3.out' }) : null;
  const moveRingY = window.gsap ? gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power3.out' }) : null;

  document.addEventListener('mousemove', (e) => {
    if (window.gsap) {
      moveDot(e.clientX); moveDotY(e.clientY);
      moveRing(e.clientX); moveRingY(e.clientY);
    } else {
      dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px';
      ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px';
    }
  });

  document.addEventListener('mouseover', (e) => {
    const interactive = e.target.closest('a, button, input, .product-card');
    ring.classList.toggle('is-active', !!interactive);
  });
  document.addEventListener('mousedown', () => ring.classList.add('is-active'));
  document.addEventListener('mouseup', () => ring.classList.remove('is-active'));
}

/* ---- 3D tilt on product cards, mouse devices only ---- */
function initCardTilt() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // delegate via mouseover to bind newly-rendered cards lazily
  const bindTilt = (card) => {
    if (card.dataset.tiltBound === 'true') return;
    card.dataset.tiltBound = 'true';
    const strength = 8;
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      const rotY = px * strength;
      const rotX = -py * strength;
      if (window.gsap) {
        gsap.to(card, { rotateX: rotX, rotateY: rotY, duration: 0.4, ease: 'power2.out', overwrite: true });
      } else {
        card.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
      }
    });
    card.addEventListener('mouseleave', () => {
      if (window.gsap) gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.5, ease: 'power3.out' });
      else card.style.transform = '';
    });
  };
  document.addEventListener('mouseover', (e) => {
    const card = e.target.closest('.product-card');
    if (card) bindTilt(card);
  });
}

/* ---- Fly-to-cart: the product thumbnail visibly arcs into the cart icon ---- */
function flyToCart(sourceImgEl) {
  const cartIcon = document.querySelector('.js-cart-toggle');
  if (!sourceImgEl || !cartIcon || !window.gsap) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const startRect = sourceImgEl.getBoundingClientRect();
  const endRect = cartIcon.getBoundingClientRect();

  const ghost = sourceImgEl.cloneNode(true);
  ghost.className = 'fly-ghost';
  ghost.style.left = startRect.left + 'px';
  ghost.style.top = startRect.top + 'px';
  ghost.style.width = startRect.width + 'px';
  ghost.style.height = startRect.height + 'px';
  document.body.appendChild(ghost);

  gsap.timeline({ onComplete: () => { ghost.remove(); cartIcon.classList.add('is-bumped'); setTimeout(() => cartIcon.classList.remove('is-bumped'), 400); } })
    .to(ghost, {
      left: endRect.left + endRect.width / 2 - 10,
      top: endRect.top + endRect.height / 2 - 10,
      width: 20, height: 20,
      opacity: 0.4,
      duration: 0.65,
      ease: 'power2.in',
      rotate: 15,
    });
}

/* ---- Product detail modal ---- */
const ModalState = { product: null, qty: 1, triggerEl: null };

function renderModalGallery(product) {
  const images = (product.images && product.images.length ? product.images : [product.thumbnail]).slice(0, 5);
  const mainImg = document.querySelector('.js-modal-main-img');
  const thumbs = document.querySelector('.js-modal-thumbs');
  mainImg.src = images[0];
  mainImg.alt = product.title;
  thumbs.innerHTML = images.map((src, i) => `<img src="${src}" alt="" class="${i === 0 ? 'is-active' : ''}" data-src="${src}">`).join('');
  thumbs.querySelectorAll('img').forEach((t) => {
    t.addEventListener('click', () => {
      mainImg.src = t.dataset.src;
      thumbs.querySelectorAll('img').forEach((x) => x.classList.remove('is-active'));
      t.classList.add('is-active');
    });
  });
}

function renderModalQty() {
  document.querySelector('.js-modal-qty').textContent = ModalState.qty;
}

async function renderModalRelated(product) {
  const grid = document.querySelector('.js-modal-related');
  const all = await fetchAllProducts();
  const related = all.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 3);
  grid.innerHTML = related.map((p) => `
    <div class="modal-related-item" data-id="${p.id}">
      <img src="${p.thumbnail}" alt="">
      <p class="name">${p.title}</p>
      <p class="price">${money(p.price)}</p>
    </div>`).join('');
  grid.querySelectorAll('.modal-related-item').forEach((el) => {
    el.addEventListener('click', async () => {
      const p = related.find((r) => String(r.id) === el.dataset.id);
      if (p) await openProductModal(p, el);
    });
  });
}

async function openProductModal(productOrId, triggerEl) {
  const modal = document.getElementById('product-modal');
  if (!modal) return;
  const all = await fetchAllProducts();
  const product = typeof productOrId === 'object' ? productOrId : all.find((p) => String(p.id) === String(productOrId));
  if (!product) { showToast('Product not found'); return; }

  ModalState.product = product;
  ModalState.qty = 1;
  ModalState.triggerEl = triggerEl || document.activeElement;

  document.querySelector('.js-modal-cat').textContent = product.category;
  document.querySelector('.js-modal-title').textContent = product.title;
  document.querySelector('.js-modal-rating').innerHTML = `<span class="stars">${starString(product.rating || 4)}</span> ${(product.rating || 4).toFixed(1)} · ${product.stock ?? '—'} in stock`;

  const discount = product.discountPercentage ? Math.round(product.discountPercentage) : 0;
  const original = discount ? (product.price / (1 - discount / 100)) : null;
  document.querySelector('.js-modal-price').innerHTML = `
    <span class="price-now">${money(product.price)}</span>
    ${original ? `<span class="price-was">${money(original)}</span><span class="price-off">Save ${discount}%</span>` : ''}`;

  document.querySelector('.js-modal-desc').textContent = product.description || 'No description available for this product.';

  const stockEl = document.querySelector('.js-modal-stock');
  const inStock = (product.stock ?? 1) > 0;
  const low = inStock && product.stock < 10;
  stockEl.textContent = inStock ? (low ? `Only ${product.stock} left` : 'In stock, ready to ship') : 'Out of stock';
  stockEl.classList.toggle('is-low', low || !inStock);

  const wishBtn = document.querySelector('.js-modal-wishlist');
  const isWishlisted = State.wishlist.includes(String(product.id));
  wishBtn.classList.toggle('is-active', isWishlisted);

  renderModalGallery(product);
  renderModalQty();
  renderModalRelated(product);

  modal.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  modal.querySelector('.product-modal-close').focus();
}

function closeProductModal() {
  const modal = document.getElementById('product-modal');
  modal.classList.remove('is-open');
  document.body.style.overflow = '';
  ModalState.triggerEl?.focus?.();
}

function initProductModal() {
  const modal = document.getElementById('product-modal');
  if (!modal) return;
  const panel = modal.querySelector('.product-modal-panel');

  modal.querySelector('.product-modal-close').addEventListener('click', closeProductModal);
  modal.querySelector('.product-modal-backdrop').addEventListener('click', closeProductModal);

  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('is-open')) return;
    if (e.key === 'Escape') { closeProductModal(); return; }
    // simple focus trap
    if (e.key === 'Tab') {
      const focusables = panel.querySelectorAll('button, a, input, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  modal.querySelector('.js-modal-qty-stepper [data-action="inc"]').addEventListener('click', () => {
    ModalState.qty += 1; renderModalQty();
  });
  modal.querySelector('.js-modal-qty-stepper [data-action="dec"]').addEventListener('click', () => {
    ModalState.qty = Math.max(1, ModalState.qty - 1); renderModalQty();
  });

  modal.querySelector('.js-modal-wishlist').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const id = String(ModalState.product.id);
    const has = State.wishlist.includes(id);
    State.wishlist = has ? State.wishlist.filter((w) => w !== id) : [...State.wishlist, id];
    Store.set('shopsphere_wishlist', State.wishlist);
    btn.classList.toggle('is-active', !has);
    updateBadges();
    document.querySelectorAll(`.product-card[data-id="${id}"] .wishlist-btn`).forEach((b) => b.classList.toggle('is-active', !has));
    showToast(has ? 'Removed from wishlist' : 'Saved to wishlist', ModalState.product.title);
  });

  modal.querySelector('.js-modal-add-cart').addEventListener('click', () => {
    const p = ModalState.product;
    const id = String(p.id);
    const existing = State.cart.find((i) => i.id === id);
    if (existing) existing.qty += ModalState.qty;
    else State.cart.push({ id, title: p.title, price: p.price, qty: ModalState.qty, thumbnail: p.thumbnail });
    Store.set('shopsphere_cart', State.cart);
    updateBadges();
    flyToCart(document.querySelector('.js-modal-main-img'));
    showToast('Added to cart', `${p.title} × ${ModalState.qty}`);
  });
}

/* ============================================================
   6. CART / WISHLIST / TOASTS / COUNTDOWN
   ============================================================ */
function updateBadges() {
  const cartBadge = document.querySelector('.js-cart-count');
  const wishBadge = document.querySelector('.js-wishlist-count');
  if (cartBadge) {
    const count = State.cart.reduce((sum, i) => sum + i.qty, 0);
    cartBadge.textContent = count;
    cartBadge.classList.toggle('is-visible', count > 0);
  }
  if (wishBadge) {
    wishBadge.textContent = State.wishlist.length;
    wishBadge.classList.toggle('is-visible', State.wishlist.length > 0);
  }
}

function showToast(msg, sub = '') {
  const region = document.querySelector('.toast-region');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span class="icon-wrap"><svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
    <span><span class="msg">${msg}</span>${sub ? `<br><span class="sub">${sub}</span>` : ''}</span>`;
  region.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('is-leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 2600);
}

function bindProductCardEvents(scope = document) {
  scope.querySelectorAll('.product-card').forEach((card) => {
    const id = String(card.dataset.id);
    const title = card.querySelector('.product-name')?.textContent || 'Item';

    card.querySelector('[data-action="wishlist"]')?.addEventListener('click', (e) => {
      e.preventDefault();
      const btn = e.currentTarget;
      const has = State.wishlist.includes(id);
      State.wishlist = has ? State.wishlist.filter((w) => w !== id) : [...State.wishlist, id];
      Store.set('shopsphere_wishlist', State.wishlist);
      btn.classList.toggle('is-active', !has);
      updateBadges();
      showToast(has ? 'Removed from wishlist' : 'Saved to wishlist', title);
    });

    card.querySelector('[data-action="cart"]')?.addEventListener('click', (e) => {
      const btn = e.currentTarget;
      const imgEl = card.querySelector('.product-media img');
      const thumbnail = imgEl?.src || '';
      const existing = State.cart.find((i) => i.id === id);
      if (existing) existing.qty += 1;
      else State.cart.push({ id, title, price: parseFloat(card.dataset.price), qty: 1, thumbnail });
      Store.set('shopsphere_cart', State.cart);
      flyToCart(imgEl);
      updateBadges();
      btn.classList.add('is-added');
      const original = btn.innerHTML;
      btn.innerHTML = 'Added ✓';
      setTimeout(() => { btn.classList.remove('is-added'); btn.innerHTML = original; }, 1400);
      showToast('Added to cart', title);
    });

    card.querySelector('.product-media img')?.addEventListener('click', () => openProductModal(id, card));
    card.querySelector('.product-name')?.addEventListener('click', () => openProductModal(id, card));

    card.querySelector('[data-action="quickview"]')?.addEventListener('click', (e) => {
      e.preventDefault();
      openProductModal(id, e.currentTarget);
    });
  });
}

/* ---- Wishlist drawer: open/close + render ---- */
async function renderWishlistDrawer() {
  const list = document.querySelector('.js-wishlist-items');
  if (!list) return;

  if (!State.wishlist.length) {
    list.innerHTML = `
      <div class="cart-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
        <p>Nothing saved yet.</p>
      </div>`;
    return;
  }

  list.innerHTML = `<div class="cart-empty"><p>Loading…</p></div>`;
  const all = await fetchAllProducts();
  const items = State.wishlist.map((id) => all.find((p) => String(p.id) === id)).filter(Boolean);

  if (!items.length) {
    list.innerHTML = `<div class="cart-empty"><p>Nothing saved yet.</p></div>`;
    return;
  }

  list.innerHTML = items.map((p) => `
    <div class="cart-item-row" data-id="${p.id}">
      <img src="${p.thumbnail}" alt="" loading="lazy">
      <div>
        <p class="cart-item-title">${p.title}</p>
        <p class="cart-item-price">${money(p.price)}</p>
      </div>
      <button class="cart-item-remove" type="button" data-action="remove-wish">Remove</button>
    </div>`).join('');

  list.querySelectorAll('[data-action="remove-wish"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.cart-item-row').dataset.id;
      State.wishlist = State.wishlist.filter((w) => w !== id);
      Store.set('shopsphere_wishlist', State.wishlist);
      updateBadges();
      renderWishlistDrawer();
      document.querySelectorAll(`.product-card[data-id="${id}"] .wishlist-btn`).forEach((b) => b.classList.remove('is-active'));
    });
  });
}

/* ---- Shared focus trap for any open overlay panel (drawers, modal) ---- */
function trapFocusIn(panel, isOpen) {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || !isOpen()) return;
    const focusables = panel.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

function initWishlistDrawer() {
  const drawer = document.getElementById('wishlist-drawer');
  const toggle = document.querySelector('.js-wishlist-toggle');
  const closeBtn = document.querySelector('.js-wishlist-close');
  const backdrop = drawer?.querySelector('.mobile-drawer-backdrop');
  if (!drawer || !toggle) return;

  const open = () => {
    renderWishlistDrawer();
    drawer.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    toggle.setAttribute('aria-expanded', 'true');
    closeBtn?.focus();
  };
  const close = () => {
    drawer.classList.remove('is-open');
    document.body.style.overflow = '';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  };
  toggle.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  backdrop?.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('is-open')) close(); });
  trapFocusIn(drawer.querySelector('.mobile-drawer-panel'), () => drawer.classList.contains('is-open'));
}

/* ---- Cart drawer: open/close + render ---- */
function renderCartDrawer() {
  const list = document.querySelector('.js-cart-items');
  const subtotalEl = document.querySelector('.js-cart-subtotal');
  if (!list) return;

  if (!State.cart.length) {
    list.innerHTML = `
      <div class="cart-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg>
        <p>Your cart is empty.</p>
      </div>`;
    if (subtotalEl) subtotalEl.textContent = money(0);
    return;
  }

  list.innerHTML = State.cart.map((item) => `
    <div class="cart-item-row" data-id="${item.id}">
      <img src="${item.thumbnail || ''}" alt="" loading="lazy">
      <div>
        <p class="cart-item-title">${item.title}</p>
        <p class="cart-item-price">${money(item.price)}</p>
        <div class="qty-stepper">
          <button type="button" data-action="dec" aria-label="Decrease quantity">−</button>
          <span class="qty-val">${item.qty}</span>
          <button type="button" data-action="inc" aria-label="Increase quantity">+</button>
        </div>
      </div>
      <button class="cart-item-remove" type="button" data-action="remove">Remove</button>
    </div>`).join('');

  const subtotal = State.cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  if (subtotalEl) subtotalEl.textContent = money(subtotal);

  list.querySelectorAll('.cart-item-row').forEach((row) => {
    const id = row.dataset.id;
    row.querySelector('[data-action="inc"]')?.addEventListener('click', () => changeCartQty(id, 1));
    row.querySelector('[data-action="dec"]')?.addEventListener('click', () => changeCartQty(id, -1));
    row.querySelector('[data-action="remove"]')?.addEventListener('click', () => removeFromCart(id));
  });
}

function changeCartQty(id, delta) {
  const item = State.cart.find((i) => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) State.cart = State.cart.filter((i) => i.id !== id);
  Store.set('shopsphere_cart', State.cart);
  updateBadges();
  renderCartDrawer();
}

function removeFromCart(id) {
  State.cart = State.cart.filter((i) => i.id !== id);
  Store.set('shopsphere_cart', State.cart);
  updateBadges();
  renderCartDrawer();
}

function initCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const toggle = document.querySelector('.js-cart-toggle');
  const closeBtn = document.querySelector('.js-cart-close');
  const backdrop = drawer?.querySelector('.mobile-drawer-backdrop');
  if (!drawer || !toggle) return;

  const open = () => {
    renderCartDrawer();
    drawer.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    toggle.setAttribute('aria-expanded', 'true');
    closeBtn?.focus();
  };
  const close = () => {
    drawer.classList.remove('is-open');
    document.body.style.overflow = '';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  };
  toggle.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  backdrop?.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('is-open')) close(); });
  trapFocusIn(drawer.querySelector('.mobile-drawer-panel'), () => drawer.classList.contains('is-open'));

  document.querySelector('.cart-checkout-btn')?.addEventListener('click', () => {
    showToast('Checkout', 'Full checkout flow ships in a later phase.');
  });
}

/* ---- Flash sale countdown (persists a real deadline across reloads) ---- */
function initCountdown() {
  const el = document.querySelector('.countdown');
  if (!el) return;
  let deadline = Store.get('shopsphere_flash_deadline', null);
  if (!deadline || deadline < Date.now()) {
    deadline = Date.now() + 1000 * 60 * 60 * 8; // 8 hour flash window
    Store.set('shopsphere_flash_deadline', deadline);
  }
  const hEl = el.querySelector('.js-h'), mEl = el.querySelector('.js-m'), sEl = el.querySelector('.js-s');
  const tick = () => {
    const diff = Math.max(0, deadline - Date.now());
    const h = String(Math.floor(diff / 3.6e6)).padStart(2, '0');
    const m = String(Math.floor((diff % 3.6e6) / 6e4)).padStart(2, '0');
    const s = String(Math.floor((diff % 6e4) / 1000)).padStart(2, '0');
    if (hEl) hEl.textContent = h;
    if (mEl) mEl.textContent = m;
    if (sEl) sEl.textContent = s;
  };
  tick();
  setInterval(tick, 1000);
}

/* ---- Animated counters (hero stats) ---- */
function initCounters() {
  const counters = document.querySelectorAll('[data-count-to]');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseFloat(el.dataset.countTo);
      const suffix = el.dataset.suffix || '';
      const duration = 1400;
      const start = performance.now();
      const step = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = (target * eased).toFixed(target % 1 !== 0 ? 1 : 0) + suffix;
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      io.unobserve(el);
    });
  }, { threshold: 0.6 });
  counters.forEach((c) => io.observe(c));
}

/* ---- Category cards: quietly upgrade to a live product photo ---- */

async function initCategoryImages() {
  const cards = document.querySelectorAll('.category-card[data-cat-keys]');
  if (!cards.length) return;

  // The HTML already ships a real, direct photo in `src` for every card, so
  // there's never a blank/colorless moment. This just quietly swaps in a
  // live, better-matched product photo in the background once it's ready —
  // and if that fails for any reason, the original photo simply stays put.
  cards.forEach(async (card) => {
    const rawKeys = card.dataset.catKeys;
    const keys = rawKeys.split(',').map((k) => k.trim());
    const img = card.querySelector('.category-img');
    if (!img) return;

    for (const key of keys) {
      try {
        const products = await fetchByCategory(key, 1);
        if (products.length && products[0].thumbnail) {
          const preload = new Image();
          preload.onload = () => { img.src = products[0].thumbnail; };
          preload.src = products[0].thumbnail;
          break;
        }
      } catch { /* keep the existing photo, try next key */ }
    }
  });
}

/* ---- Hero visual: fill with real, verified thumbnails from the API
   instead of guessed CDN paths, so the images never 404. ---- */
async function initHeroImages() {
  const slots = document.querySelectorAll('.hero-card img[data-hero-slot]');
  if (!slots.length) return;
  const products = await fetchAllProducts();
  // pick a few well-rated, image-bearing products for visual variety
  const picks = [...products].filter((p) => p.thumbnail).sort((a, b) => b.rating - a.rating).slice(0, slots.length);
  slots.forEach((img, i) => {
    if (picks[i]) {
      img.src = picks[i].thumbnail;
      img.alt = picks[i].title;
    }
  });
}

/* ---- Global ⌘K / Ctrl+K shortcut to focus the header search ---- */
function initSearchShortcut() {
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      document.querySelector('.site-header .js-search-input')?.focus();
    }
  });
}

/* ============================================================
   NEWSLETTER
   ============================================================ */
function initNewsletter() {
  document.querySelector('.newsletter-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    if (!input.value) return;
    showToast('You\u2019re on the list', input.value);
    input.value = '';
  });
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  initLoader();
  initHeader();
  initCartDrawer();
  initWishlistDrawer();
  initProductModal();
  initScrollProgress();
  initMagnetic();
  initCustomCursor();
  initCardTilt();
  initHeroMotion();
  initSearch();
  initSearchShortcut();
  initTabs();
  initCountdown();
  initCounters();
  initNewsletter();
  updateBadges();
  initReveal();

  // initial sections
  await Promise.all([
    renderProductSection(document.querySelector('#trending-grid'), { limit: 8, badgeNew: false }),
    renderProductSection(document.querySelector('#flashsale-grid'), { sort: 'discount', limit: 4 }),
    renderProductSection(document.querySelector('#bestsellers-grid'), { sort: 'rating', limit: 4 }),
    renderProductSection(document.querySelector('#newarrivals-grid'), { limit: 4, badgeNew: true }),
  ]);
  initReveal(); // re-scan after dynamic content mounts
  initHeroImages();
  initCategoryImages();

  // Swiper for testimonials, if library present
  if (window.Swiper) {
    new Swiper('.testimonial-swiper', {
      slidesPerView: 1.1,
      spaceBetween: 20,
      breakpoints: { 720: { slidesPerView: 2.2 }, 1100: { slidesPerView: 3 } },
      grabCursor: true,
      a11y: true,
    });
  }
});
