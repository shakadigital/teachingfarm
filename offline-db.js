// ═══════════════════════════════════════════════════
// OFFLINE DATABASE - IndexedDB untuk Teaching Farm UB
// ═══════════════════════════════════════════════════

class OfflineDB {
  constructor() {
    this.dbName = 'TeachingFarmOfflineDB';
    this.version = 1;
    this.db = null;
  }

  // Initialize IndexedDB
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Store untuk input harian offline
        if (!db.objectStoreNames.contains('input_harian_offline')) {
          const inputStore = db.createObjectStore('input_harian_offline', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          inputStore.createIndex('tanggal', 'tanggal', { unique: false });
          inputStore.createIndex('kandang', 'kandang', { unique: false });
          inputStore.createIndex('sync_status', 'sync_status', { unique: false });
        }
        
        // Store untuk penjualan offline
        if (!db.objectStoreNames.contains('penjualan_offline')) {
          const penjualanStore = db.createObjectStore('penjualan_offline', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          penjualanStore.createIndex('tanggal', 'tanggal', { unique: false });
          penjualanStore.createIndex('sync_status', 'sync_status', { unique: false });
        }
        
        // Store untuk kas operasional offline
        if (!db.objectStoreNames.contains('kas_offline')) {
          const kasStore = db.createObjectStore('kas_offline', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          kasStore.createIndex('tanggal', 'tanggal', { unique: false });
          kasStore.createIndex('sync_status', 'sync_status', { unique: false });
        }
        
        // Store untuk cache data master (kandang, pakan, dll)
        if (!db.objectStoreNames.contains('master_data_cache')) {
          const masterStore = db.createObjectStore('master_data_cache', { 
            keyPath: 'key' 
          });
        }
      };
    });
  }

  // Simpan data input harian offline
  async saveInputHarianOffline(data) {
    const transaction = this.db.transaction(['input_harian_offline'], 'readwrite');
    const store = transaction.objectStore('input_harian_offline');
    
    const offlineData = {
      ...data,
      sync_status: 'pending',
      created_offline: new Date().toISOString(),
      temp_id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    return store.add(offlineData);
  }

  // Simpan penjualan offline
  async savePenjualanOffline(data) {
    const transaction = this.db.transaction(['penjualan_offline'], 'readwrite');
    const store = transaction.objectStore('penjualan_offline');
    
    const offlineData = {
      ...data,
      sync_status: 'pending',
      created_offline: new Date().toISOString(),
      temp_id: `offline_penjualan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    return store.add(offlineData);
  }

  // Simpan kas operasional offline
  async saveKasOffline(data) {
    const transaction = this.db.transaction(['kas_offline'], 'readwrite');
    const store = transaction.objectStore('kas_offline');
    
    const offlineData = {
      ...data,
      sync_status: 'pending',
      created_offline: new Date().toISOString(),
      temp_id: `offline_kas_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    return store.add(offlineData);
  }

  // Get semua data yang belum di-sync
  async getPendingSyncData() {
    const stores = ['input_harian_offline', 'penjualan_offline', 'kas_offline'];
    const pendingData = {};
    
    for (const storeName of stores) {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index('sync_status');
      
      pendingData[storeName] = await new Promise((resolve, reject) => {
        const request = index.getAll('pending');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    
    return pendingData;
  }

  // Update status sync
  async updateSyncStatus(storeName, id, status, serverId = null) {
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    const request = store.get(id);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const data = request.result;
        if (data) {
          data.sync_status = status;
          data.synced_at = new Date().toISOString();
          if (serverId) data.server_id = serverId;
          
          const updateRequest = store.put(data);
          updateRequest.onsuccess = () => resolve(updateRequest.result);
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error('Data not found'));
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Cache master data (kandang, pakan, dll)
  async cacheMasterData(key, data) {
    const transaction = this.db.transaction(['master_data_cache'], 'readwrite');
    const store = transaction.objectStore('master_data_cache');
    
    const cacheData = {
      key,
      data,
      cached_at: new Date().toISOString()
    };
    
    return store.put(cacheData);
  }

  // Get cached master data
  async getCachedMasterData(key) {
    const transaction = this.db.transaction(['master_data_cache'], 'readonly');
    const store = transaction.objectStore('master_data_cache');
    
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          // Check if cache is still valid (24 hours)
          const cacheAge = Date.now() - new Date(result.cached_at).getTime();
          const maxAge = 24 * 60 * 60 * 1000; // 24 hours
          
          if (cacheAge < maxAge) {
            resolve(result.data);
          } else {
            resolve(null); // Cache expired
          }
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Clear synced data (cleanup)
  async clearSyncedData() {
    const stores = ['input_harian_offline', 'penjualan_offline', 'kas_offline'];
    
    for (const storeName of stores) {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const index = store.index('sync_status');
      
      const request = index.openCursor(IDBKeyRange.only('synced'));
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          // Keep data for 7 days after sync for backup
          const syncedAt = new Date(cursor.value.synced_at);
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          
          if (syncedAt < weekAgo) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
    }
  }

  // Get storage usage info
  async getStorageInfo() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage,
        available: estimate.quota,
        usedMB: Math.round(estimate.usage / 1024 / 1024 * 100) / 100,
        availableMB: Math.round(estimate.quota / 1024 / 1024 * 100) / 100,
        usagePercent: Math.round((estimate.usage / estimate.quota) * 100)
      };
    }
    return null;
  }
}

// Global instance
window.offlineDB = new OfflineDB();

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await window.offlineDB.init();
    console.log('✅ Offline database initialized');
  } catch (error) {
    console.error('❌ Failed to initialize offline database:', error);
  }
});