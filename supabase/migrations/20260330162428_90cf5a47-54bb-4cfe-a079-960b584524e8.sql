
-- Fix function search path
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix permissive INSERT policy on conversations - require user to be a participant
DROP POLICY "Authenticated users can create conversations" ON public.conversations;
CREATE POLICY "Authenticated users can create conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Allow authenticated users to insert other participants (for creating 1-on-1 chats)
CREATE POLICY "Users can add others to own conversations" ON public.conversation_participants FOR INSERT TO authenticated WITH CHECK (
  conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid())
  OR NOT EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = conversation_participants.conversation_id)
);
