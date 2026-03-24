// Handle Microsoft OAuth callback: exchange code for tokens, store in Supabase
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Determine base URL for redirects
    const host = request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
    const baseUrl = `${proto}://${host}`;

    // Handle error from Microsoft
    if (error) {
      console.error("Microsoft OAuth error:", error, errorDescription);
      return NextResponse.redirect(
        `${baseUrl}/calendar?error=${encodeURIComponent(errorDescription || error)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${baseUrl}/calendar?error=${encodeURIComponent("Missing code or state parameter")}`
      );
    }

    // Verify state matches cookie (CSRF protection)
    const cookieStore = await cookies();
    const savedState = cookieStore.get("outlook_oauth_state")?.value;

    if (!savedState || savedState !== state) {
      console.error("State mismatch:", { savedState, state });
      return NextResponse.redirect(
        `${baseUrl}/calendar?error=${encodeURIComponent("Invalid state parameter - please try again")}`
      );
    }

    // Clear the state cookie
    cookieStore.delete("outlook_oauth_state");

    const redirectUri = `${baseUrl}/api/auth/outlook/callback`;

    // Exchange authorization code for tokens
    const tokenRes = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET,
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
          scope: "User.Read Calendars.Read offline_access",
        }),
      }
    );

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("Microsoft token exchange error:", tokenData);
      return NextResponse.redirect(
        `${baseUrl}/calendar?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`
      );
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    // Get user email from Microsoft Graph
    const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!meRes.ok) {
      const meError = await meRes.json();
      console.error("Microsoft Graph /me error:", meError);
      return NextResponse.redirect(
        `${baseUrl}/calendar?error=${encodeURIComponent("Failed to get user info from Microsoft")}`
      );
    }

    const meData = await meRes.json();
    const email = meData.mail || meData.userPrincipalName;

    if (!email) {
      return NextResponse.redirect(
        `${baseUrl}/calendar?error=${encodeURIComponent("Could not determine email from Microsoft account")}`
      );
    }

    const expiry = new Date(Date.now() + expires_in * 1000).toISOString();

    // Upsert token in Supabase (same pattern as Google callback)
    const upsertData = {
      provider: "outlook",
      account_email: email,
      access_token,
      token_expiry: expiry,
      scopes: tokenData.scope || "User.Read Calendars.Read offline_access",
      updated_at: new Date().toISOString(),
    };

    if (refresh_token) {
      upsertData.refresh_token = refresh_token;
    }

    // Check if account exists
    const { data: existing } = await supabase
      .from("calendar_tokens")
      .select("id, refresh_token")
      .eq("provider", "outlook")
      .eq("account_email", email)
      .single();

    if (existing) {
      // Update existing - preserve old refresh_token if we didn't get a new one
      if (!refresh_token && existing.refresh_token) {
        delete upsertData.refresh_token;
      }
      await supabase
        .from("calendar_tokens")
        .update(upsertData)
        .eq("id", existing.id);
    } else {
      upsertData.created_at = new Date().toISOString();
      await supabase.from("calendar_tokens").insert(upsertData);
    }

    console.log(`Outlook token stored for ${email} (server-side OAuth)`);

    // Redirect back to calendar page with success
    return NextResponse.redirect(
      `${baseUrl}/calendar?outlook_connected=${encodeURIComponent(email)}`
    );
  } catch (error) {
    console.error("Outlook callback error:", error);

    const host = request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
    const baseUrl = `${proto}://${host}`;

    return NextResponse.redirect(
      `${baseUrl}/calendar?error=${encodeURIComponent(error.message || "Unknown error during Outlook login")}`
    );
  }
}
