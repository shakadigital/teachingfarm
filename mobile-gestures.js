// ═══════════════════════════════════════════════════
// MOBILE GESTURES - Teaching Farm UB
// ═══════════════════════════════════════════════════

class MobileGestures {
  constructor() {
    this.startX = 0;
    this.startY = 0;
    this.endX = 0;
    this.endY = 0;
    this.minSwipeDistance = 50;
    this.maxVerticalDistance = 100;
    this.isScrolling = false;
    this.currentPage = 'home';
    
    // Page navigation order
    this.pageOrder = ['home', 'input', 'penjualan', 'gudang', 'biaya', 'laporan', 'riwayat', 'settings'];
    
    this.init();
  }

  init() {
    // Add touch event listeners to main app container
    const app = document.getElementById('app');
    if (app) {
      app.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
      app.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
      app.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });
    }

    // Listen for page changes to update current page
    this.observePageChanges();
  }

  handleTouchStart(e) {
    // Don't interfere with form inputs, buttons, or scrollable areas
    if (this.shouldIgnoreTouch(e.target)) {
      return;
    }

    const touch = e.touches[0];
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.isScrolling = false;
  }

  handleTouchMove(e) {
    if (this.startX === 0 || this.startY === 0) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - this.startX;
    const deltaY = touch.clientY - this.startY;

    // Detect if user is scrolling vertically
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      this.isScrolling = true;
      return;
    }

    // Prevent default horizontal scroll if we're handling swipe
    if (Math.abs(deltaX) > 10 && !this.isScrolling) {
      e.preventDefault();
    }
  }

  handleTouchEnd(e) {
    if (this.startX === 0 || this.startY === 0 || this.isScrolling) {
      this.resetTouch();
      return;
    }

    const touch = e.changedTouches[0];
    this.endX = touch.clientX;
    this.endY = touch.clientY;

    this.detectSwipe();
    this.resetTouch();
  }

  detectSwipe() {
    const deltaX = this.endX - this.startX;
    const deltaY = Math.abs(this.endY - this.startY);

    // Check if it's a valid horizontal swipe
    if (Math.abs(deltaX) < this.minSwipeDistance || deltaY > this.maxVerticalDistance) {
      return;
    }

    // Determine swipe direction and navigate
    if (deltaX > 0) {
      // Swipe right - go to previous page
      this.navigateToPreviousPage();
    } else {
      // Swipe left - go to next page
      this.navigateToNextPage();
    }
  }

  navigateToPreviousPage() {
    const currentIndex = this.pageOrder.indexOf(this.currentPage);
    if (currentIndex > 0) {
      const previousPage = this.pageOrder[currentIndex - 1];
      this.navigateToPage(previousPage);
      this.showSwipeIndicator('right', '← ' + this.getPageTitle(previousPage));
    }
  }

  navigateToNextPage() {
    const currentIndex = this.pageOrder.indexOf(this.currentPage);
    if (currentIndex < this.pageOrder.length - 1) {
      const nextPage = this.pageOrder[currentIndex + 1];
      this.navigateToPage(nextPage);
      this.showSwipeIndicator('left', this.getPageTitle(nextPage) + ' →');
    }
  }

  navigateToPage(pageId) {
    // Use existing navigation function
    if (typeof showPage === 'function') {
      showPage(pageId);
    }
    
    // Update current page
    this.currentPage = pageId;
    
    // Add haptic feedback
    this.hapticFeedback('light');
  }

  getPageTitle(pageId) {
    const titles = {
      'home': 'Dashboard',
      'input': 'Input Harian',
      'penjualan': 'Penjualan',
      'gudang': 'Gudang',
      'biaya': 'Biaya',
      'laporan': 'Laporan',
      'riwayat': 'Riwayat',
      'settings': 'Pengaturan'
    };
    return titles[pageId] || pageId;
  }

  showSwipeIndicator(direction, text) {
    // Create or update swipe indicator
    let indicator = document.getElementById('swipe-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'swipe-indicator';
      indicator.className = 'swipe-indicator';
      document.body.appendChild(indicator);
    }

    indicator.textContent = text;
    indicator.className = `swipe-indicator show ${direction}`;

    // Hide after animation
    setTimeout(() => {
      indicator.classList.remove('show');
    }, 1500);
  }

  shouldIgnoreTouch(target) {
    // Ignore touches on interactive elements
    const ignoredElements = [
      'input', 'textarea', 'select', 'button', 'a',
      '.modal', '.dropdown', '.tbl', '.chart-wrap'
    ];

    // Check if target or parent matches ignored elements
    for (const selector of ignoredElements) {
      if (target.matches && target.matches(selector)) {
        return true;
      }
      if (target.closest && target.closest(selector)) {
        return true;
      }
    }

    // Ignore if target has scrollable content
    if (this.isScrollableElement(target)) {
      return true;
    }

    return false;
  }

  isScrollableElement(element) {
    const style = window.getComputedStyle(element);
    const overflowY = style.overflowY;
    const overflowX = style.overflowX;
    
    return overflowY === 'scroll' || overflowY === 'auto' || 
           overflowX === 'scroll' || overflowX === 'auto' ||
           element.scrollHeight > element.clientHeight ||
           element.scrollWidth > element.clientWidth;
  }

  observePageChanges() {
    // Update current page saat switchPage dipanggil
    // Lebih ringan dari MutationObserver pada seluruh body
    const updatePage = () => {
      const activePage = document.querySelector('.page.active');
      if (activePage) {
        this.currentPage = activePage.id.replace('page-', '');
      }
    };

    // Patch switchPage untuk update currentPage
    const origSwitchPage = window.switchPage;
    if (typeof origSwitchPage === 'function') {
      window.switchPage = (name) => {
        origSwitchPage(name);
        this.currentPage = name;
      };
    }

    // Fallback: cek saat DOMContentLoaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', updatePage);
    } else {
      updatePage();
    }
  }

  hapticFeedback(type = 'light') {
    // Haptic feedback for supported devices
    if ('vibrate' in navigator) {
      switch (type) {
        case 'light':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(20);
          break;
        case 'heavy':
          navigator.vibrate([10, 10, 10]);
          break;
        case 'success':
          navigator.vibrate([10, 50, 10]);
          break;
        case 'error':
          navigator.vibrate([50, 10, 50, 10, 50]);
          break;
      }
    }
  }

  resetTouch() {
    this.startX = 0;
    this.startY = 0;
    this.endX = 0;
    this.endY = 0;
    this.isScrolling = false;
  }

  // Enable/disable gestures
  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }
}

// Global instance
window.mobileGestures = new MobileGestures();

// Export haptic feedback function for use in other parts of the app
window.hapticFeedback = function(type) {
  if (window.mobileGestures) {
    window.mobileGestures.hapticFeedback(type);
  }
};