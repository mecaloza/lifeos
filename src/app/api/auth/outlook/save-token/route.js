// Save Outlook token to Supabase for cross-device persistence
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const { email, access_token, expiry } = await request.json();

    if (!email || !access_token) {
      return NextResponse.json(
        { error: "Missing email or access_token" },
        { status: 400 }
      );
    }

    const tokenExpiry = expiry || new Date(Date.now() + 3600 * 1000).toISOString();

    // Check if account exists
    const { data: existing } = await supabase
      .from("calendar_tokens")
      .select("id")
      .eq("provider", "outlook")
      .eq("account_email", email)
      .single();

    if (existing) {
      await supabase
        .from("calendar_tokens")
        .update({
          access_token,
          token_expiry: tokenExpiry,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("calendar_tokens").insert({
        provider: "outlook",
        account_email: email,
        access_token,
        token_expiry: tokenExpiry,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    console.log(`✅ Outlook token stored for ${email}`);
    return NextResponse.json({ success: true, email });
  } catch (error) {
    console.error("Error saving Outlook token:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
