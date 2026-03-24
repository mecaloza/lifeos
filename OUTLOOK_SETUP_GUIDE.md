# 📅 Guía Simple: Conectar TU Outlook a LifeOS

## 🎯 Objetivo

Conectar tu calendario personal de Outlook a tu LifeOS para importar automáticamente tus eventos.

## 📋 Pasos Simples

### 1️⃣ Crear App en Azure (5 minutos)

1. **Ve a Azure Portal**: [portal.azure.com](https://portal.azure.com)
2. **Busca**: "Azure Active Directory" en la barra de búsqueda
3. **Clic en**: "Azure Active Directory"
4. **Menú izquierdo**: "App registrations" / "Registros de aplicaciones"
5. **Clic**: "+ New registration" / "+ Nuevo registro"

**Configuración:**

- **Nombre**: `LifeOS Personal Calendar`
- **Tipos de cuenta**: `Accounts in any organizational directory and personal Microsoft accounts`
- **URI de redirección**:
  - Tipo: `Single-page application (SPA)`
  - URL: `http://localhost:3000`

6. **Clic**: "Register" / "Registrar"

### 2️⃣ Configurar Permisos

1. **En tu nueva app**, ve a **"API permissions"**
2. **Clic**: "+ Add a permission"
3. **Clic**: "Microsoft Graph"
4. **Clic**: "Delegated permissions"
5. **Busca y selecciona**:
   - ✅ `User.Read`
   - ✅ `Calendars.Read`
   - ✅ `Calendars.ReadWrite`
6. **Clic**: "Add permissions"
7. **Clic**: "Grant admin consent" (botón azul)

### 3️⃣ Copiar Credenciales

1. **Ve a "Overview"** en tu app
2. **Copia**: "Application (client) ID"

### 4️⃣ Configurar Variables de Entorno

**Actualiza tu archivo `.env.local`:**

```env
NEXT_PUBLIC_SUPABASE_URL=https://dexqvhzwssqwjttrouqv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_existente
NEXT_PUBLIC_MICROSOFT_CLIENT_ID=tu_client_id_copiado_de_azure
```

### 5️⃣ Usar en LifeOS

1. **Reinicia** tu servidor de desarrollo
2. **Ve a** `/calendar` en tu app
3. **Scroll abajo** - verás la sección "Conectar Outlook"
4. **Clic**: "Conectar Outlook"
5. **Ventana de Microsoft** se abre
6. **Inicia sesión** con tu cuenta de Outlook
7. **Clic**: "Sí" para permitir acceso
8. **¡Listo!** Tus eventos se importan automáticamente

## 🎯 Resultado

- ✅ Tus eventos de Outlook aparecen en LifeOS
- ✅ Puedes editar/mover eventos en LifeOS
- ✅ Cambios se sincronizan con Outlook
- ✅ Tienes control total en una sola app

## 🔄 Para Múltiples Cuentas

**Después puedes conectar:**

- 📧 Tu Outlook personal
- 📧 Tu Outlook del trabajo
- 📧 Otras cuentas de Microsoft

**Cada una se conecta con el mismo botón!**

---

**💡 Nota**: Esta es la configuración personal. Para convertir en SaaS después, solo necesitamos añadir autenticación de usuarios.

