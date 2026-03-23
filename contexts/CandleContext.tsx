import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { sendPushNotification } from '@/lib/notifications';

const DEFAULT_TIMEOUT_HOURS = 10;

// A "partnership" row in the database — two users linked together
type Partnership = {
  id: string;
  user1_id: string;
  user2_id: string;
  pair_code: string;
  created_at: string;
};

// A "candle" row — each user has one, tracks their lit/unlit state
type CandleStatus = {
  id: string;
  user_id: string;
  is_lit: boolean;
  lit_at: string | null;
  partnership_id: string;
  heat_level?: string;
  mood?: string | null;
};

type CandleContextType = {
  partnership: Partnership | null;      // The active partnership (if paired)
  myCandle: CandleStatus | null;        // Your candle state
  partnerCandle: CandleStatus | null;   // Your partner's candle state
  partnerName: string | null;           // Partner's display name
  pairCode: string | null;             // Your generated pair code (for sharing)
  loading: boolean;
  candleTimeoutHours: number;           // Hours before candle auto-extinguishes (1–24)
  setCandleTimeoutHours: (hours: number) => Promise<void>;
  toggleMyCandle: () => Promise<void>;           // Light or extinguish YOUR candle
  blowOutPartnerCandle: () => Promise<void>;     // Blow out your PARTNER'S candle
  generatePairCode: () => Promise<string | null>; // Create a code to share
  joinWithCode: (code: string) => Promise<{ error: string | null }>; // Join using partner's code
  unpair: () => Promise<void>;                    // Disconnect from partner
};

const CandleContext = createContext<CandleContextType | undefined>(undefined);

export function CandleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [partnership, setPartnership] = useState<Partnership | null>(null);
  const [myCandle, setMyCandle] = useState<CandleStatus | null>(null);
  const [partnerCandle, setPartnerCandle] = useState<CandleStatus | null>(null);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [candleTimeoutHours, setCandleTimeoutHoursState] = useState<number>(
    user?.user_metadata?.candle_timeout_hours ?? DEFAULT_TIMEOUT_HOURS
  );

  // Refs to avoid stale closures in async callbacks
  const myCandleRef = useRef(myCandle);
  useEffect(() => { myCandleRef.current = myCandle; }, [myCandle]);
  const partnershipRef = useRef(partnership);
  useEffect(() => { partnershipRef.current = partnership; }, [partnership]);
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep candleTimeoutHours in sync with user metadata (e.g. after login)
  useEffect(() => {
    setCandleTimeoutHoursState(user?.user_metadata?.candle_timeout_hours ?? DEFAULT_TIMEOUT_HOURS);
  }, [user]);

  // Auto-extinguish timer — fires when candle has been lit past the timeout duration
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (!myCandle?.is_lit || !myCandle?.lit_at) return;

    const litAt = new Date(myCandle.lit_at).getTime();
    const remaining = litAt + candleTimeoutHours * 60 * 60 * 1000 - Date.now();

    const doExtinguish = async () => {
      const candle = myCandleRef.current;
      const p = partnershipRef.current;
      const u = userRef.current;
      if (!candle?.is_lit || !p || !u) return;

      await supabase.from('candle_status').update({ is_lit: false, lit_at: null }).eq('id', candle.id);
      await supabase.from('candle_events').insert({
        partnership_id: p.id,
        user_id: u.id,
        event_type: 'blown_out',
        heat_level: candle.heat_level || 'medium',
        mood: candle.mood || null,
      });
    };

    if (remaining <= 0) {
      doExtinguish();
      return;
    }

    timeoutRef.current = setTimeout(doExtinguish, remaining);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [myCandle?.is_lit, myCandle?.lit_at, candleTimeoutHours]);

  // Figure out the partner's user ID from the partnership row
  const getPartnerId = useCallback(() => {
    if (!partnership || !user) return null;
    return partnership.user1_id === user.id
      ? partnership.user2_id
      : partnership.user1_id;
  }, [partnership, user]);

  // Load the partnership and candle data when user changes
  useEffect(() => {
    if (!user) {
      // Reset everything if logged out
      setPartnership(null);
      setMyCandle(null);
      setPartnerCandle(null);
      setPartnerName(null);
      setPairCode(null);
      setLoading(false);
      return;
    }
    loadPartnership();
  }, [user]);

  // When partnership changes, load candle states and subscribe to real-time updates
  useEffect(() => {
    if (!partnership || !user) return;

    loadCandles();
    loadPartnerName();

    // REAL-TIME SUBSCRIPTION
    // This is the magic — Supabase Realtime listens for any changes to
    // candle_status rows that belong to this partnership. When your partner
    // lights their candle, this fires instantly and updates your UI.
    const channel = supabase
      .channel(`candles:${partnership.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'candle_status',
          filter: `partnership_id=eq.${partnership.id}`,
        },
        async (payload) => {
          // When a candle row changes, figure out whose it is and update state
          const updated = payload.new as CandleStatus;
          if (updated.user_id === user.id) {
            setMyCandle(updated);
          } else {
            setPartnerCandle(updated);
            // If partner just lit their candle AND my candle is already lit → match!
            if (updated.is_lit && myCandleRef.current?.is_lit) {
              await supabase.rpc('log_match_event', {
                p_partnership_id: partnership.id,
                p_user_id: user.id,
                p_heat_level: myCandleRef.current?.heat_level || 'medium',
                p_mood: myCandleRef.current?.mood || null,
              });
            }
          }
        }
      )
      .subscribe();

    // Cleanup: unsubscribe when partnership changes or component unmounts
    return () => {
      supabase.removeChannel(channel);
    };
  }, [partnership]);

  // Fetch the user's active partnership from the database
  const loadPartnership = async () => {
    if (!user) return;
    setLoading(true);

    // Check if user is in any partnership (as either user1 or user2)
    const { data, error } = await supabase
      .from('partnerships')
      .select('*')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .maybeSingle(); // Returns null if not found (no error)

    if (!error && data) {
      setPartnership(data);
    }
    setLoading(false);
  };

  // Load both candle states for this partnership
  const loadCandles = async () => {
    if (!partnership || !user) return;

    const { data } = await supabase
      .from('candle_status')
      .select('*')
      .eq('partnership_id', partnership.id);

    if (data) {
      // Sort candles into "mine" and "theirs"
      const mine = data.find((c) => c.user_id === user.id);
      const theirs = data.find((c) => c.user_id !== user.id);
      if (mine) setMyCandle(mine);
      if (theirs) setPartnerCandle(theirs);
    }
  };

  // Get partner's display name from their profile
  const loadPartnerName = async () => {
    const partnerId = getPartnerId();
    if (!partnerId) return;

    const { data } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', partnerId)
      .single();

    if (data) setPartnerName(data.display_name);
  };

  // Toggle YOUR candle on/off
  const toggleMyCandle = async () => {
    if (!myCandle || !partnership || !user) return;

    const newState = !myCandle.is_lit;

    // Before lighting, upsert daily usage count
    if (newState) {
      await supabase.from('daily_light_usage').upsert(
        { user_id: user.id, date: new Date().toISOString().slice(0, 10), light_count: 1 },
        { onConflict: 'user_id,date' }
      );
    }

    const { error } = await supabase
      .from('candle_status')
      .update({
        is_lit: newState,
        lit_at: newState ? new Date().toISOString() : null,
      })
      .eq('id', myCandle.id);

    if (error) return;

    // Log the candle event
    await supabase.from('candle_events').insert({
      partnership_id: partnership.id,
      user_id: user.id,
      event_type: newState ? 'lit' : 'blown_out',
      heat_level: myCandle.heat_level || 'medium',
      mood: myCandle.mood || null,
    });

    // If lighting and partner is already lit → log a match
    if (newState && partnerCandle?.is_lit) {
      await supabase.rpc('log_match_event', {
        p_partnership_id: partnership.id,
        p_user_id: user.id,
        p_heat_level: myCandle.heat_level || 'medium',
        p_mood: myCandle.mood || null,
      });
    }

    // Send push notification to partner when lighting
    if (newState) {
      const partnerId = getPartnerId();
      if (partnerId) {
        const { data: partnerProfile } = await supabase
          .from('profiles')
          .select('push_token, display_name')
          .eq('id', partnerId)
          .single();

        if (partnerProfile?.push_token) {
          const myName = user.user_metadata?.display_name || 'Your partner';
          await sendPushNotification(
            partnerProfile.push_token,
            `${myName} lit their candle 🕯️`,
            'Open the app to see their flame'
          );
        }
      }
    }
  };

  // Blow out your PARTNER'S candle
  const blowOutPartnerCandle = async () => {
    if (!partnerCandle || !partnerCandle.is_lit || !partnership || !user) return;

    const { error } = await supabase
      .from('candle_status')
      .update({ is_lit: false, lit_at: null })
      .eq('id', partnerCandle.id);

    if (error) return;

    await supabase.from('candle_events').insert({
      partnership_id: partnership.id,
      user_id: user.id,
      event_type: 'blown_out',
      heat_level: partnerCandle.heat_level || 'medium',
      mood: partnerCandle.mood || null,
    });
  };

  // Generate a 6-character code for your partner to join
  const generatePairCode = async (): Promise<string | null> => {
    if (!user) return null;

    // Already have a partnership — return the existing code
    if (partnership) {
      return pairCode || partnership.pair_code || null;
    }

    // Create a random 6-char alphanumeric code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Create a pending partnership with just user1 (you)
    const { data, error } = await supabase
      .from('partnerships')
      .insert({
        user1_id: user.id,
        pair_code: code,
      })
      .select()
      .single();

    if (!error && data) {
      setPairCode(code);
      setPartnership(data);

      // Also create your candle status row
      await supabase.from('candle_status').insert({
        user_id: user.id,
        partnership_id: data.id,
        is_lit: false,
      });

      return code;
    }
    return null;
  };

  // Join an existing partnership using a code your partner shared
  const joinWithCode = async (code: string): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not logged in' };

    // Look up the partnership by code
    const { data: existing } = await supabase
      .from('partnerships')
      .select('*')
      .eq('pair_code', code.toUpperCase())
      .is('user2_id', null) // Must not already have a second user
      .single();

    if (!existing) {
      return { error: 'Invalid or expired code' };
    }

    if (existing.user1_id === user.id) {
      return { error: "You can't pair with yourself!" };
    }

    // Join the partnership as user2
    const { error } = await supabase
      .from('partnerships')
      .update({ user2_id: user.id })
      .eq('id', existing.id);

    if (error) return { error: error.message };

    // Create your candle status row
    await supabase.from('candle_status').insert({
      user_id: user.id,
      partnership_id: existing.id,
      is_lit: false,
    });

    // Reload partnership data
    await loadPartnership();
    return { error: null };
  };

  // Save the candle timeout preference to user metadata
  const setCandleTimeoutHours = async (hours: number) => {
    const clamped = Math.max(1, Math.min(24, Math.round(hours)));
    setCandleTimeoutHoursState(clamped);
    supabase.auth.updateUser({ data: { candle_timeout_hours: clamped } });
  };

  // Disconnect from partner — deletes the partnership and both candles
  const unpair = async () => {
    if (!partnership) return;

    await supabase.from('candle_status').delete().eq('partnership_id', partnership.id);
    await supabase.from('partnerships').delete().eq('id', partnership.id);

    setPartnership(null);
    setMyCandle(null);
    setPartnerCandle(null);
    setPartnerName(null);
    setPairCode(null);
  };

  return (
    <CandleContext.Provider
      value={{
        partnership,
        myCandle,
        partnerCandle,
        partnerName,
        pairCode,
        loading,
        candleTimeoutHours,
        setCandleTimeoutHours,
        toggleMyCandle,
        blowOutPartnerCandle,
        generatePairCode,
        joinWithCode,
        unpair,
      }}
    >
      {children}
    </CandleContext.Provider>
  );
}

// Custom hook — use this in any component to access candle/partnership state
// Example: const { myCandle, toggleMyCandle } = useCandle();
export function useCandle() {
  const context = useContext(CandleContext);
  if (context === undefined) {
    throw new Error('useCandle must be used within a CandleProvider');
  }
  return context;
}
