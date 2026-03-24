// Get all stored Google accounts, auto-refresh expired tokens
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function refreshGoogleToken(account) {
  if (!account.refresh_token) return null;

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: account.refresh_token,
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: "refresh_token",
      }),
    });

    const data = await res.json();

    if (data.error) {
      console.error(`Failed to refresh token for ${account.account_email}:`, data.error);
      return null;
    }

    const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();

    // Update in database
    await supabase
      .from("calendar_tokens")
      .update({
        access_token: data.access_token,
        token_expiry: newExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);

    console.log(`🔄 Refreshed Google token for ${account.account_email}`);

    return {
      email: account.account_email,
      token: data.access_token,
      expiry: new Date(newExpiry).getTime(),
      has_refresh_token: true,
    };
  } catch (error) {
    console.error(`Error refreshing token for ${account.account_email}:`, error);
    return null;
  }
}

export async function GET() {
  try {
    const { data: accounts, error } = await supabase
      .from("calendar_tokens")
      .select("*")
      .eq("provider", "google");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = [];
    const now = Date.now();

    for (const account of accounts || []) {
      const expiryTime = new Date(account.token_expiry).getTime();
      const isExpired = now > expiryTime - 5 * 60 * 1000; // 5 min buffer

      if (isExpired && account.refresh_token) {
        // Auto-refresh
        const refreshed = await refreshGoogleToken(account);
        if (refreshed) {
          result.push(refreshed);
        } else {
          result.push({
            email: account.account_email,
            token: null,
            expiry: expiryTime,
            expired: true,
            has_refresh_token: !!account.refresh_token,
          });
        }
      } else {
        result.push({
          email: account.account_email,
          token: isExpired ? null : account.access_token,
          expiry: expiryTime,
          expired: isExpired,
          has_refresh_token: !!account.refresh_token,
        });
      }
    }

    return NextResponse.json({ accounts: result });
  } catch (error) {
    console.error("Error fetching Google tokens:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
