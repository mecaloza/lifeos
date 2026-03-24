"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  CheckCircle,
  RefreshCw,
  Clock,
  LogOut,
  AlertTriangle,
  Plus,
  Mail,
  Trash2,
} from "lucide-react";
import {
  addGoogleAccount,
  disconnectGoogle,
  getStoredAccounts,
} from "@/lib/googleCalendar";
import { supabase } from "@/lib/supabase";
import { autoSyncManager } from "@/lib/autoSync";

export default function GoogleCalendarSync({ onImportComplete }) {
  const [status, setStatus] = useState("");
  const [importing, setImporting] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load accounts from server on mount
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const stored = await getStoredAccounts();
        if (stored.length > 0) {
          setAccounts(stored);
        }
      } catch (error) {
        console.error("Error loading Google accounts:", error);
      } finally {
        setLoading(false);
      }
    };
    loadAccounts();
  }, []);

  // Add a new Google account
  const handleAddAccount = async () => {
    try {
      setImporting(true);
      setStatus("🔐 Conectando cuenta de Google...");

      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        setStatus("❌ GOOGLE_CLIENT_ID no configurado en .env.local");
        return;
      }

      const result = await addGoogleAccount();
      if (result) {
        const updated = await getStoredAccounts();
        setAccounts(updated);
        setStatus(`✅ Cuenta ${result.email} conectada`);
        autoSyncManager.reinitialize(supabase);

        // Auto-sync after adding
        setTimeout(() => manualSync(), 500);
      }
    } catch (error) {
      if (error.message === "popup_closed_by_user") {
        setStatus("Conexión cancelada");
      } else {
        setStatus(`❌ Error: ${error.message}`);
      }
    } finally {
      setImporting(false);
      setTimeout(() => setStatus(""), 5000);
    }
  };

  // Remove a specific account
  const handleRemoveAccount = async (email) => {
    await disconnectGoogle(email);
    const updated = await getStoredAccounts();
    setAccounts(updated);
    autoSyncManager.reinitialize(supabase);
    setStatus(`Desconectado: ${email}`);
    setTimeout(() => setStatus(""), 3000);
  };

  // Manual sync all accounts (server-side)
  const manualSync = async () => {
    try {
      setImporting(true);
      setStatus("📅 Sincronizando eventos de Google...");

      // Call server-side sync endpoint
      const res = await fetch("/api/calendar/sync?provider=google");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Server sync failed");
      }

      // Refresh account list
      const updated = await getStoredAccounts();
      setAccounts(updated);

      const { imported, updated: updatedCount } = data;
      if (imported > 0 || updatedCount > 0) {
        const parts = [];
        if (imported > 0) parts.push(`${imported} nuevos`);
        if (updatedCount > 0) parts.push(`${updatedCount} actualizados`);
        setStatus(`🎉 ¡${parts.join(", ")} eventos sincronizados!`);
      } else {
        setStatus("✅ Todo sincronizado - no hay eventos nuevos");
      }

      autoSyncManager.reinitialize(supabase);

      if (onImportComplete) {
        onImportComplete();
      }

      setTimeout(() => setStatus(""), 5000);
    } catch (error) {
      console.error("❌ Error syncing Google Calendar:", error);
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  // Has at least one account connected
  const hasAccounts = accounts.length > 0;
  const hasValidTokens = accounts.some((a) => a.token && !a.expired);

  if (loading) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
        <div className="flex items-center space-x-3">
          <RefreshCw className="w-5 h-5 text-[#a1a1a1] animate-spin" />
          <span className="text-[#a1a1a1]">Cargando cuentas de Google...</span>
        </div>
      </div>
    );
  }

  if (hasAccounts) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#4285F4] to-[#34A853] rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Google Calendar</h3>
              <p className="text-[#a1a1a1] text-sm">
                {accounts.length} cuenta{accounts.length > 1 ? "s" : ""} conectada{accounts.length > 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Connected Accounts List */}
        <div className="mb-4 space-y-2">
          {accounts.map((acc) => {
            const isValid = acc.token && !acc.expired;
            return (
              <div
                key={acc.email}
                className="flex items-center justify-between p-3 bg-[#0a0a0a] border border-[#2d2d2d] rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <Mail className="w-4 h-4 text-[#34A853]" />
                  <div>
                    <p className="text-white text-sm font-medium">{acc.email}</p>
                    <p className={`text-xs ${isValid ? "text-[#34A853]" : "text-[#F59E0B]"}`}>
                      {isValid
                        ? acc.has_refresh_token
                          ? "Conectado permanentemente"
                          : "Token activo"
                        : acc.has_refresh_token
                          ? "Renovando automáticamente..."
                          : "Token expirado"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveAccount(acc.email)}
                  className="p-1.5 text-[#a1a1a1] hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                  title="Desconectar cuenta"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Sync Status */}
        <div className="mb-4 p-3 bg-[#4285F4]/10 border border-[#4285F4]/30 rounded-lg">
          <div className="flex items-center space-x-2">
            {hasValidTokens ? (
              <Clock className="w-4 h-4 text-[#4285F4]" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
            )}
            <div>
              <div
                className={`font-medium text-sm ${hasValidTokens ? "text-[#4285F4]" : "text-[#F59E0B]"}`}
              >
                {hasValidTokens ? "Auto-Sync Activo" : "Renovando tokens..."}
              </div>
              <div className="text-[#a1a1a1] text-xs">
                {hasValidTokens
                  ? "Sincronización automática cada 15 minutos"
                  : "Los tokens se renuevan automáticamente desde el servidor"}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <button
            onClick={manualSync}
            disabled={importing}
            className="w-full flex items-center justify-center space-x-3 px-6 py-3 bg-[#4285F4] text-white rounded-lg hover:bg-[#3367D6] transition-all duration-200 disabled:opacity-50 font-medium"
          >
            {importing ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Sincronizando...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                <span>Sincronizar Ahora</span>
              </>
            )}
          </button>

          <button
            onClick={handleAddAccount}
            disabled={importing}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-[#34A853]/20 text-[#34A853] hover:bg-[#34A853]/30 rounded-lg transition-all duration-200 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar otra cuenta de Google</span>
          </button>
        </div>

        {/* Status */}
        {status && (
          <div className="mt-4 p-3 bg-[#0a0a0a] border border-[#2d2d2d] rounded-lg">
            <p className="text-sm text-[#a1a1a1]">{status}</p>
          </div>
        )}
      </div>
    );
  }

  // No accounts connected
  return (
    <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-[#4285F4] via-[#EA4335] to-[#34A853] rounded-lg flex items-center justify-center">
          <Calendar className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Google Calendar</h3>
          <p className="text-[#a1a1a1] text-sm">
            Importa tus eventos de Google
          </p>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-[#a1a1a1] text-sm mb-3">
          Conecta una o más cuentas de Google para importar tus eventos de calendario.
        </p>
      </div>

      <button
        onClick={handleAddAccount}
        disabled={importing}
        className="w-full flex items-center justify-center space-x-3 px-6 py-3 bg-[#4285F4] text-white rounded-lg hover:bg-[#3367D6] transition-all duration-200 disabled:opacity-50 font-medium"
      >
        {importing ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Conectando...</span>
          </>
        ) : (
          <>
            <Calendar className="w-5 h-5" />
            <span>Conectar con Google</span>
          </>
        )}
      </button>

      {status && (
        <div className="mt-4 p-3 bg-[#0a0a0a] border border-[#2d2d2d] rounded-lg">
          <p className="text-sm text-[#a1a1a1]">{status}</p>
        </div>
      )}
    </div>
  );
}
