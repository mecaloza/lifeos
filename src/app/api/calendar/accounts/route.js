// Connected calendar accounts API
// GET: Returns all connected accounts (provider, email, last synced)
// DELETE: Disconnects an account (body: {provider, email})
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function GET() {
  try {
    const { data: accounts, error } = await supabase
      .from("calendar_tokens")
      .select("provider, account_email, token_expiry, updated_at, scopes, refresh_token")
      .order("provider")
      .order("account_email");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const now = Date.now();

    const result = (accounts || []).map((a) => {
      const expiryTime = new Date(a.token_expiry).getTime();
      const isExpired = now > expiryTime - 5 * 60 * 1000;

      return {
        provider: a.provider,
        email: a.account_email,
        connected: !isExpired || !!a.refresh_token,
        token_expiry: a.token_expiry,
        last_synced: a.updated_at,
        has_refresh_token: !!a.refresh_token,
        expired: isExpired,
      };
    });

    return NextResponse.json({ accounts: result });
  } catch (error) {
    console.error("Error fetching connected accounts:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { provider, email } = await request.json();

    if (!provider || !email) {
      return NextResponse.json(
        { error: "Both provider and email are required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("calendar_tokens")
      .delete()
      .eq("provider", provider)
      .eq("account_email", email);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(`Disconnected ${provider} account: ${email}`);
    return NextResponse.json({ success: true, provider, email });
  } catch (error) {
    console.error("Error disconnecting account:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
