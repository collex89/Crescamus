# Connecting Credora to Supabase (going live)

The app runs in **demo mode** (mock data, nothing saved) until you connect it
to a Supabase project. Once connected, accounts, usernames, posts, likes,
comments, follows and bookmarks are all real and persistent.

Total time: about 10 minutes. Everything below uses Supabase's free tier.

## 1. Create the project (you do this part)

1. Go to https://supabase.com and sign up (GitHub login is easiest).
2. Click **New project**, name it `credora`, choose a strong database
   password (save it somewhere safe), pick the region closest to your users,
   and click **Create new project**. Wait ~2 minutes for it to provision.

## 2. Create the database tables

1. In your project's left sidebar, open **SQL Editor**.
2. Click **New query**.
3. Open the file `supabase/schema.sql` in this repo, copy ALL of it,
   paste it into the editor, and click **Run**.
4. You should see "Success. No rows returned". That's it — all tables,
   security rules, and the unique-username enforcement now exist.

## 3. Give the app your project keys

1. In the Supabase sidebar: **Project Settings** (gear icon) -> **API**.
2. Copy two values: **Project URL** and the **anon public** key.
3. In this repo, copy `.env.example` to a new file named `.env` and fill in:

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

4. Restart the dev server (`npm run dev`). The "Demo mode" note on the login
   screen disappears — you're live.

The anon key is safe to use in a browser app (that's what it's for); the
security rules in the schema control what each signed-in user can do.
Never share the `service_role` key, and never commit `.env` (it's already
in .gitignore).

## 4. Quick test

1. Create an account in the app with a username.
2. Try registering a second account with the same username — it will be
   rejected. The username check now runs against the real database while
   you type.
3. Post something, like it, comment, follow someone from search — refresh
   the page and everything is still there.

## 5. Optional settings (Supabase dashboard -> Authentication)

- **Skip email confirmation while testing**: Authentication -> Sign In / Up
  -> Email -> turn off "Confirm email". (Turn it back on before real launch.)
- **Google sign-in**: Authentication -> Providers -> Google. You'll need a
  Google Cloud OAuth client ID/secret; the Supabase page links to the guide.
- **Apple sign-in**: same page -> Apple (requires an Apple Developer account,
  $99/yr — you can leave this until you ship to the App Store).
- **Site URL**: Authentication -> URL Configuration -> set to your deployed
  domain when you host the app (so OAuth and email links redirect correctly).

## What's connected in the app

| Feature            | Where it lives                        |
| ------------------ | ------------------------------------- |
| Sign up / sign in  | Supabase Auth (email + OAuth)          |
| Unique @usernames  | `profiles.username` UNIQUE constraint; auto-claimed by a DB trigger on signup |
| Posts (+ composer) | `posts` table                          |
| Likes / comments   | `likes`, `comments` tables             |
| Follows            | `follows` table                        |
| Bookmarks          | `bookmarks` table (private per user)   |

Still mock/local for now (future steps): Bible text, audio tracks, saints,
prayer streaks, notifications.
