// Called by the service worker (public/sw.js) when a user taps or dismisses
// a prayer-reminder notification, so send-reminder-pushes stops re-alerting
// that reminder for the day.
//
// There's no logged-in session in a service worker, so the caller is
// identified by its push subscription endpoint instead -- an unguessable
// per-device URL that only that device (and our own push_subscriptions
// table) knows. The worst anyone holding someone else's endpoint could do
// here is silence that person's re-alerts for a reminder, never read or
// change anything else.
//
// Deploy with: `supabase functions deploy ack-reminder --no-verify-jwt`

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Matches reminderTag() in send-reminder-pushes: rem:<key>:<YYYY-MM-DD>
const TAG_PATTERN = /^rem:[A-Za-z0-9_-]{1,80}:\d{4}-\d{2}-\d{2}$/;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  // Sent as text/plain (keeps the service worker's request CORS-simple),
  // so parse the body ourselves.
  let payload: { endpoint?: unknown; tag?: unknown };
  try {
    payload = JSON.parse(await req.text());
  } catch {
    return new Response(null, { status: 400 });
  }

  const { endpoint, tag } = payload;
  if (
    typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 2000 ||
    typeof tag !== "string" || !TAG_PATTERN.test(tag)
  ) {
    return new Response(null, { status: 400 });
  }

  const { data: sub } = await supabase
    .from("push_subscriptions")
    .select("user_id")
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (!sub) return new Response(null, { status: 404 });

  const { error } = await supabase
    .from("reminder_acks")
    .upsert({ user_id: sub.user_id, tag }, { onConflict: "user_id,tag", ignoreDuplicates: true });
  if (error) return new Response(null, { status: 500 });

  return new Response(null, { status: 204 });
});
