// Automatic calendar synchronization for both Google and Outlook
import {
  importOutlookToLifeOS,
  getAccessTokenSilent,
  setSilentMode,
  initializeMsal,
  getOutlookTokenFromServer,
} from "./outlookPersonal";
import {
  importGoogleCalendarToLifeOS,
  hasValidGoogleTokenAsync,
  isGoogleConnectedAsync,
  getStoredAccounts as getGoogleAccounts,
} from "./googleCalendar";

// Server-side sync helper
async function serverSync(provider) {
  const url = provider ? `/api/calendar/sync?provider=${provider}` : "/api/calendar/sync";
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Server sync failed");
  return data;
}

class AutoSyncManager {
  constructor() {
    this.syncInterval = null;
    this.outlookConnected = false;
    this.googleConnected = false;
    this.lastSyncTime = null;
    this.syncFrequencyMinutes = 15;
    this.onSyncCallback = null;
    this.initialized = false;
    this._supabase = null;
  }

  // Check both connections silently (no popups ever)
  async checkConnections() {
    // Check Outlook silently (try MSAL first, then server)
    try {
      const token = await getAccessTokenSilent();
      this.outlookConnected = !!token;
    } catch {
      // Fallback: check server for stored Outlook token
      try {
        const serverToken = await getOutlookTokenFromServer();
        this.outlookConnected = !!serverToken;
      } catch {
        this.outlookConnected = false;
      }
    }

    // Check Google (server-backed tokens with auto-refresh)
    try {
      this.googleConnected = await hasValidGoogleTokenAsync();
    } catch {
      this.googleConnected = false;
    }

    console.log(
      `🔍 Calendar connections - Outlook: ${this.outlookConnected ? "✅" : "❌"}, Google: ${this.googleConnected ? "✅" : "❌"}`
    );
    return {
      outlook: this.outlookConnected,
      google: this.googleConnected,
    };
  }

  // Start automatic sync for all connected calendars
  async startAutoSync(supabase, onSyncCallback = null) {
    if (this.initialized) return this.getSyncStatus();
    this.initialized = true;
    this._supabase = supabase;
    this.onSyncCallback = onSyncCallback;

    console.log("🔄 Initializing auto-sync for all calendars...");
    const connections = await this.checkConnections();

    if (!connections.outlook && !connections.google) {
      console.log("📭 No calendar connections found - auto-sync on standby");
      this.initialized = false;
      return connections;
    }

    // Initial sync
    await this.performSync(supabase);

    // Set up periodic sync
    this.syncInterval = setInterval(async () => {
      await this.checkConnections();
      if (this.outlookConnected || this.googleConnected) {
        await this.performSync(supabase);
      }
    }, this.syncFrequencyMinutes * 60 * 1000);

    console.log(
      `✅ Auto-sync started - every ${this.syncFrequencyMinutes} minutes`
    );
    return connections;
  }

  // Stop automatic sync
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.initialized = false;
  }

  // Perform sync for all connected calendars (silent mode - no popups)
  async performSync(supabase) {
    const results = { outlook: 0, google: 0, errors: [] };

    // Enable silent mode to prevent any popup fallbacks
    setSilentMode(true);

    try {
      // Sync Outlook
      if (this.outlookConnected) {
        try {
          const imported = await importOutlookToLifeOS(supabase);
          results.outlook = imported.length;
          if (imported.length > 0) {
            console.log(`✅ Outlook: ${imported.length} new events`);
          }
        } catch (error) {
          console.log("⚠️ Outlook sync error:", error.message);
          results.errors.push({ source: "outlook", error: error.message });
        }
      }

      // Sync Google (fully server-side: token refresh + event fetch + upsert)
      if (this.googleConnected) {
        try {
          const syncResult = await serverSync("google");
          results.google = (syncResult.imported || 0) + (syncResult.updated || 0);
          if (results.google > 0) {
            console.log(`✅ Google: ${syncResult.imported} imported, ${syncResult.updated} updated`);
          }
        } catch (error) {
          console.log("⚠️ Google sync error:", error.message);
          results.errors.push({ source: "google", error: error.message });
          this.googleConnected = false;
        }
      }
    } finally {
      // Always restore normal mode
      setSilentMode(false);
    }

    this.lastSyncTime = new Date();
    if (this.onSyncCallback) {
      this.onSyncCallback(results);
    }

    return results;
  }

  // Manual sync (can be triggered from UI)
  async manualSync(supabase) {
    await this.checkConnections();
    return await this.performSync(supabase);
  }

  // Re-initialize after connecting/disconnecting an account
  async reinitialize(supabase, onSyncCallback = null) {
    this.stopAutoSync();
    return await this.startAutoSync(
      supabase || this._supabase,
      onSyncCallback || this.onSyncCallback
    );
  }

  // Get sync status
  getSyncStatus() {
    return {
      outlookConnected: this.outlookConnected,
      googleConnected: this.googleConnected,
      isAutoSyncing: !!this.syncInterval,
      lastSyncTime: this.lastSyncTime,
      nextSyncIn: this.syncInterval ? this.syncFrequencyMinutes : null,
    };
  }
}

// Global singleton
export const autoSyncManager = new AutoSyncManager();
