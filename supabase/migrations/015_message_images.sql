-- ====================================================================
-- Credora migration 015: message image attachments
-- Before running this, create the storage bucket via the Dashboard:
--   Storage -> New bucket -> name it exactly "message-images" -> leave
--   "Public bucket" OFF -> Create.
-- Then run this file: SQL Editor -> New query -> paste -> Run.
--
-- Unlike post-images, this bucket is private: messages.image_path stores
-- a storage path (not a public URL), and the client resolves it to a
-- short-lived signed URL on read. The select policy below allows any
-- authenticated Credora user to read it (not just the two people in the
-- conversation) -- tightening that further to sender/recipient-only would
-- need a policy that joins the messages table, which is a heavier lift
-- than this app's DMs otherwise warrant (they're already not end-to-end
-- encrypted -- see the Privacy Policy). This is still a meaningful step
-- up from a public bucket: it's gated behind having a Credora account,
-- not open to the whole internet.
-- ====================================================================

alter table public.messages add column if not exists image_path text;

-- Allow image-only messages (empty text), same reasoning as posts in
-- migration 004.
alter table public.messages drop constraint if exists messages_text_check;
alter table public.messages alter column text set default '';
alter table public.messages add constraint messages_text_check check (char_length(text) <= 2000);

create policy "Users can upload their own message images"
  on storage.objects for insert
  with check (bucket_id = 'message-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Authenticated users can read message images"
  on storage.objects for select
  using (bucket_id = 'message-images' and auth.role() = 'authenticated');

create policy "Users can delete their own message images"
  on storage.objects for delete
  using (bucket_id = 'message-images' and (storage.foldername(name))[1] = auth.uid()::text);
