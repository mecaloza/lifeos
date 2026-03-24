// Remove Outlook account from Supabase
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function DELETE(request) {
  try {
    const { email } = await request.json();

    if (email) {
      await supabase
        .from("calendar_tokens")
        .delete()
        .eq("provider", "outlook")
        .eq("account_email", email);
      console.log(`Disconnected Outlook account: ${email}`);
    } else {
      await supabase
        .from("calendar_tokens")
        .delete()
        .eq("provider", "outlook");
      console.log("Disconnected all Outlook accounts");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
