-- Optimizing RLS to avoid recursion in is_thread_participant
-- This explicitly allows users to see their own participation rows without triggering the helper function
DROP POLICY IF EXISTS "Participants can view thread participants" ON thread_participants;

CREATE POLICY "Participants can view thread participants"
    ON thread_participants FOR SELECT
    USING (
        profile_id = auth.uid() OR -- Short-circuit for self
        is_thread_participant(thread_id, auth.uid()) -- Check correctly for others
    );

-- Ensure Realtime is enabled for messages
-- (Idempotent: repeating this doesn't hurt, but "add table" might error if already added, so we use a safe block or just ignore error implies manual check usually. 
-- However pure SQL "alter publication ... add table" throws if table already in publication.
-- We'll try to drop and add to be safe, or just leave it if we assume the previous one didn't run.
-- Best to use a DO block.)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    END IF;
END $$;
