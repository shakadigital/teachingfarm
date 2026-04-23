// ═══════════════════════════════════════════════════
// REAL-TIME MANAGER - Teaching Farm UB V2.0
// ═══════════════════════════════════════════════════

class RealtimeManager {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.heartbeatInterval = null;
    this.isConnected = false;
    this.subscribers = new Map();
    this.messageQueue = [];
    
    // Use Supabase Realtime if available, otherwise fallback to WebSocket simulation
    this.useSupabaseRealtime = typeof window.supabase !== 'undefined';
    
    this.init();
  }

  init() {
    if (this.useSupabaseRealtime) {
      this.initSupabaseRealtime();
    } else {
      this.initWebSocketSimulation();
    }
    
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Listen for page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !this.isConnected) {
        this.connect();
      }
    });
  }

  initSupabaseRealtime() {
    try {
      // Subscribe to database changes using Supabase Realtime
      this.subscribeToTableChanges();
      this.isConnected = true;
      this.updateConnectionStatus(true);
      console.log('✅ Supabase Realtime initialized');
    } catch (error) {
      console.error('❌ Supabase Realtime failed:', error);
      this.initWebSocketSimulation();
    }
  }

  subscribeToTableChanges() {
    const tables = ['input_harian', 'penjualan', 'kas_operasional', 'kiriman_pakan', 'pembayaran'];
    
    tables.forEach(table => {
      const subscription = window.supabase
        .channel(`public:${table}`)
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: table },
          (payload) => this.handleDatabaseChange(table, payload)
        )
        .subscribe();
        
      console.log(`📡 Subscribed to ${table} changes`);
    });
  }

  handleDatabaseChange(table, payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    console.log(`🔄 Database change: ${table} - ${eventType}`, payload);
    
    // Notify subscribers
    this.notifySubscribers('database_change', {
      table,
      eventType,
      newRecord,
      oldRecord,
      timestamp: new Date().toISOString()
    });
    
    // Show real-time notification
    this.showRealtimeNotification(table, eventType, newRecord);
    
    // Auto-refresh current page if relevant
    this.autoRefreshIfRelevant(table);
  }

  initWebSocketSimulation() {
    // Fallback: Simulate real-time using polling for demo purposes
    console.log('📡 Using WebSocket simulation (polling)');
    
    this.simulationInterval = setInterval(() => {
      if (this.isConnected && !document.hidden) {
        this.simulateRealtimeUpdates();
      }
    }, 30000); // Check every 30 seconds
    
    this.isConnected = true;
    this.updateConnectionStatus(true);
  }

  simulateRealtimeUpdates() {
    // Simulate random updates for demo
    const tables = ['input_harian', 'penjualan', 'kas_operasional'];
    const events = ['INSERT', 'UPDATE'];
    
    if (Math.random() < 0.1) { // 10% chance of simulated update
      const table = tables[Math.floor(Math.random() * tables.length)];
      const eventType = events[Math.floor(Math.random() * events.length)];
      
      this.notifySubscribers('database_change', {
        table,
        eventType,
        newRecord: { id: 'simulated', updated_at: new Date().toISOString() },
        timestamp: new Date().toISOString(),
        simulated: true
      });
    }
  }

  connect() {
    if (this.isConnected) return;
    
    try {
      if (this.useSupabaseRealtime) {
        this.initSupabaseRealtime();
      } else {
        this.initWebSocketSimulation();
      }
    } catch (error) {
      console.error('❌ Connection failed:', error);
      this.scheduleReconnect();
    }
  }

  disconnect() {
    this.isConnected = false;
    this.updateConnectionStatus(false);
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
    }
    
    console.log('📡 Disconnected from real-time service');
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ Max reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  handleOnline() {
    console.log('🌐 Online - Reconnecting real-time service');
    this.reconnectAttempts = 0;
    this.connect();
  }

  handleOffline() {
    console.log('📡 Offline - Disconnecting real-time service');
    this.disconnect();
  }

  // Subscribe to real-time events
  subscribe(eventType, callback) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType).add(callback);
    
    return () => {
      // Return unsubscribe function
      const callbacks = this.subscribers.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  // Notify all subscribers of an event
  notifySubscribers(eventType, data) {
    const callbacks = this.subscribers.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('❌ Subscriber callback error:', error);
        }
      });
    }
  }

  // Send real-time message
  send(eventType, data) {
    const message = {
      eventType,
      data,
      timestamp: new Date().toISOString(),
      userId: window.currentUser?.username || 'anonymous'
    };
    
    if (this.isConnected) {
      // In a real implementation, this would send via WebSocket
      console.log('📤 Sending real-time message:', message);
      
      // For demo, echo back after delay
      setTimeout(() => {
        this.notifySubscribers('message_received', message);
      }, 100);
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push(message);
    }
  }

  // Show real-time notification
  showRealtimeNotification(table, eventType, record) {
    if (document.hidden) return; // Don't show if app is not visible
    
    const tableNames = {
      'input_harian': 'Input Harian',
      'penjualan': 'Penjualan',
      'kas_operasional': 'Kas Operasional',
      'kiriman_pakan': 'Kiriman Pakan',
      'pembayaran': 'Pembayaran'
    };
    
    const eventNames = {
      'INSERT': 'ditambahkan',
      'UPDATE': 'diperbarui',
      'DELETE': 'dihapus'
    };
    
    const tableName = tableNames[table] || table;
    const eventName = eventNames[eventType] || eventType;
    
    // Show toast notification
    if (typeof showToast === 'function') {
      showToast(`🔄 ${tableName} ${eventName} oleh user lain`);
    }
    
    // Add haptic feedback
    if (window.hapticFeedback) {
      window.hapticFeedback('light');
    }
    
    // Show real-time indicator
    this.showRealtimeIndicator();
  }

  showRealtimeIndicator() {
    let indicator = document.getElementById('realtime-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'realtime-indicator';
      indicator.className = 'realtime-indicator';
      indicator.innerHTML = '🔄 <span>Live Update</span>';
      document.body.appendChild(indicator);
    }
    
    indicator.classList.add('show');
    
    setTimeout(() => {
      indicator.classList.remove('show');
    }, 2000);
  }

  // Auto-refresh current page if relevant
  autoRefreshIfRelevant(table) {
    const currentPage = this.getCurrentPage();
    const relevantPages = {
      'input_harian': ['home', 'input', 'riwayat'],
      'penjualan': ['home', 'penjualan', 'riwayat'],
      'kas_operasional': ['home', 'biaya'],
      'kiriman_pakan': ['gudang'],
      'pembayaran': ['gudang']
    };
    
    const pages = relevantPages[table] || [];
    if (pages.includes(currentPage)) {
      console.log(`🔄 Auto-refreshing ${currentPage} due to ${table} change`);
      
      // Debounce refresh to avoid too many updates
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = setTimeout(() => {
        this.refreshCurrentPage();
      }, 2000);
    }
  }

  getCurrentPage() {
    const activePage = document.querySelector('.page.active');
    return activePage ? activePage.id.replace('page-', '') : 'home';
  }

  async refreshCurrentPage() {
    const currentPage = this.getCurrentPage();
    
    try {
      switch (currentPage) {
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
        case 'riwayat':
          if (typeof renderRiwayat === 'function') await renderRiwayat();
          break;
      }
    } catch (error) {
      console.error('❌ Auto-refresh failed:', error);
    }
  }

  updateConnectionStatus(connected) {
    this.isConnected = connected;
    
    // Update connection indicator in header
    const syncBtn = document.getElementById('btn-sync');
    if (syncBtn) {
      const icon = syncBtn.querySelector('.sync-icon');
      if (connected) {
        icon.style.color = '#16a34a'; // Green
        syncBtn.title = 'Real-time: Connected';
      } else {
        icon.style.color = '#dc2626'; // Red
        syncBtn.title = 'Real-time: Disconnected';
      }
    }
  }

  // Get connection info
  getConnectionInfo() {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      useSupabaseRealtime: this.useSupabaseRealtime,
      subscriberCount: Array.from(this.subscribers.values()).reduce((total, set) => total + set.size, 0)
    };
  }
}

// Global instance
window.realtimeManager = new RealtimeManager();

// Export convenience functions
window.subscribeToRealtime = function(eventType, callback) {
  return window.realtimeManager.subscribe(eventType, callback);
};

window.sendRealtimeMessage = function(eventType, data) {
  return window.realtimeManager.send(eventType, data);
};