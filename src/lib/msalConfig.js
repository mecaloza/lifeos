import { Configuration, PublicClientApplication } from "@azure/msal-browser";

// Microsoft Graph API configuration
export const msalConfig = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID || "your-client-id-here",
    authority: "https://login.microsoftonline.com/common",
    redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3000/auth/callback",
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

// Request scopes for calendar access
export const loginRequest = {
  scopes: ["User.Read", "Calendars.Read", "Calendars.ReadWrite"],
};

// Silent token request
export const silentRequest = {
  scopes: ["User.Read", "Calendars.Read", "Calendars.ReadWrite"],
  forceRefresh: false,
};

// Create MSAL instance
export const msalInstance = new PublicClientApplication(msalConfig);
