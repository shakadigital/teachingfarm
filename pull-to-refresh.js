// ═══════════════════════════════════════════════════
// PULL TO REFRESH - Teaching Farm UB
// ═══════════════════════════════════════════════════

class PullToRefresh {
  constructor() {
    this.startY = 0;
    this.currentY = 0;
    this.pullDistance = 0;
    this.threshold = 80;
    this.maxPullDistance = 120;
    this.isRefreshing = false;
    this.isPulling = false;
    this.refreshElement = null;
    
    this.init();
  }

  init() {
    this.createRefreshElement();
    this.attachEventListeners();
  }

  createRefreshElement() {
    // Create pull-to-refresh indicator
    this.refreshElement = document.createElement('div');
    this.refreshElement.id = 'pull-to-refresh';
    this.refreshElement.className = 'pull-to-refresh';
    this.refreshElement.innerHTML = `
      <div class="ptr-content">
        <div class="ptr-icon">↓</div>
        <div class="ptr-text">Tarik untuk refresh</div>
      </div>
    `;
    
    // Insert at the beginning of app
    const app = document.getElementById('app');
    if (app) {
      app.insertBefore(this.refreshElement, app.firstChild);
    }
  }

  attachEventListeners() {
    const app = document.getElementById('app');
    if (!app) return;

    app.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
    app.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    app.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });
  }

  handleTouchStart(e) {
    // Only trigger at the top of the page
    if (window.scrollY > 0) return;
    
    // Don't interfere with form inputs or buttons
    if (this.shouldIgnoreTouch(e.target)) return;

    const touch = e.touches[0];
    this.startY = touch.clientY;
    this.isPulling = false;
  }

  handleTouchMove(e) {
    if (this.startY === 0 || this.isRefreshing) return;
    
    // Only work when at the top of the page
    if (window.scrollY > 0) return;

    const touch = e.touches[0];
    this.currentY = touch.clientY;
    this.pullDistance = Math.max(0, this.currentY - this.startY);

    // Start pulling if moved down enough
    if (this.pullDistance > 10) {
      this.isPulling = true;
      e.preventDefault(); // Prevent default scroll
    }

    if (this.isPulling) {
      this.updatePullIndicator();
    }
  }

  handleTouchEnd(e) {
    if (!this.isPulling || this.isRefreshing) {
      this.resetPull();
      return;
    }

    // Trigger refresh if pulled enough
    if (this.pullDistance >= this.threshold) {
      this.triggerRefresh();
    } else {
      this.resetPull();
    }
  }

  updatePullIndicator() {
    const progress = Math.min(this.pullDistance / this.threshold, 1);
    const dampedDistance = this.pullDistance * 0.5; // Damping effect
    const maxDistance = Math.min(dampedDistance, this.maxPullDistance);
    
    // Update position
    this.refreshElement.style.transform = `translateY(${maxDistance - 60}px)`;
    this.refreshElement.style.opacity = Math.min(progress, 1);
    
    const icon = this.refreshElement.querySelector('.ptr-icon');
    const text = this.refreshElement.querySelector('.ptr-text');
    
    if (progress >= 1) {
      // Ready to refresh
      icon.textContent = '↑';
      text.textContent = 'Lepas untuk refresh';
      icon.style.transform = 'rotate(180deg)';
      this.refreshElement.classList.add('ready');
    } else {
      // Still pulling
      icon.textContent = '↓';
      text.textContent = 'Tarik untuk refresh';
      icon.style.transform = `rotate(${progress * 180}deg)`;
      this.refreshElement.classList.remove('ready');
    }
  }

  async triggerRefresh() {
    if (this.isRefreshing) return;
    
    this.isRefreshing = true;
    this.refreshElement.classList.add('refreshing');
    
    const icon = this.refreshElement.querySelector('.ptr-icon');
    const text = this.refreshElement.querySelector('.ptr-text');
    
    // Show refreshing state
    icon.innerHTML = '<div class="spinner-small"></div>';
    text.textContent = 'Memuat ulang...';
    this.refreshElement.style.transform = 'translateY(0px)';
    
    // Add haptic feedback
    if (window.hapticFeedback) {
      window.hapticFeedback('medium');
    }

    try {
      // Determine current page and refresh accordingly
      const currentPage = this.getCurrentPage();
      await this.refreshCurrentPage(currentPage);
      
      // Show success feedback
      icon.textContent = '✓';
      text.textContent = 'Berhasil dimuat ulang';
      
      if (window.hapticFeedback) {
        window.hapticFeedback('success');
      }
      
    } catch (error) {
      console.error('Refresh failed:', error);
      
      // Show error feedback
      icon.textContent = '✗';
      text.textContent = 'Gagal memuat ulang';
      
      if (window.hapticFeedback) {
        window.hapticFeedback('error');
      }
    }

    // Hide refresh indicator after delay
    setTimeout(() => {
      this.resetPull();
    }, 1000);
  }

  async refreshCurrentPage(page) {
    // Refresh data based on current page
    switch (page) {
      case 'home':
        if (typeof renderHome === 'function') await renderHome();
        break;
      case 'input':
        if (typeof renderInput === 'function') await renderInput();
        break;
      case 'penjualan':
        if (typeof renderPenjualan === 'function') await renderPenjualan();
        break;
      case 'gudang':
        if (typeof renderGudang === 'function') await renderGudang();
        break;
      case 'biaya':
        if (typeof renderKasSaldo === 'function') await renderKasSaldo();
        break;
      case 'laporan':
        if (typeof renderLaporan === 'function') await renderLaporan();
        break;
      case 'riwayat':
        if (typeof renderRiwayat === 'function') await renderRiwayat();
        break;
      case 'settings':
        if (typeof renderSettings === 'function') await renderSettings();
        break;
      default:
        // Generic refresh - clear cache and reload current view
        if (typeof cache !== 'undefined' && cache.clear) {
          cache.clear();
        }
        break;
    }

    // Also trigger offline sync if available
    if (window.offlineManager && window.offlineManager.checkAndSyncIfNeeded) {
      await window.offlineManager.checkAndSyncIfNeeded();
    }
  }

  getCurrentPage() {
    const activePage = document.querySelector('.page.active');
    if (activePage) {
      return activePage.id.replace('page-', '');
    }
    return 'home';
  }

  resetPull() {
    this.isPulling = false;
    this.isRefreshing = false;
    this.startY = 0;
    this.currentY = 0;
    this.pullDistance = 0;
    
    // Reset visual state
    this.refreshElement.style.transform = 'translateY(-60px)';
    this.refreshElement.style.opacity = '0';
    this.refreshElement.classList.remove('ready', 'refreshing');
    
    const icon = this.refreshElement.querySelector('.ptr-icon');
    const text = this.refreshElement.querySelector('.ptr-text');
    
    icon.textContent = '↓';
    icon.style.transform = 'rotate(0deg)';
    text.textContent = 'Tarik untuk refresh';
  }

  shouldIgnoreTouch(target) {
    const ignoredElements = [
      'input', 'textarea', 'select', 'button', 'a',
      '.modal', '.dropdown', '.sync-btn'
    ];

    for (const selector of ignoredElements) {
      if (target.matches && target.matches(selector)) {
        return true;
      }
      if (target.closest && target.closest(selector)) {
        return true;
      }
    }

    return false;
  }

  // Enable/disable pull to refresh
  enable() {
    this.enabled = true;
    this.refreshElement.style.display = 'block';
  }

  disable() {
    this.enabled = false;
    this.refreshElement.style.display = 'none';
  }
}

// Global instance
window.pullToRefresh = new PullToRefresh();