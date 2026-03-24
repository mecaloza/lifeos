// Server-side token management for calendar OAuth tokens
// Handles token refresh, connected accounts, and disconnection
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ─── Token Refresh ───

export async function refreshGoogleToken(refresh_token) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token,
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  return {
    access_token: data.access_token,
    expires_in: data.expires_in,
    token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

export async function refreshOutlookToken(refresh_token) {
  const res = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        refresh_token,
        grant_type: "refresh_token",
        scope: "User.Read Calendars.Read offline_access",
      }),
    }
  );

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || null, // Microsoft may rotate refresh tokens
    expires_in: data.expires_in,
    token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

// ─── Get Valid Token ───

/**
 * Gets a valid access token for a provider/email combination.
 * If the token is expired, it will be refreshed using the refresh token.
 * Returns the valid access_token string, or null if unable to get one.
 */
export async function getValidToken(provider, account_email) {
  const { data: account, error } = await supabase
    .from("calendar_tokens")
    .select("*")
    .eq("provider", provider)
    .eq("account_email", account_email)
    .single();

  if (error || !account) {
    console.error(`No token found for ${provider}:${account_email}`);
    return null;
  }

  const now = Date.now();
  const expiryTime = new Date(account.token_expiry).getTime();
  const isExpired = now > expiryTime - 5 * 60 * 1000; // 5 minute buffer

  if (!isExpired) {
    return account.access_token;
  }

  // Token is expired, try to refresh
  if (!account.refresh_token) {
    console.error(`No refresh token for ${provider}:${account_email}`);
    return null;
  }

  try {
    let refreshResult;
    if (provider === "google") {
      refreshResult = await refreshGoogleToken(account.refresh_token);
    } else if (provider === "outlook") {
      refreshResult = await refreshOutlookToken(account.refresh_token);
    } else {
      console.error(`Unknown provider: ${provider}`);
      return null;
    }

    // Update the token in the database
    const updateData = {
      access_token: refreshResult.access_token,
      token_expiry: refreshResult.token_expiry,
      updated_at: new Date().toISOString(),
    };

    // Update refresh token if a new one was provided (Microsoft rotates them)
    if (refreshResult.refresh_token) {
      updateData.refresh_token = refreshResult.refresh_token;
    }

    await supabase
      .from("calendar_tokens")
      .update(updateData)
      .eq("id", account.id);

    console.log(`Refreshed ${provider} token for ${account_email}`);
    return refreshResult.access_token;
  } catch (error) {
    console.error(`Failed to refresh ${provider} token for ${account_email}:`, error.message);
    return null;
  }
}

// ─── Connected Accounts ───

/**
 * Returns all connected accounts from the calendar_tokens table.
 */
export async function getConnectedAccounts() {
  const { data: accounts, error } = await supabase
    .from("calendar_tokens")
    .select("provider, account_email, token_expiry, updated_at, scopes")
    .order("provider")
    .order("account_email");

  if (error) {
    console.error("Error fetching connected accounts:", error);
    return [];
  }

  return (accounts || []).map((a) => ({
    provider: a.provider,
    email: a.account_email,
    token_expiry: a.token_expiry,
    last_synced: a.updated_at,
    scopes: a.scopes,
  }));
}

// ─── Disconnect Account ───

/**
 * Removes a specific provider/email combination from calendar_tokens.
 */
export async function disconnectAccount(provider, email) {
  const { error } = await supabase
    .from("calendar_tokens")
    .delete()
    .eq("provider", provider)
    .eq("account_email", email);

  if (error) {
    console.error(`Error disconnecting ${provider}:${email}:`, error);
    throw error;
  }

  console.log(`Disconnected ${provider} account: ${email}`);
  return true;
}
