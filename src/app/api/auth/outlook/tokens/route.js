// Get all stored Outlook accounts, auto-refresh expired tokens
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function refreshOutlookToken(account) {
  if (!account.refresh_token) return null;

  try {
    const res = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET,
          refresh_token: account.refresh_token,
          grant_type: "refresh_token",
          scope: "User.Read Calendars.Read offline_access",
        }),
      }
    );

    const data = await res.json();

    if (data.error) {
      console.error(
        `Failed to refresh Outlook token for ${account.account_email}:`,
        data.error,
        data.error_description
      );
      return null;
    }

    const newExpiry = new Date(
      Date.now() + data.expires_in * 1000
    ).toISOString();

    // Update in database - also update refresh_token if Microsoft sent a new one
    const updateData = {
      access_token: data.access_token,
      token_expiry: newExpiry,
      updated_at: new Date().toISOString(),
    };
    if (data.refresh_token) {
      updateData.refresh_token = data.refresh_token;
    }

    await supabase
      .from("calendar_tokens")
      .update(updateData)
      .eq("id", account.id);

    console.log(`Refreshed Outlook token for ${account.account_email}`);

    return {
      email: account.account_email,
      connected: true,
      expiry: new Date(newExpiry).getTime(),
      has_refresh_token: true,
    };
  } catch (error) {
    console.error(
      `Error refreshing Outlook token for ${account.account_email}:`,
      error
    );
    return null;
  }
}

export async function GET() {
  try {
    const { data: accounts, error } = await supabase
      .from("calendar_tokens")
      .select("*")
      .eq("provider", "outlook");

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
        const refreshed = await refreshOutlookToken(account);
        if (refreshed) {
          result.push(refreshed);
        } else {
          result.push({
            email: account.account_email,
            connected: false,
            expiry: expiryTime,
            expired: true,
            has_refresh_token: !!account.refresh_token,
          });
        }
      } else {
        result.push({
          email: account.account_email,
          connected: !isExpired,
          expiry: expiryTime,
          expired: isExpired,
          has_refresh_token: !!account.refresh_token,
        });
      }
    }

    return NextResponse.json({ accounts: result });
  } catch (error) {
    console.error("Error fetching Outlook tokens:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
