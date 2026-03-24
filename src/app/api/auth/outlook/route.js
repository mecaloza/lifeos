// Redirect user to Microsoft OAuth login (server-side auth code flow)
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request) {
  try {
    const clientId = process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_MICROSOFT_CLIENT_ID not configured" },
        { status: 500 }
      );
    }

    // Determine redirect URI based on request origin
    const { headers } = request;
    const host = headers.get("host");
    const proto = headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
    const redirectUri = `${proto}://${host}/api/auth/outlook/callback`;

    // Generate random state for CSRF protection
    const state = crypto.randomUUID();

    // Store state in a cookie for verification in callback
    const cookieStore = await cookies();
    cookieStore.set("outlook_oauth_state", state, {
      httpOnly: true,
      secure: !host?.includes("localhost"),
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    // Build Microsoft OAuth authorization URL
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: "User.Read Calendars.Read offline_access",
      state,
      response_mode: "query",
      prompt: "select_account",
    });

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Outlook auth initiation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
