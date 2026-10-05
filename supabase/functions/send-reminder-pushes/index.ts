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

// Continue Reading -- unlike everything above, this isn't opt-in or
// user-configurable: it fires for every profile at these two fixed local
// times, every day. Personalized from reading_progress (migration 024),
// whichever book or Bible book they most recently opened; a generic nudge
// for anyone who's never read anything yet. Deno can't import frontend
// source, so the id -> display name lookups are duplicated here from
// src/data/mockData.js (BIBLE_BOOKS) and src/lib/books.js (BOOKS_LIBRARY)
// -- both small, stable lists; keep in sync if either changes.
const CONTINUE_READING_TIMES = ["09:00", "18:00"];

const BIBLE_BOOK_NAMES: Record<string, string> = {
  "gen": "Genesis", "exo": "Exodus", "lev": "Leviticus", "num": "Numbers", "deu": "Deuteronomy",
  "jos": "Joshua", "jud": "Judges", "rut": "Ruth", "1sam": "1 Samuel", "2sam": "2 Samuel",
  "1kin": "1 Kings", "2kin": "2 Kings", "1chr": "1 Chronicles", "2chr": "2 Chronicles", "ezr": "Ezra",
  "neh": "Nehemiah", "tob": "Tobit", "jdt": "Judith", "est": "Esther", "1mac": "1 Maccabees",
  "2mac": "2 Maccabees", "job": "Job", "psa": "Psalms", "pro": "Proverbs", "ecc": "Ecclesiastes",
  "sg": "Song of Songs", "wis": "Wisdom", "sir": "Sirach", "isa": "Isaiah", "jer": "Jeremiah",
  "lam": "Lamentations", "bar": "Baruch", "eze": "Ezekiel", "dan": "Daniel", "hos": "Hosea",
  "joe": "Joel", "amo": "Amos", "oba": "Obadiah", "jon": "Jonah", "mic": "Micah",
  "nah": "Nahum", "hab": "Habakkuk", "zep": "Zephaniah", "hag": "Haggai", "zec": "Zechariah",
  "mal": "Malachi", "mat": "Matthew", "mar": "Mark", "luk": "Luke", "joh": "John",
  "act": "Acts", "rom": "Romans", "1cor": "1 Corinthians", "2cor": "2 Corinthians", "gal": "Galatians",
  "eph": "Ephesians", "phi": "Philippians", "col": "Colossians", "1the": "1 Thessalonians", "2the": "2 Thessalonians",
  "1tim": "1 Timothy", "2tim": "2 Timothy", "tit": "Titus", "phm": "Philemon", "heb": "Hebrews",
  "jam": "James", "1pet": "1 Peter", "2pet": "2 Peter", "1joh": "1 John", "2joh": "2 John",
  "3joh": "3 John", "jud_nt": "Jude", "rev": "Revelation",
};

const CLASSICS_BOOK_NAMES: Record<string, string> = {
  "imitation-of-christ": "The Imitation of Christ",
  "confessions": "Confessions",
  "story-of-a-soul": "Story of a Soul",
};

function resolveContentName(contentType: string, contentId: string): string | null {
  if (contentType === "bible") return BIBLE_BOOK_NAMES[contentId] ?? null;
  if (contentType === "book") return CLASSICS_BOOK_NAMES[contentId] ?? null;
  return null;
}

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

// Prayer reminders fire at their time and then re-alert at +1 and +2
// minutes, each push replacing the last (same tag) with a fresh buzz,
// until the user taps or dismisses it -- the service worker reports that
// to ack-reminder, and acked re-alerts are skipped below. A web push can't
// make the phone vibrate for a full minute, but three alerts across two
// minutes is the closest equivalent that survives the app being closed.
const REALERT_OFFSETS = [0, 1, 2];

function validTimezone(timeZone: string | null): string {
  const tz = timeZone || "UTC";
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

function minutesInTimezone(tz: string): number {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false })
    .format(new Date())
    .split(":")
    .map(Number);
  return (h % 24) * 60 + m;
}

function dateInTimezone(tz: string, at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

// How many minutes past `targetHHMM` it is right now in `tz`, if that's
// one of the re-alert offsets; otherwise null.
function realertOffset(targetHHMM: string, tz: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(targetHHMM || "");
  if (!match) return null;
  const target = Number(match[1]) * 60 + Number(match[2]);
  const diff = (minutesInTimezone(tz) - target + 1440) % 1440;
  return REALERT_OFFSETS.includes(diff) ? diff : null;
}

// Tag identifying one reminder on one local day. The date is taken at the
// original fire time, not now, so a 23:59 reminder's 00:00 re-alert still
// shares its tag (and its ack).
function reminderTag(key: string, tz: string, offset: number): string {
  const firedAt = new Date(Date.now() - offset * 60_000);
  return `rem:${key}:${dateInTimezone(tz, firedAt)}`;
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

  // userId -> messages due this exact minute. Prayer reminders carry a tag
  // (for re-alert replacement + acks); Continue Reading doesn't.
  type DueMessage = { title: string; body: string; tag?: string; alarm?: boolean; realert?: boolean };
  const due = new Map<string, DueMessage[]>();
  const addDue = (userId: string, msg: DueMessage) => {
    if (!due.has(userId)) due.set(userId, []);
    due.get(userId)!.push(msg);
  };
  const addReminder = (userId: string, key: string, targetHHMM: string, tz: string, title: string, body: string) => {
    const offset = realertOffset(targetHHMM, tz);
    if (offset === null) return;
    addDue(userId, { title, body, tag: reminderTag(key, tz, offset), alarm: true, realert: offset > 0 });
  };

  for (const profile of profiles || []) {
    const tz = validTimezone(profile.timezone);
    const enabled = profile.reminders_enabled || {};
    const times = profile.reminder_times || {};

    if (enabled.mercy) {
      for (const t of ["03:00", "15:00"]) {
        addReminder(profile.id, `mercy-${t.replace(":", "")}`, t, tz, "Divine Mercy Chaplet", "The Hour of Great Mercy. Time to pray the Chaplet of Divine Mercy.");
      }
    }

    for (const [key, meta] of Object.entries(LITURGICAL)) {
      if (enabled[key] && times[key]) {
        addReminder(profile.id, key, times[key], tz, meta.title, meta.body);
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
    if (!intention.reminder_time) continue;
    const tz = validTimezone(timezoneById.get(intention.user_id) ?? null);
    addReminder(intention.user_id, `int-${intention.id}`, intention.reminder_time, tz, "Prayer Intention", intention.text);
  }

  // Drop re-alerts the user already responded to (tapped or dismissed the
  // earlier one). If the lookup fails -- e.g. migration 029 not run yet --
  // re-alerts just go out unfiltered rather than the whole run failing.
  const realertTags = new Set<string>();
  for (const msgs of due.values()) for (const m of msgs) if (m.realert && m.tag) realertTags.add(m.tag);
  if (realertTags.size > 0) {
    const { data: acks, error: acksError } = await supabase
      .from("reminder_acks")
      .select("user_id, tag")
      .in("tag", [...realertTags]);
    if (!acksError) {
      const acked = new Set((acks || []).map((a) => `${a.user_id}|${a.tag}`));
      for (const [userId, msgs] of due) {
        const kept = msgs.filter((m) => !(m.realert && m.tag && acked.has(`${userId}|${m.tag}`)));
        if (kept.length > 0) due.set(userId, kept);
        else due.delete(userId);
      }
    }
  }

  // Acks only matter for the few minutes a reminder is re-alerting; clear
  // out anything older than two days once an hour so the table stays tiny.
  if (new Date().getUTCMinutes() === 0) {
    await supabase.from("reminder_acks").delete().lt("created_at", new Date(Date.now() - 2 * 86_400_000).toISOString());
  }

  // Continue Reading -- every profile, no enabled flag to check, at
  // either of the two fixed local times above.
  const continueReadingDue = (profiles || [])
    .filter((p) => CONTINUE_READING_TIMES.includes(hhmmInTimezone(p.timezone)))
    .map((p) => p.id);

  if (continueReadingDue.length > 0) {
    const { data: progressRows } = await supabase
      .from("reading_progress")
      .select("user_id, content_type, content_id, chapter, updated_at")
      .in("user_id", continueReadingDue)
      .order("updated_at", { ascending: false });

    // First row per user, in one query rather than one query per user --
    // rows are already ordered newest-first, so the first one seen per
    // user_id is that user's most recent reading_progress.
    const latestByUser = new Map<string, { content_type: string; content_id: string; chapter: number }>();
    for (const row of progressRows || []) {
      if (!latestByUser.has(row.user_id)) latestByUser.set(row.user_id, row);
    }

    for (const userId of continueReadingDue) {
      const progress = latestByUser.get(userId);
      const name = progress ? resolveContentName(progress.content_type, progress.content_id) : null;
      if (progress && name) {
        addDue(userId, { title: "Continue Reading", body: `${name}, Chapter ${progress.chapter} is waiting for you.` });
      } else {
        addDue(userId, { title: "Time to Grow in Faith", body: "Take a few minutes today for Scripture or a spiritual classic." });
      }
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
          JSON.stringify({ title: msg.title, body: msg.body, tag: msg.tag, alarm: msg.alarm })
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
