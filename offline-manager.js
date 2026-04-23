// ═══════════════════════════════════════════════════
// OFFLINE MANAGER - Teaching Farm UB
// ═══════════════════════════════════════════════════

class OfflineManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    this.syncQueue = [];
    this.retryAttempts = 3;
    this.retryDelay = 5000; // 5 seconds
    
    this.init();
  }

  init() {
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Listen for page visibility changes (mobile-friendly)
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
    
    // Listen for focus/blur events
    window.addEventListener('focus', () => this.handleAppFocus());
    window.addEventListener('blur', () => this.handleAppBlur());
    
    // Check initial state
    if (!this.isOnline) {
      this.handleOffline();
    }
    
    // ❌ REMOVED: Auto-sync every 30 seconds (battery drain)
    // ✅ REPLACED: Event-driven sync only
  }

  handleOnline() {
    console.log('🌐 Connection restored');
    this.isOnline = true;
    this.hideOfflineIndicator();
    this.showSyncStatus('Koneksi pulih - Menyinkronkan data...', 'syncing');
    
    // Start immediate sync when connection restored
    setTimeout(() => this.backgroundSync(), 1000);
  }

  handleOffline() {
    console.log('📡 Connection lost - Switching to offline mode');
    this.isOnline = false;
    this.showOfflineIndicator();
    this.hideSyncStatus();
    
    // Add offline styling
    document.body.classList.add('offline-mode');
    document.getElementById('offline-badge').style.display = 'inline-block';
  }

  // Handle app visibility changes (mobile-friendly)
  handleVisibilityChange() {
    if (!document.hidden && this.isOnline) {
      // App became visible and we're online - check for pending sync
      this.checkAndSyncIfNeeded();
    }
  }

  // Handle app focus (desktop/mobile)
  handleAppFocus() {
    if (this.isOnline) {
      // App got focus and we're online - check for pending sync
      setTimeout(() => this.checkAndSyncIfNeeded(), 500);
    }
  }

  // Handle app blur (stop unnecessary operations)
  handleAppBlur() {
    // App lost focus - we can pause non-critical operations
    console.log('📱 App backgrounded - pausing sync operations');
  }

  // Smart sync - only sync if there's actually pending data
  async checkAndSyncIfNeeded() {
    if (this.syncInProgress || !this.isOnline) return;
    
    try {
      // Quick check for pending data without full sync
      const pendingData = await window.offlineDB.getPendingSyncData();
      let totalPending = 0;
      
      Object.values(pendingData).forEach(items => {
        totalPending += items.length;
      });
      
      if (totalPending > 0) {
        console.log(`📊 Found ${totalPending} pending items - starting sync`);
        await this.backgroundSync();
      } else {
        console.log('✅ No pending data to sync');
      }
    } catch (error) {
      console.error('Failed to check pending data:', error);
    }
  }

  showOfflineIndicator() {
    const indicator = document.getElementById('offline-indicator');
    const message = document.getElementById('offline-message');
    
    if (indicator && message) {
      message.textContent = 'Tidak ada koneksi internet - Mode Offline';
      indicator.classList.add('show');
    }
  }

  hideOfflineIndicator() {
    const indicator = document.getElementById('offline-indicator');
    
    if (indicator) {
      indicator.classList.remove('show');
    }
    
    // Remove offline styling
    document.body.classList.remove('offline-mode');
    document.getElementById('offline-badge').style.display = 'none';
  }

  showSyncStatus(message, type = 'syncing') {
    const status = document.getElementById('sync-status');
    const messageEl = document.getElementById('sync-message');
    
    if (status && messageEl) {
      messageEl.textContent = message;
      status.className = `sync-status show ${type}`;
    }
  }

  hideSyncStatus() {
    const status = document.getElementById('sync-status');
    if (status) {
      status.classList.remove('show');
    }
  }

  // Background sync untuk data yang pending
  async backgroundSync() {
    if (this.syncInProgress || !this.isOnline) return;
    
    try {
      this.syncInProgress = true;
      
      // Get pending data from IndexedDB
      const pendingData = await window.offlineDB.getPendingSyncData();
      let totalPending = 0;
      let totalSynced = 0;
      
      // Count total pending items
      Object.values(pendingData).forEach(items => {
        totalPending += items.length;
      });
      
      if (totalPending === 0) {
        this.syncInProgress = false;
        return;
      }
      
      this.showSyncStatus(`Menyinkronkan ${totalPending} data...`, 'syncing');
      
      // Sync input harian
      if (pendingData.input_harian_offline?.length > 0) {
        for (const item of pendingData.input_harian_offline) {
          try {
            await this.syncInputHarian(item);
            totalSynced++;
            this.showSyncStatus(`Tersinkron ${totalSynced}/${totalPending}`, 'syncing');
          } catch (error) {
            console.error('Failed to sync input harian:', error);
          }
        }
      }
      
      // Sync penjualan
      if (pendingData.penjualan_offline?.length > 0) {
        for (const item of pendingData.penjualan_offline) {
          try {
            await this.syncPenjualan(item);
            totalSynced++;
            this.showSyncStatus(`Tersinkron ${totalSynced}/${totalPending}`, 'syncing');
          } catch (error) {
            console.error('Failed to sync penjualan:', error);
          }
        }
      }
      
      // Sync kas operasional
      if (pendingData.kas_offline?.length > 0) {
        for (const item of pendingData.kas_offline) {
          try {
            await this.syncKasOperasional(item);
            totalSynced++;
            this.showSyncStatus(`Tersinkron ${totalSynced}/${totalPending}`, 'syncing');
          } catch (error) {
            console.error('Failed to sync kas:', error);
          }
        }
      }
      
      if (totalSynced > 0) {
        this.showSyncStatus(`✅ ${totalSynced} data berhasil disinkronkan`, 'success');
        setTimeout(() => this.hideSyncStatus(), 3000);
        
        // Refresh current page data
        if (typeof renderCurrentPage === 'function') {
          renderCurrentPage();
        }
      } else {
        this.hideSyncStatus();
      }
      
    } catch (error) {
      console.error('Background sync failed:', error);
      this.showSyncStatus('❌ Gagal sinkronisasi', 'error');
      setTimeout(() => this.hideSyncStatus(), 3000);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Sync individual input harian
  async syncInputHarian(item) {
    try {
      // Remove offline-specific fields
      const { id, sync_status, created_offline, temp_id, synced_at, server_id, ...cleanData } = item;
      
      // Save to server using existing function
      if (typeof dbSaveInput === 'function') {
        await dbSaveInput(cleanData);
        
        // Mark as synced in IndexedDB
        await window.offlineDB.updateSyncStatus('input_harian_offline', id, 'synced');
        
        console.log('✅ Input harian synced:', cleanData.tanggal, cleanData.kandang);
      }
    } catch (error) {
      // Mark as failed
      await window.offlineDB.updateSyncStatus('input_harian_offline', item.id, 'failed');
      throw error;
    }
  }

  // Sync individual penjualan
  async syncPenjualan(item) {
    try {
      const { id, sync_status, created_offline, temp_id, synced_at, server_id, ...cleanData } = item;
      
      if (typeof dbSavePenjualan === 'function') {
        await dbSavePenjualan(cleanData);
        await window.offlineDB.updateSyncStatus('penjualan_offline', id, 'synced');
        
        console.log('✅ Penjualan synced:', cleanData.tanggal, cleanData.produk);
      }
    } catch (error) {
      await window.offlineDB.updateSyncStatus('penjualan_offline', item.id, 'failed');
      throw error;
    }
  }

  // Sync individual kas operasional
  async syncKasOperasional(item) {
    try {
      const { id, sync_status, created_offline, temp_id, synced_at, server_id, ...cleanData } = item;
      
      if (typeof dbSaveKas === 'function') {
        await dbSaveKas(cleanData);
        await window.offlineDB.updateSyncStatus('kas_offline', id, 'synced');
        
        console.log('✅ Kas operasional synced:', cleanData.tanggal, cleanData.kategori);
      }
    } catch (error) {
      await window.offlineDB.updateSyncStatus('kas_offline', item.id, 'failed');
      throw error;
    }
  }

  // Manual sync triggered by user
  async manualSync() {
    if (!this.isOnline) {
      showToast('❌ Tidak ada koneksi internet');
      return;
    }
    
    if (this.syncInProgress) {
      showToast('⏳ Sinkronisasi sedang berlangsung...');
      return;
    }
    
    showToast('🔄 Memulai sinkronisasi manual...');
    await this.backgroundSync();
  }

  // Save data offline when no connection
  async saveOffline(type, data) {
    try {
      switch (type) {
        case 'input_harian':
          await window.offlineDB.saveInputHarianOffline(data);
          break;
        case 'penjualan':
          await window.offlineDB.savePenjualanOffline(data);
          break;
        case 'kas_operasional':
          await window.offlineDB.saveKasOffline(data);
          break;
        default:
          throw new Error('Unknown data type: ' + type);
      }
      
      showToast('💾 Data disimpan offline - akan disinkronkan saat online');
      
      // Schedule sync check for when app becomes active again
      this.scheduleNextSyncCheck();
      
      return true;
    } catch (error) {
      console.error('Failed to save offline:', error);
      showToast('❌ Gagal menyimpan data offline');
      return false;
    }
  }

  // Schedule next sync check (smart timing)
  scheduleNextSyncCheck() {
    // Clear any existing timeout
    if (this.syncCheckTimeout) {
      clearTimeout(this.syncCheckTimeout);
    }
    
    // Only schedule if we're online and app is visible
    if (this.isOnline && !document.hidden) {
      this.syncCheckTimeout = setTimeout(() => {
        this.checkAndSyncIfNeeded();
      }, 10000); // Check after 10 seconds, not 30
    }
  }

  // Check if we should use offline mode for a save operation
  shouldUseOfflineMode() {
    return !this.isOnline;
  }

  // Get offline storage info
  async getStorageInfo() {
    return await window.offlineDB.getStorageInfo();
  }
}

// Global instance
window.offlineManager = new OfflineManager();

// Override existing save functions to support offline mode
const originalDbSaveInput = window.dbSaveInput;
const originalDbSavePenjualan = window.dbSavePenjualan;
const originalDbSaveKas = window.dbSaveKas;

// Enhanced save functions with offline support
window.dbSaveInputWithOffline = async function(data) {
  if (window.offlineManager.shouldUseOfflineMode()) {
    return await window.offlineManager.saveOffline('input_harian', data);
  } else {
    try {
      return await originalDbSaveInput(data);
    } catch (error) {
      // If online save fails, try offline
      console.warn('Online save failed, trying offline:', error);
      return await window.offlineManager.saveOffline('input_harian', data);
    }
  }
};

window.dbSavePenjualanWithOffline = async function(data) {
  if (window.offlineManager.shouldUseOfflineMode()) {
    return await window.offlineManager.saveOffline('penjualan', data);
  } else {
    try {
      return await originalDbSavePenjualan(data);
    } catch (error) {
      console.warn('Online save failed, trying offline:', error);
      return await window.offlineManager.saveOffline('penjualan', data);
    }
  }
};

window.dbSaveKasWithOffline = async function(data) {
  if (window.offlineManager.shouldUseOfflineMode()) {
    return await window.offlineManager.saveOffline('kas_operasional', data);
  } else {
    try {
      return await originalDbSaveKas(data);
    } catch (error) {
      console.warn('Online save failed, trying offline:', error);
      return await window.offlineManager.saveOffline('kas_operasional', data);
    }
  }
};

// Manual sync function for button
window.manualSync = function() {
  window.offlineManager.manualSync();
};