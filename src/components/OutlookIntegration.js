"use client";

import { useState, useEffect } from "react";
import { 
  Calendar, 
  Plus, 
  Trash2, 
  RefreshCw, 
  User, 
  CheckCircle,
  Download,
  Settings
} from "lucide-react";
import { accountManager } from "@/lib/multiAccountMsal";
import { importAllAccountsEvents } from "@/lib/multiAccountCalendar";
import { supabase } from "@/lib/supabase";

export default function OutlookIntegration({ onImportComplete }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");

  useEffect(() => {
    initializeAccounts();
  }, []);

  const initializeAccounts = async () => {
    try {
      setLoading(true);
      await accountManager.initialize();
      const accountsInfo = accountManager.getAccountsInfo();
      setAccounts(accountsInfo);
    } catch (error) {
      console.error("Error initializing accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  const addAccount = async () => {
    try {
      setLoading(true);
      const newAccount = await accountManager.addAccount();
      if (newAccount) {
        const accountsInfo = accountManager.getAccountsInfo();
        setAccounts(accountsInfo);
      }
    } catch (error) {
      console.error("Error adding account:", error);
      alert("Failed to add account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const removeAccount = async (accountId) => {
    try {
      const success = await accountManager.removeAccount(accountId);
      if (success) {
        const accountsInfo = accountManager.getAccountsInfo();
        setAccounts(accountsInfo);
      }
    } catch (error) {
      console.error("Error removing account:", error);
      alert("Failed to remove account.");
    }
  };

  const switchAccount = (accountId) => {
    accountManager.switchAccount(accountId);
    const accountsInfo = accountManager.getAccountsInfo();
    setAccounts(accountsInfo);
  };

  const importCalendars = async () => {
    try {
      setImporting(true);
      setImportStatus("🔄 Connecting to Microsoft accounts...");

      // Get current week dates
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + 1); // Monday
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 13); // 2 weeks
      weekEnd.setHours(23, 59, 59, 999);

      setImportStatus(`📅 Importing events from ${accounts.length} accounts...`);
      
      const importedTasks = await importAllAccountsEvents(weekStart, weekEnd, supabase);
      
      setImportStatus(`✅ Successfully imported ${importedTasks.length} events!`);
      
      // Call callback to refresh calendar
      if (onImportComplete) {
        onImportComplete();
      }

      // Clear status after 3 seconds
      setTimeout(() => setImportStatus(""), 3000);
    } catch (error) {
      console.error("Import failed:", error);
      setImportStatus("❌ Import failed. Please try again.");
      setTimeout(() => setImportStatus(""), 5000);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Outlook Calendar Integration</h3>
        <Calendar className="w-5 h-5 text-[#3B82F6]" />
      </div>

      {/* Account List */}
      <div className="space-y-3 mb-4">
        {loading ? (
          <div className="text-center py-4">
            <RefreshCw className="w-6 h-6 animate-spin text-[#a1a1a1] mx-auto mb-2" />
            <p className="text-[#a1a1a1] text-sm">Loading accounts...</p>
          </div>
        ) : accounts.length > 0 ? (
          accounts.map((account) => (
            <div
              key={account.id}
              className={`p-3 rounded-lg border ${
                account.isActive 
                  ? "border-[#3B82F6] bg-[#3B82F6]/10" 
                  : "border-[#2d2d2d] bg-[#0a0a0a]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    account.isActive ? "bg-[#3B82F6]" : "bg-[#666666]"
                  }`}></div>
                  <div>
                    <div className="text-white text-sm font-medium">{account.name}</div>
                    <div className="text-[#a1a1a1] text-xs">{account.username}</div>
                  </div>
                  {account.isActive && (
                    <CheckCircle className="w-4 h-4 text-[#10B981]" />
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {!account.isActive && (
                    <button
                      onClick={() => switchAccount(account.id)}
                      className="px-2 py-1 text-xs text-[#3B82F6] hover:bg-[#3B82F6]/20 rounded transition-colors"
                    >
                      Switch
                    </button>
                  )}
                  <button
                    onClick={() => removeAccount(account.id)}
                    className="p-1 text-[#a1a1a1] hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-[#666666]">
            <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No Outlook accounts connected</p>
            <p className="text-xs mt-1">Add an account to start importing</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <button
          onClick={addAccount}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 bg-[#1e1e1e] border border-[#2d2d2d] text-white rounded-lg hover:bg-[#2a2a2a] hover:border-[#3a3a3a] transition-all duration-200 disabled:opacity-50 font-medium"
        >
          <Plus className="w-4 h-4" />
          <span>Add Account</span>
        </button>
        
        {accounts.length > 0 && (
          <button
            onClick={importCalendars}
            disabled={importing || loading}
            className="flex items-center space-x-2 px-4 py-2 bg-[#3B82F6] text-white rounded-lg hover:bg-[#2563eb] transition-all duration-200 disabled:opacity-50 font-medium"
          >
            {importing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{importing ? "Importing..." : "Import Events"}</span>
          </button>
        )}
      </div>

      {/* Import Status */}
      {importStatus && (
        <div className="mt-4 p-3 bg-[#0a0a0a] border border-[#2d2d2d] rounded-lg">
          <p className="text-[#a1a1a1] text-sm">{importStatus}</p>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-[#0a0a0a] border border-[#2d2d2d] rounded-lg">
        <h4 className="text-white font-medium mb-2">How to set up:</h4>
        <ol className="text-[#a1a1a1] text-sm space-y-1 list-decimal list-inside">
          <li>Register your app in Azure Portal</li>
          <li>Add environment variables (CLIENT_ID, etc.)</li>
          <li>Click &quot;Add Account&quot; to connect Outlook</li>
          <li>Select multiple accounts as needed</li>
          <li>Click &quot;Import Events&quot; to sync calendars</li>
        </ol>
      </div>
    </div>
  );
}
