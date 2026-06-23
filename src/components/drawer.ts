import { buildDataRows, setEditingKey } from '../state/store';

/* ==========================================================================
   Review Drawer Component
   ========================================================================== */

/** Opens or closes the review drawer */
export function toggleReviewDrawer(e?: Event): void {
  if (e) e.stopPropagation();
  const drawer = document.getElementById('review-drawer');
  if (!drawer) return;
  if (drawer.classList.contains('open')) {
    closeReviewDrawer();
  } else {
    openReviewDrawer();
  }
}

/** Opens the drawer and renders the data table */
export function openReviewDrawer(): void {
  setEditingKey(null);
  renderDrawerTable();
  const drawer = document.getElementById('review-drawer');
  const overlay = document.getElementById('drawer-overlay');
  if (drawer) { drawer.classList.remove('hidden'); drawer.classList.add('open'); }
  if (overlay) overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

/** Closes the drawer */
export function closeReviewDrawer(): void {
  const drawer = document.getElementById('review-drawer');
  const overlay = document.getElementById('drawer-overlay');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.add('hidden');
  document.body.style.overflow = '';
}

/** Renders horizontal tables inside the drawer */
export function renderDrawerTable(): void {
  const container = document.getElementById('drawer-tables-container');
  if (!container) return;
  container.innerHTML = buildDataRows();
}
