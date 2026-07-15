-- ====================================================================
-- Credora migration 004: post images
-- Before running this, create the storage bucket via the Dashboard (SQL
-- inserts into storage.buckets have been unreliable in this project —
-- the UI path always works):
--   Storage -> New bucket -> name it exactly "post-images" -> toggle
--   "Public bucket" ON -> Create.
-- Then run this file: SQL Editor -> New query -> paste -> Run.
-- ====================================================================

-- Allow posts with an image and no caption (X-style image-only posts).
-- Previously text required at least 1 character; now empty text is fine
-- as long as the post has *something* (enforced client-side: the Post
-- button is disabled unless there's text or an attached image).
alter table public.posts drop constraint if exists posts_text_check;
alter table public.posts alter column text set default '';
alter table public.posts add constraint posts_text_check check (char_length(text) <= 2000);

create policy "Post images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'post-images');

create policy "Users can upload their own post images"
  on storage.objects for insert
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own post images"
  on storage.objects for delete
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
