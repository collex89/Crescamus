// Deletes the calling user's account entirely (auth login + all their data).
//
// Why this has to be a server function and not a plain client call: deleting
// an auth.users row requires Supabase's service_role key, which must never
// be shipped to a browser. This function holds that key server-side, checks
// the caller's own JWT to find out who they are, and deletes *only* that
// account. Deleting the auth.users row cascades (via "on delete cascade" in
// the schema) to profile, posts, comments, likes, follows, bookmarks,
// messages, notifications, prayer logs/intentions, reports filed, and blocks
// — everything tied to that user disappears.
//
// Deploy with the Supabase CLI: `supabase functions deploy delete-account`
// (see SUPABASE_SETUP.md for the full one-time setup).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify who's calling, using their own token (not the service key).
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Now use the privileged service key, scoped to deleting exactly this
  // one verified user — never trusts a user ID passed in the request body.
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
