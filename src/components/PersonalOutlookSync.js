"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  Download,
  CheckCircle,
  RefreshCw,
  Clock,
  LogOut,
  Plus,
} from "lucide-react";
import { autoSyncManager } from "@/lib/autoSync";
import { supabase } from "@/lib/supabase";

export default function PersonalOutlookSync({ onImportComplete }) {
  const [status, setStatus] = useState("");
  const [importing, setImporting] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState([]);

  // Check for connected Outlook accounts from server
  useEffect(() => {
    checkConnectedAccounts();

    // Check URL params for success/error from OAuth callback
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const connectedEmail = params.get("outlook_connected");
      const error = params.get("error");

      if (connectedEmail) {
        setStatus(`Conectado como: ${connectedEmail}`);
        // Clean URL
        window.history.replaceState({}, "", window.location.pathname);
        // Refresh accounts list
        checkConnectedAccounts();
        // Trigger auto-sync reinit
        autoSyncManager.reinitialize(supabase);
      } else if (error) {
        setStatus(`Error: ${error}`);
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, []);

  const checkConnectedAccounts = async () => {
    try {
      const res = await fetch("/api/auth/outlook/tokens");
      const data = await res.json();
      const accounts = data.accounts || [];
      setConnectedAccounts(accounts);
    } catch (error) {
      console.error("Error checking Outlook accounts:", error);
    }
  };

  // Server-side sync via API
  const manualSync = async () => {
    try {
      setImporting(true);
      setStatus("Sincronizando eventos...");

      const res = await fetch("/api/calendar/sync?provider=outlook");
      const data = await res.json();

      if (data.error) {
        setStatus(`Error: ${data.error}`);
        return;
      }

      const imported = data.details?.outlook?.imported || data.imported || 0;
      const updated = data.details?.outlook?.updated || data.updated || 0;
      const errors = data.details?.outlook?.errors || [];

      if (errors.length > 0 && imported === 0 && updated === 0) {
        setStatus(`Error: ${errors[0]}`);
      } else if (imported > 0 || updated > 0) {
        setStatus(
          `${imported} eventos nuevos, ${updated} actualizados`
        );
      } else {
        setStatus("Todo sincronizado - no hay eventos nuevos");
      }

      if (onImportComplete) onImportComplete();
      setTimeout(() => setStatus(""), 5000);
    } catch (error) {
      console.error("Sync error:", error);
      setStatus(`Error: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  // Redirect to server-side OAuth
  const connectAccount = () => {
    window.location.href = "/api/auth/outlook";
  };

  // Disconnect a specific account
  const disconnectAccount = async (email) => {
    try {
      await fetch("/api/auth/outlook/disconnect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setConnectedAccounts((prev) => prev.filter((a) => a.email !== email));
      autoSyncManager.reinitialize(supabase);
      setStatus("Cuenta desconectada");
      setTimeout(() => setStatus(""), 3000);
    } catch (error) {
      console.error("Error disconnecting:", error);
      setStatus(`Error: ${error.message}`);
    }
  };

  const hasConnected = connectedAccounts.some((a) => a.connected || a.has_refresh_token);

  // ─── Connected UI ───
  if (hasConnected) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#10B981] to-[#059669] rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Outlook Conectado</h3>
              <p className="text-[#a1a1a1] text-sm">
                {connectedAccounts.length} cuenta{connectedAccounts.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Connected accounts list */}
        <div className="mb-4 space-y-2">
          {connectedAccounts.map((account) => (
            <div
              key={account.email}
              className="flex items-center justify-between p-3 bg-[#0a0a0a] border border-[#2d2d2d] rounded-lg"
            >
              <div className="flex items-center space-x-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    account.connected || account.has_refresh_token
                      ? "bg-[#10B981]"
                      : "bg-[#EF4444]"
                  }`}
                />
                <span className="text-white text-sm">{account.email}</span>
              </div>
              <button
                onClick={() => disconnectAccount(account.email)}
                className="text-[#a1a1a1] hover:text-[#EF4444] transition-colors"
                title="Desconectar"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mb-4 p-3 bg-[#0078d4]/10 border border-[#0078d4]/30 rounded-lg">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-[#0078d4]" />
            <div>
              <div className="text-[#0078d4] font-medium text-sm">Auto-Sync Activo</div>
              <div className="text-[#a1a1a1] text-xs">
                Sincronizacion automatica cada 15 minutos
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={manualSync}
            disabled={importing}
            className="w-full flex items-center justify-center space-x-3 px-6 py-3 bg-[#0078d4] text-white rounded-lg hover:bg-[#106ebe] transition-all duration-200 disabled:opacity-50 font-medium"
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
            onClick={connectAccount}
            disabled={importing}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-[#a1a1a1] hover:text-white hover:bg-[#2a2a2a] rounded-lg transition-all duration-200 text-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar otra cuenta</span>
          </button>
        </div>

        {status && (
          <div className="mt-4 p-3 bg-[#0a0a0a] border border-[#2d2d2d] rounded-lg">
            <p className="text-sm text-[#a1a1a1]">{status}</p>
          </div>
        )}
      </div>
    );
  }

  // ─── Not connected UI ───
  return (
    <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-[#0078d4] to-[#106ebe] rounded-lg flex items-center justify-center">
          <Calendar className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Sincronizar con Outlook</h3>
          <p className="text-[#a1a1a1] text-sm">Importa tus eventos automaticamente</p>
        </div>
      </div>

      <p className="text-[#a1a1a1] text-sm mb-4">
        Conecta tu cuenta de Outlook para importar automaticamente tus eventos.
      </p>

      <button
        onClick={connectAccount}
        disabled={importing}
        className="w-full flex items-center justify-center space-x-3 px-6 py-3 bg-[#0078d4] text-white rounded-lg hover:bg-[#106ebe] transition-all duration-200 disabled:opacity-50 font-medium"
      >
        <Download className="w-5 h-5" />
        <span>Conectar con Outlook</span>
      </button>

      {status && (
        <div className="mt-4 p-3 bg-[#0a0a0a] border border-[#2d2d2d] rounded-lg">
          <p className="text-sm text-[#a1a1a1]">{status}</p>
        </div>
      )}
    </div>
  );
}
