// ═══════════════════════════════════════════════════
// INSTALL PROMPT - Teaching Farm UB V2.0
// ═══════════════════════════════════════════════════

class InstallPrompt {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.hasShownPrompt = false;
    
    this.init();
  }

  init() {
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallBanner();
    });

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      this.handleAppInstalled();
    });

    // Check if already installed
    this.checkIfInstalled();
    
    // Show install prompt after user interaction (delayed)
    setTimeout(() => {
      if (!this.isInstalled && !this.hasShownPrompt) {
        this.showInstallPrompt();
      }
    }, 30000); // Show after 30 seconds
  }

  checkIfInstalled() {
    // Check if running as PWA
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled = true;
      this.showWelcomeMessage();
    }
    
    // Check if running in TWA (Trusted Web Activity)
    if (document.referrer.includes('android-app://')) {
      this.isInstalled = true;
    }
  }

  showInstallBanner() {
    // Create install banner
    const banner = document.createElement('div');
    banner.id = 'install-banner';
    banner.className = 'install-banner';
    banner.innerHTML = `
      <div class="install-content">
        <div class="install-icon">📱</div>
        <div class="install-text">
          <div class="install-title">Install Teaching Farm V2.0</div>
          <div class="install-subtitle">Akses offline, gestures, dan real-time updates</div>
        </div>
        <div class="install-actions">
          <button class="install-btn-close" onclick="window.installPrompt.dismissBanner()">✕</button>
          <button class="install-btn-install" onclick="window.installPrompt.triggerInstall()">Install</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(banner);
    
    // Show banner with animation
    setTimeout(() => {
      banner.classList.add('show');
    }, 100);
  }

  showInstallPrompt() {
    if (this.hasShownPrompt || this.isInstalled) return;
    
    this.hasShownPrompt = true;
    
    // Create install modal
    const modal = document.createElement('div');
    modal.id = 'install-modal';
    modal.className = 'install-modal-overlay';
    modal.innerHTML = `
      <div class="install-modal">
        <div class="install-modal-header">
          <div class="install-modal-icon">🚀</div>
          <h3>Teaching Farm UB V2.0</h3>
          <button class="install-modal-close" onclick="window.installPrompt.dismissModal()">✕</button>
        </div>
        <div class="install-modal-body">
          <div class="version-badge">NEW VERSION 2.0</div>
          <p class="install-modal-description">
            Upgrade ke versi terbaru dengan fitur-fitur canggih untuk field workers!
          </p>
          
          <div class="features-list">
            <div class="feature-item">
              <span class="feature-icon">📱</span>
              <div class="feature-text">
                <strong>Mode Offline</strong>
                <small>Input data tanpa internet, sync otomatis</small>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">👆</span>
              <div class="feature-text">
                <strong>Swipe Navigation</strong>
                <small>Navigasi cepat dengan gestur mobile</small>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🔄</span>
              <div class="feature-text">
                <strong>Pull-to-Refresh</strong>
                <small>Tarik untuk refresh data terbaru</small>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">📳</span>
              <div class="feature-text">
                <strong>Haptic Feedback</strong>
                <small>Getaran untuk konfirmasi aksi</small>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">⚡</span>
              <div class="feature-text">
                <strong>Real-time Updates</strong>
                <small>Data ter-update secara live</small>
              </div>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🎯</span>
              <div class="feature-text">
                <strong>Mobile-First UX</strong>
                <small>Dioptimalkan untuk field workers</small>
              </div>
            </div>
          </div>
          
          <div class="install-benefits">
            <div class="benefit-item">✅ Akses cepat dari home screen</div>
            <div class="benefit-item">✅ Tidak perlu browser</div>
            <div class="benefit-item">✅ Notifikasi push (coming soon)</div>
            <div class="benefit-item">✅ Performa lebih cepat</div>
          </div>
        </div>
        <div class="install-modal-footer">
          <button class="btn-secondary" onclick="window.installPrompt.dismissModal()">Nanti Saja</button>
          <button class="btn-primary install-btn-main" onclick="window.installPrompt.triggerInstall()">
            📱 Install Sekarang
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Show modal with animation
    setTimeout(() => {
      modal.classList.add('show');
    }, 100);
    
    // Add haptic feedback
    if (window.hapticFeedback) {
      window.hapticFeedback('medium');
    }
  }

  async triggerInstall() {
    if (!this.deferredPrompt) {
      this.showManualInstallInstructions();
      return;
    }

    try {
      // Show install prompt
      this.deferredPrompt.prompt();
      
      // Wait for user choice
      const { outcome } = await this.deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('✅ User accepted install prompt');
        this.handleInstallAccepted();
      } else {
        console.log('❌ User dismissed install prompt');
        this.handleInstallDismissed();
      }
      
      // Clear the deferred prompt
      this.deferredPrompt = null;
      
    } catch (error) {
      console.error('❌ Install prompt failed:', error);
      this.showManualInstallInstructions();
    }
  }

  showManualInstallInstructions() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    let instructions = '';
    
    if (isIOS) {
      instructions = `
        <div class="manual-install">
          <h4>Install di iOS:</h4>
          <ol>
            <li>Tap tombol Share <span style="font-size:1.2em">⎋</span></li>
            <li>Pilih "Add to Home Screen"</li>
            <li>Tap "Add" untuk install</li>
          </ol>
        </div>
      `;
    } else if (isAndroid) {
      instructions = `
        <div class="manual-install">
          <h4>Install di Android:</h4>
          <ol>
            <li>Tap menu browser (⋮)</li>
            <li>Pilih "Add to Home Screen" atau "Install App"</li>
            <li>Tap "Install" untuk confirm</li>
          </ol>
        </div>
      `;
    } else {
      instructions = `
        <div class="manual-install">
          <h4>Install di Desktop:</h4>
          <ol>
            <li>Klik icon install di address bar</li>
            <li>Atau gunakan menu browser → "Install Teaching Farm"</li>
            <li>Klik "Install" untuk confirm</li>
          </ol>
        </div>
      `;
    }
    
    if (typeof showToast === 'function') {
      showToast('💡 Lihat instruksi manual install');
    }
    
    // Show instructions in modal
    this.showInstructionsModal(instructions);
  }

  showInstructionsModal(instructions) {
    const modal = document.createElement('div');
    modal.className = 'install-modal-overlay show';
    modal.innerHTML = `
      <div class="install-modal">
        <div class="install-modal-header">
          <h3>📱 Cara Install Manual</h3>
          <button class="install-modal-close" onclick="this.closest('.install-modal-overlay').remove()">✕</button>
        </div>
        <div class="install-modal-body">
          ${instructions}
        </div>
        <div class="install-modal-footer">
          <button class="btn-primary" onclick="this.closest('.install-modal-overlay').remove()">Mengerti</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  handleInstallAccepted() {
    this.dismissBanner();
    this.dismissModal();
    
    if (typeof showToast === 'function') {
      showToast('🎉 Terima kasih! App sedang diinstall...');
    }
    
    // Track install event
    this.trackInstallEvent('accepted');
  }

  handleInstallDismissed() {
    this.dismissModal();
    
    // Show reminder after some time
    setTimeout(() => {
      if (typeof showToast === 'function') {
        showToast('💡 Install app untuk pengalaman terbaik!');
      }
    }, 60000); // Remind after 1 minute
    
    // Track dismiss event
    this.trackInstallEvent('dismissed');
  }

  handleAppInstalled() {
    this.isInstalled = true;
    this.dismissBanner();
    this.dismissModal();
    
    // Show welcome message
    setTimeout(() => {
      this.showWelcomeMessage();
    }, 2000);
    
    // Track successful install
    this.trackInstallEvent('installed');
  }

  showWelcomeMessage() {
    if (typeof showToast === 'function') {
      showToast('🎉 Selamat datang di Teaching Farm V2.0!');
    }
    
    // Show version info
    setTimeout(() => {
      this.showVersionInfo();
    }, 3000);
  }

  showVersionInfo() {
    const versionModal = document.createElement('div');
    versionModal.className = 'install-modal-overlay show';
    versionModal.innerHTML = `
      <div class="install-modal version-modal">
        <div class="install-modal-header">
          <div class="install-modal-icon">🚀</div>
          <h3>Welcome to V2.0!</h3>
        </div>
        <div class="install-modal-body">
          <div class="version-welcome">
            <p><strong>Teaching Farm UB V2.0</strong> telah berhasil diinstall!</p>
            <p>Nikmati fitur-fitur baru yang dirancang khusus untuk field workers:</p>
          </div>
          
          <div class="version-features">
            <div class="version-feature">📱 Mode Offline - Input data tanpa internet</div>
            <div class="version-feature">👆 Swipe Navigation - Navigasi dengan gestur</div>
            <div class="version-feature">🔄 Pull-to-Refresh - Tarik untuk refresh</div>
            <div class="version-feature">📳 Haptic Feedback - Getaran konfirmasi</div>
            <div class="version-feature">⚡ Real-time Updates - Data live update</div>
          </div>
          
          <div class="version-tip">
            <strong>💡 Tips:</strong> Swipe kiri/kanan untuk navigasi cepat antar halaman!
          </div>
        </div>
        <div class="install-modal-footer">
          <button class="btn-primary" onclick="this.closest('.install-modal-overlay').remove()">
            🚀 Mulai Menggunakan
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(versionModal);
    
    // Auto-close after 10 seconds
    setTimeout(() => {
      if (versionModal.parentNode) {
        versionModal.remove();
      }
    }, 10000);
  }

  dismissBanner() {
    const banner = document.getElementById('install-banner');
    if (banner) {
      banner.classList.remove('show');
      setTimeout(() => banner.remove(), 300);
    }
  }

  dismissModal() {
    const modal = document.getElementById('install-modal');
    if (modal) {
      modal.classList.remove('show');
      setTimeout(() => modal.remove(), 300);
    }
  }

  trackInstallEvent(action) {
    // Track install events for analytics
    console.log(`📊 Install event: ${action}`);
    
    // In a real app, you might send this to analytics
    if (typeof gtag !== 'undefined') {
      gtag('event', 'pwa_install', {
        event_category: 'PWA',
        event_label: action,
        value: 1
      });
    }
  }
}

// Global instance
window.installPrompt = new InstallPrompt();