// Runs every minute via pg_cron (see migration 016). Checks every profile's
// *local* time (using their stored IANA timezone) against their enabled
// reminders, and sends a real Web Push message for anything due right now --
// this is what fires reminders even with the app fully closed, unlike the
// tab-only setInterval scheduler in src/lib/reminders.js.
//
// Deploy with: `supabase functions deploy send-reminder-pushes --no-verify-jwt`
// (--no-verify-jwt because the caller is pg_cron, not a logged-in user --
// see the X-Cron-Secret check below for the actual auth on this endpoint).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Mirrors LITURGICAL_PRAYERS in src/lib/reminders.js -- keep these two in
// sync if the wording or set of reminders ever changes.
const LITURGICAL: Record<string, { title: string; body: string }> = {
  morning: { title: "Morning Prayer", body: "Offer your day to God. Time for Morning Prayer." },
  angelus: { title: "The Angelus", body: "Time to pray the Angelus." },
  rosary: { title: "The Holy Rosary", body: "Time to pray the Rosary." },
  evening: { title: "Evening Examen", body: "Time for your evening examination of conscience." },
};

function hhmmInTimezone(timeZone: string | null): string {
  const tz = timeZone || "UTC";
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  } catch {
    // Unknown/garbled timezone string -- fall back to UTC rather than fail
    // the whole run over one bad profile.
    return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  }
}

Deno.serve(async (req) => {
  if (req.headers.get("X-Cron-Secret") !== CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, timezone, reminders_enabled, reminder_times");

  if (profilesError) {
    return new Response(JSON.stringify({ error: profilesError.message }), { status: 500 });
  }

  // userId -> messages due this exact minute
  const due = new Map<string, { title: string; body: string }[]>();
  const addDue = (userId: string, title: string, body: string) => {
    if (!due.has(userId)) due.set(userId, []);
    due.get(userId)!.push({ title, body });
  };

  for (const profile of profiles || []) {
    const nowHHMM = hhmmInTimezone(profile.timezone);
    const enabled = profile.reminders_enabled || {};
    const times = profile.reminder_times || {};

    if (enabled.mercy && (nowHHMM === "03:00" || nowHHMM === "15:00")) {
      addDue(profile.id, "Divine Mercy Chaplet", "The Hour of Great Mercy. Time to pray the Chaplet of Divine Mercy.");
    }

    for (const [key, meta] of Object.entries(LITURGICAL)) {
      if (enabled[key] && times[key] && times[key] === nowHHMM) {
        addDue(profile.id, meta.title, meta.body);
      }
    }
  }

  // Personal prayer intentions live in their own table, each with its own
  // reminder time, independent of the liturgical ones above.
  const { data: intentions } = await supabase
    .from("prayer_intentions")
    .select("id, user_id, text, reminder_time, reminder_enabled, completed")
    .eq("reminder_enabled", true)
    .eq("completed", false);

  const timezoneById = new Map((profiles || []).map((p) => [p.id, p.timezone]));
  for (const intention of intentions || []) {
    const nowHHMM = hhmmInTimezone(timezoneById.get(intention.user_id) ?? null);
    if (intention.reminder_time === nowHHMM) {
      addDue(intention.user_id, "Prayer Intention", intention.text);
    }
  }

  if (due.size === 0) {
    return new Response(JSON.stringify({ sent: 0, failed: 0 }), { status: 200 });
  }

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, user_id")
    .in("user_id", [...due.keys()]);

  let sent = 0;
  let failed = 0;

  for (const sub of subs || []) {
    const messages = due.get(sub.user_id) || [];
    for (const msg of messages) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(msg)
        );
        sent++;
      } catch (err) {
        failed++;
        // 404/410 = the browser/OS says this subscription is gone for good
        // (uninstalled, data cleared, etc.) -- stop trying it forever.
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      }
    }
  }

  return new Response(JSON.stringify({ sent, failed }), { status: 200 });
});
