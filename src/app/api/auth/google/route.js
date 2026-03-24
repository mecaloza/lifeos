// Redirect user to Google OAuth consent screen (server-side auth code flow)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request) {
  try {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_GOOGLE_CLIENT_ID not configured" },
        { status: 500 }
      );
    }

    // Determine redirect URI based on request origin
    const host = request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
    const redirectUri = `${proto}://${host}/api/auth/google/callback`;

    // Generate random state for CSRF protection
    const state = crypto.randomUUID();

    // Store state in a cookie for verification in callback
    const cookieStore = await cookies();
    cookieStore.set("google_oauth_state", state, {
      httpOnly: true,
      secure: !host?.includes("localhost"),
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    // Build Google OAuth authorization URL
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: "https://www.googleapis.com/auth/calendar.readonly openid email",
      state,
      access_type: "offline",
      prompt: "consent",
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Google auth initiation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
