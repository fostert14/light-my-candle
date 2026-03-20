-- ============================================================
-- LIGHT MY CANDLE — Match Event Deduplication
-- ============================================================
-- Run this in your Supabase Dashboard → SQL Editor
--
-- This creates a function that prevents duplicate "matched"
-- events when both partners light their candles close together.
-- Instead of inserting directly into candle_events, both devices
-- call this function. It checks if a match was already logged
-- for this partnership in the last 10 seconds — if so, it skips.
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_match_event(
  p_partnership_id UUID,
  p_user_id UUID,
  p_heat_level TEXT DEFAULT 'medium',
  p_mood TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Only insert if no "matched" event exists for this partnership
  -- within the last 10 seconds (from either partner)
  IF NOT EXISTS (
    SELECT 1 FROM public.candle_events
    WHERE event_type = 'matched'
      AND partnership_id = p_partnership_id
      AND created_at > now() - interval '10 seconds'
  ) THEN
    INSERT INTO public.candle_events (
      partnership_id,
      user_id,
      event_type,
      heat_level,
      mood
    ) VALUES (
      p_partnership_id,
      p_user_id,
      'matched',
      p_heat_level,
      p_mood
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;