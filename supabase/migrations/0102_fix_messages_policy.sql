-- Drop the existing policy
DROP POLICY IF EXISTS "Participants can view messages" ON messages;

-- Create a new policy using direct check instead of the security definer function
-- This relies on the user being able to see their own thread_participants row (which we allowed in 0101)
CREATE POLICY "Participants can view messages"
    ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM thread_participants 
            WHERE thread_participants.thread_id = messages.thread_id 
            AND thread_participants.profile_id = auth.uid()
        )
    );

-- Double check publication (force add) but safely
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
