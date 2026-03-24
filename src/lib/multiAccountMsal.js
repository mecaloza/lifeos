import { Configuration, PublicClientApplication } from "@azure/msal-browser";

// Enhanced MSAL configuration for multiple accounts
export const msalConfig = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || "your-client-id-here",
    authority: "https://login.microsoftonline.com/common",
    redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3000/auth/callback",
  },
  cache: {
    cacheLocation: "localStorage", // Use localStorage for persistent multi-account
    storeAuthStateInCookie: true,
  },
  system: {
    allowNativeBroker: false,
  },
};

// Request scopes for calendar access
export const loginRequest = {
  scopes: ["User.Read", "Calendars.Read", "Calendars.ReadWrite"],
  prompt: "select_account", // Always show account picker
};

// Create MSAL instance (lazy, client-side only)
let _msalInstance = null;
export const getMsalInstance = () => {
  if (typeof window === "undefined") return null;
  if (!_msalInstance) {
    _msalInstance = new PublicClientApplication(msalConfig);
  }
  return _msalInstance;
};
// Backward compat
export const msalInstance = typeof window !== "undefined" ? new PublicClientApplication(msalConfig) : null;

// Multi-account management
export class OutlookAccountManager {
  constructor() {
    this.accounts = [];
    this.activeAccount = null;
  }

  // Initialize and load all accounts
  async initialize() {
    try {
      const msal = getMsalInstance();
      if (!msal) return [];
      await msal.initialize();
      this.accounts = msal.getAllAccounts();
      console.log(`📧 Found ${this.accounts.length} cached accounts`);
      
      if (this.accounts.length > 0) {
        this.activeAccount = this.accounts[0];
        msal.setActiveAccount(this.activeAccount);
      }

      return this.accounts;
    } catch (error) {
      console.error("Error initializing account manager:", error);
      return [];
    }
  }

  // Add new account
  async addAccount() {
    try {
      const msal = getMsalInstance();
      if (!msal) return null;
      console.log("🔐 Adding new Outlook account...");
      const response = await msal.loginPopup(loginRequest);

      if (response.account) {
        this.accounts = msal.getAllAccounts();
        console.log(`✅ Account added: ${response.account.username}`);
        return response.account;
      }
    } catch (error) {
      console.error("Error adding account:", error);
      if (error.errorCode === "user_cancelled") {
        console.log("User cancelled account addition");
        return null;
      }
      throw error;
    }
  }

  // Switch active account
  switchAccount(accountId) {
    const msal = getMsalInstance();
    const account = this.accounts.find(acc => acc.homeAccountId === accountId);
    if (account && msal) {
      this.activeAccount = account;
      msal.setActiveAccount(account);
      console.log(`🔄 Switched to account: ${account.username}`);
      return account;
    }
    return null;
  }

  // Remove account
  async removeAccount(accountId) {
    try {
      const msal = getMsalInstance();
      if (!msal) return;
      const account = this.accounts.find(acc => acc.homeAccountId === accountId);
      if (account) {
        await msal.logoutSilent({ account });
        this.accounts = msal.getAllAccounts();
        
        // Set new active account if we removed the current one
        if (this.activeAccount?.homeAccountId === accountId) {
          this.activeAccount = this.accounts.length > 0 ? this.accounts[0] : null;
          msal.setActiveAccount(this.activeAccount);
        }

        console.log(`🗑️ Removed account: ${account.username}`);
        return true;
      }
    } catch (error) {
      console.error("Error removing account:", error);
      return false;
    }
  }

  // Get access token for active account
  async getAccessToken(account = null) {
    try {
      const msal = getMsalInstance();
      if (!msal) throw new Error("MSAL not available");
      const targetAccount = account || this.activeAccount;
      if (!targetAccount) {
        throw new Error("No active account");
      }

      const response = await msal.acquireTokenSilent({
        scopes: loginRequest.scopes,
        account: targetAccount,
      });

      return response.accessToken;
    } catch (error) {
      console.error("Error getting access token:", error);
      // Try interactive login if silent fails
      if (error.name === "InteractionRequiredAuthError") {
        try {
          const msal = getMsalInstance();
          const response = await msal.loginPopup(loginRequest);
          return response.accessToken;
        } catch (interactiveError) {
          console.error("Interactive login failed:", interactiveError);
          throw interactiveError;
        }
      }
      throw error;
    }
  }

  // Get all accounts info
  getAccountsInfo() {
    return this.accounts.map(account => ({
      id: account.homeAccountId,
      username: account.username,
      name: account.name,
      isActive: this.activeAccount?.homeAccountId === account.homeAccountId
    }));
  }
}

// Global instance
export const accountManager = new OutlookAccountManager();
