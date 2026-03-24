"use client";

import { useState } from "react";
import { Calendar, Plus, CheckCircle, AlertCircle } from "lucide-react";

// Simple one-click Outlook connection for end users
export default function OutlookConnectButton({ onSuccess, onError }) {
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState("");

  // Simple one-click connection
  const connectOutlook = async () => {
    try {
      setConnecting(true);
      setStatus("🔐 Abriendo Microsoft...");

      // Create OAuth URL for Microsoft
      const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID;
      const redirectUri = encodeURIComponent(
        window.location.origin + "/auth/outlook-callback"
      );
      const scopes = encodeURIComponent(
        "User.Read Calendars.Read Calendars.ReadWrite"
      );

      // Microsoft OAuth URL
      const authUrl =
        `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
        `client_id=${clientId}&` +
        `response_type=code&` +
        `redirect_uri=${redirectUri}&` +
        `scope=${scopes}&` +
        `response_mode=query&` +
        `prompt=select_account`; // Always show account picker

      setStatus("📱 Esperando autorización...");

      // Open OAuth popup
      const popup = window.open(
        authUrl,
        "outlook-auth",
        "width=500,height=600,scrollbars=yes,resizable=yes"
      );

      // Listen for popup to close with success
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setConnecting(false);

          // Check if we got the authorization code
          const urlParams = new URLSearchParams(window.location.search);
          const code = urlParams.get("code");

          if (code) {
            setStatus("✅ ¡Outlook conectado!");
            if (onSuccess) onSuccess(code);
          } else {
            setStatus("❌ Conexión cancelada");
            if (onError) onError("User cancelled");
          }

          // Clear status after 3 seconds
          setTimeout(() => setStatus(""), 3000);
        }
      }, 1000);
    } catch (error) {
      console.error("Error connecting Outlook:", error);
      setStatus("❌ Error de conexión");
      setConnecting(false);
      if (onError) onError(error);
    }
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6">
      <div className="text-center">
        {/* Outlook Logo */}
        <div className="w-16 h-16 bg-gradient-to-br from-[#0078d4] to-[#106ebe] rounded-xl flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-8 h-8 text-white" />
        </div>

        <h3 className="text-xl font-bold text-white mb-2">
          Conectar Calendario de Outlook
        </h3>
        <p className="text-[#a1a1a1] mb-6 max-w-md mx-auto">
          Importa automáticamente tus eventos de Outlook a LifeOS. Soporta
          múltiples cuentas (personal, trabajo, etc.)
        </p>

        {/* Connect Button */}
        <button
          onClick={connectOutlook}
          disabled={connecting}
          className="flex items-center space-x-3 px-6 py-3 bg-[#0078d4] text-white rounded-lg hover:bg-[#106ebe] transition-all duration-200 disabled:opacity-50 font-medium mx-auto"
        >
          {connecting ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Conectando...</span>
            </>
          ) : (
            <>
              <Plus className="w-5 h-5" />
              <span>Conectar Outlook</span>
            </>
          )}
        </button>

        {/* Status Message */}
        {status && (
          <div className="mt-4 p-3 bg-[#0a0a0a] border border-[#2d2d2d] rounded-lg">
            <p className="text-sm text-[#a1a1a1]">{status}</p>
          </div>
        )}

        {/* Benefits List */}
        <div className="mt-6 text-left">
          <h4 className="text-white font-medium mb-3">¿Qué puedes hacer?</h4>
          <ul className="space-y-2 text-sm text-[#a1a1a1]">
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-[#10B981]" />
              <span>Importar eventos automáticamente</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-[#10B981]" />
              <span>Conectar múltiples cuentas (personal + trabajo)</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-[#10B981]" />
              <span>Sincronización bidireccional</span>
            </li>
            <li className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-[#10B981]" />
              <span>Gestión unificada en LifeOS</span>
            </li>
          </ul>
        </div>

        {/* Security Note */}
        <div className="mt-4 p-3 bg-[#1e1e1e] border border-[#3a3a3a] rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-[#F59E0B] mt-0.5" />
            <div className="text-left">
              <div className="text-[#F59E0B] text-xs font-medium">
                Seguridad
              </div>
              <div className="text-[#a1a1a1] text-xs mt-1">
                LifeOS solo accede a tu calendario. Microsoft maneja toda la
                autenticación de forma segura.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

