// ═══════════════════════════════════════════════════
// INSTALL PROMPT - Teaching Farm UB V2.0
// ═══════════════════════════════════════════════════

const APP_VERSION = '2.8.2'; // Naikkan ini setiap ada update besar

class InstallPrompt {
  constructor() {
    this.deferredPrompt = null;
    this.isInstalled = false;
    this.hasShownPrompt = false;
    this.init();
  }

  init() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallBanner();
    });

    window.addEventListener('appinstalled', () => {
      this.handleAppInstalled();
    });

    this.checkIfInstalled();

    setTimeout(() => {
      if (!this.isInstalled && !this.hasShownPrompt) {
        this.showInstallPrompt();
      }
    }, 30000);
  }

  checkIfInstalled() {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled = true;
      // Cek apakah versi ini sudah pernah ditampilkan
      this.checkVersionAndShowInfo();
    }
    if (document.referrer.includes('android-app://')) {
      this.isInstalled = true;
    }
  }

  // ── Hanya tampilkan popup jika versi BARU ──
  checkVersionAndShowInfo() {
    const shownVersion = localStorage.getItem('shown_version');
    if (shownVersion !== APP_VERSION) {
      // Versi baru — tampilkan info
      setTimeout(() => this.showVersionInfo(), 2000);
    }
    // Jika versi sama, tidak tampilkan apapun
  }

  showInstallBanner() {
    const banner = document.createElement('div');
    banner.id = 'install-banner';
    banner.className = 'install-banner';
    banner.innerHTML = `
      <div class="install-content">
        <div class="install-icon">📱</div>
        <div class="install-text">
          <div class="install-title">Install Teaching Farm V${APP_VERSION}</div>
          <div class="install-subtitle">Akses offline, gestures, dan real-time updates</div>
        </div>
        <div class="install-actions">
          <button class="install-btn-close" onclick="window.installPrompt.dismissBanner()">✕</button>
          <button class="install-btn-install" onclick="window.installPrompt.triggerInstall()">Install</button>
        </div>
      </div>
    `;
    document.body.appendChild(banner);
    setTimeout(() => banner.classList.add('show'), 100);
  }

  showInstallPrompt() {
    if (this.hasShownPrompt || this.isInstalled) return;
    this.hasShownPrompt = true;

    const modal = document.createElement('div');
    modal.id = 'install-modal';
    modal.className = 'install-modal-overlay';
    modal.innerHTML = `
      <div class="install-modal install-modal-simple">
        <div class="install-simple-content">
          <div class="install-simple-text">
            <strong>Update Aplikasi</strong>
            <span>Versi ${APP_VERSION}</span>
          </div>
          <button class="btn-install-simple" onclick="window.installPrompt.triggerInstall()">INSTALL</button>
        </div>
        <button class="install-simple-close" onclick="window.installPrompt.dismissModal()">✕</button>
      </div>
    `;
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 100);
  }

  async triggerInstall() {
    if (!this.deferredPrompt) {
      this.showManualInstallInstructions();
      return;
    }
    try {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      if (outcome === 'accepted') this.handleInstallAccepted();
      else this.handleInstallDismissed();
      this.deferredPrompt = null;
    } catch (e) {
      this.showManualInstallInstructions();
    }
  }

  showManualInstallInstructions() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    let instructions = '';
    if (isIOS) {
      instructions = `<div class="manual-install"><h4>Install di iOS:</h4><ol><li>Tap tombol Share ⎋</li><li>Pilih "Add to Home Screen"</li><li>Tap "Add"</li></ol></div>`;
    } else if (isAndroid) {
      instructions = `<div class="manual-install"><h4>Install di Android:</h4><ol><li>Tap menu browser (⋮)</li><li>Pilih "Add to Home Screen"</li><li>Tap "Install"</li></ol></div>`;
    } else {
      instructions = `<div class="manual-install"><h4>Install di Desktop:</h4><ol><li>Klik icon install di address bar</li><li>Klik "Install"</li></ol></div>`;
    }
    const modal = document.createElement('div');
    modal.className = 'install-modal-overlay show';
    modal.innerHTML = `
      <div class="install-modal">
        <div class="install-modal-header"><h3>📱 Cara Install Manual</h3><button class="install-modal-close" onclick="this.closest('.install-modal-overlay').remove()">✕</button></div>
        <div class="install-modal-body">${instructions}</div>
        <div class="install-modal-footer"><button class="btn-primary" onclick="this.closest('.install-modal-overlay').remove()">Mengerti</button></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  handleInstallAccepted() {
    this.dismissBanner();
    this.dismissModal();
    if (typeof showToast === 'function') showToast('🎉 App sedang diinstall...');
  }

  handleInstallDismissed() {
    this.dismissModal();
  }

  handleAppInstalled() {
    this.isInstalled = true;
    this.dismissBanner();
    this.dismissModal();
    setTimeout(() => this.showVersionInfo(), 2000);
  }

  // ── Popup versi baru — simpan ke localStorage setelah ditutup ──
  showVersionInfo() {
    // Jangan tampilkan jika sudah pernah untuk versi ini
    if (localStorage.getItem('shown_version') === APP_VERSION) return;

    const modal = document.createElement('div');
    modal.id = 'version-info-modal';
    modal.className = 'install-modal-overlay show';
    modal.innerHTML = `
      <div class="install-modal version-modal">
        <div class="install-modal-header">
          <div class="install-modal-icon">🚀</div>
          <h3>Teaching Farm V${APP_VERSION}</h3>
        </div>
        <div class="install-modal-body">
          <div class="version-welcome">
            <p><strong>Versi ${APP_VERSION}</strong> berhasil diinstall!</p>
            <p>Fitur baru yang tersedia:</p>
          </div>
          <div class="version-features">
            <div class="version-feature">🐛 Fix bug crash stok telur pada data lama</div>
            <div class="version-feature">🔢 Fix jumlah pakan tersimpan sebagai teks, bukan angka</div>
            <div class="version-feature">🔒 Fix mode edit tidak ter-reset setelah simpan/reset form</div>
            <div class="version-feature">🔔 Hapus notifikasi berulang saat form belum diisi</div>
            <div class="version-feature">🗄️ Fix IndexedDB error loop saat app dapat fokus</div>
            <div class="version-feature">✨ Form input lebih natural — scroll otomatis tanpa gangguan</div>
          </div>
          <div class="version-tip">💡 Swipe kiri/kanan untuk navigasi cepat antar halaman!</div>
        </div>
        <div class="install-modal-footer">
          <button class="btn-primary" onclick="window.installPrompt.closeVersionInfo()">🚀 Mulai Menggunakan</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  closeVersionInfo() {
    // Tandai versi ini sudah ditampilkan
    localStorage.setItem('shown_version', APP_VERSION);
    const modal = document.getElementById('version-info-modal');
    if (modal) modal.remove();
  }

  dismissBanner() {
    const banner = document.getElementById('install-banner');
    if (banner) { banner.classList.remove('show'); setTimeout(() => banner.remove(), 300); }
  }

  dismissModal() {
    const modal = document.getElementById('install-modal');
    if (modal) { modal.classList.remove('show'); setTimeout(() => modal.remove(), 300); }
  }
}

window.installPrompt = new InstallPrompt();
