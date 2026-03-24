// Exchange Google auth code for access + refresh tokens, store in Supabase
// Supports both:
//   - GET: Server-side redirect flow (from /api/auth/google)
//   - POST: Popup code flow (from GIS client-side)
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Shared logic: exchange code, get email, upsert token
async function exchangeAndStore(code, redirectUri) {
  // Exchange authorization code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenRes.json();

  if (tokenData.error) {
    throw new Error(tokenData.error_description || tokenData.error);
  }

  const { access_token, refresh_token, expires_in } = tokenData;

  // Get user email from userinfo endpoint
  const userinfoRes = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    { headers: { Authorization: `Bearer ${access_token}` } }
  );

  let email;
  if (userinfoRes.ok) {
    const userinfo = await userinfoRes.json();
    email = userinfo.email;
  }

  // Fallback: get email from calendar API
  if (!email) {
    const calRes = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    if (calRes.ok) {
      const calData = await calRes.json();
      email = calData.id;
    }
  }

  if (!email) {
    throw new Error("Could not determine email from Google account");
  }

  const expiry = new Date(Date.now() + expires_in * 1000).toISOString();

  // Upsert token in Supabase
  const upsertData = {
    provider: "google",
    account_email: email,
    access_token,
    token_expiry: expiry,
    scopes: tokenData.scope || "",
    updated_at: new Date().toISOString(),
  };

  // Only update refresh_token if we got a new one (Google only sends it on first consent)
  if (refresh_token) {
    upsertData.refresh_token = refresh_token;
  }

  // Check if account exists
  const { data: existing } = await supabase
    .from("calendar_tokens")
    .select("id, refresh_token")
    .eq("provider", "google")
    .eq("account_email", email)
    .single();

  if (existing) {
    // Update existing — preserve old refresh_token if we didn't get a new one
    if (!refresh_token && existing.refresh_token) {
      delete upsertData.refresh_token;
    }
    await supabase
      .from("calendar_tokens")
      .update(upsertData)
      .eq("id", existing.id);
  } else {
    // Insert new
    upsertData.created_at = new Date().toISOString();
    await supabase.from("calendar_tokens").insert(upsertData);
  }

  console.log(`Google token stored for ${email}`);

  return {
    email,
    access_token,
    expires_in,
    has_refresh_token: !!refresh_token || !!existing?.refresh_token,
  };
}

// GET: Server-side redirect flow callback
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

    // Handle error from Google
    if (error) {
      console.error("Google OAuth error:", error, errorDescription);
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
    const savedState = cookieStore.get("google_oauth_state")?.value;

    if (!savedState || savedState !== state) {
      console.error("State mismatch:", { savedState, state });
      return NextResponse.redirect(
        `${baseUrl}/calendar?error=${encodeURIComponent("Invalid state parameter - please try again")}`
      );
    }

    // Clear the state cookie
    cookieStore.delete("google_oauth_state");

    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    const result = await exchangeAndStore(code, redirectUri);

    // Redirect back to calendar page with success
    return NextResponse.redirect(
      `${baseUrl}/calendar?connected=google&email=${encodeURIComponent(result.email)}`
    );
  } catch (error) {
    console.error("Google callback GET error:", error);

    const host = request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
    const baseUrl = `${proto}://${host}`;

    return NextResponse.redirect(
      `${baseUrl}/calendar?error=${encodeURIComponent(error.message || "Unknown error during Google login")}`
    );
  }
}

// POST: Popup code flow (GIS client-side sends auth code)
export async function POST(request) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: "No code provided" }, { status: 400 });
    }

    const result = await exchangeAndStore(code, "postmessage");

    return NextResponse.json(result);
  } catch (error) {
    console.error("Google callback POST error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
