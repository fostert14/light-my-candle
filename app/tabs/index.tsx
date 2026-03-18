import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Candle from '@/components/Candle';
import { useCandle } from '@/contexts/CandleContext';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing } from '@/constants/theme';

// This is THE screen — where the magic happens.
//
// Layout:
// - If not paired: shows a message directing to Settings to pair
// - If paired: shows both candles side by side
//   - Your candle (left): tap to light/extinguish
//   - Partner's candle (right): tap to blow out (only if lit)
//
// The real-time subscription in CandleContext means partner's candle
// updates instantly when they light it on their phone.

export default function CandleScreen() {
  const { user } = useAuth();
  const {
    partnership,
    myCandle,
    partnerCandle,
    partnerName,
    loading,
    toggleMyCandle,
    blowOutPartnerCandle,
  } = useCandle();

  // Handle tapping your own candle
  const handleToggleMine = async () => {
    // Haptic feedback makes the interaction feel physical
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await toggleMyCandle();
  };

  // Handle blowing out partner's candle
  const handleBlowOut = async () => {
    if (!partnerCandle?.is_lit) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await blowOutPartnerCandle();
  };

  // Not paired yet — prompt user to go to settings
  if (!partnership || !partnership.user2_id) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🕯️</Text>
          <Text style={styles.emptyTitle}>No partner yet</Text>
          <Text style={styles.emptySubtitle}>
            Go to Settings to generate a pair code{'\n'}or enter your partner's code
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Determine display status message
  const getStatusMessage = () => {
    const myLit = myCandle?.is_lit;
    const theirLit = partnerCandle?.is_lit;

    if (myLit && theirLit) return "You're both in the mood ✨";
    if (myLit && !theirLit) return 'Your candle is lit...waiting';
    if (!myLit && theirLit) return `${partnerName || 'Partner'} lit their candle 👀`;
    return 'All quiet tonight';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Status message at top */}
      <Text style={styles.statusText}>{getStatusMessage()}</Text>

      {/* Candle display area */}
      <View style={styles.candleRow}>
        {/* YOUR candle */}
        <Candle
          isLit={myCandle?.is_lit ?? false}
          size="large"
          onPress={handleToggleMine}
          label="You"
        />

        {/* PARTNER'S candle */}
        <Candle
          isLit={partnerCandle?.is_lit ?? false}
          size="large"
          onPress={handleBlowOut}
          label={partnerName || 'Partner'}
        />
      </View>

      {/* Hint text at bottom */}
      <Text style={styles.hintText}>
        Tap your candle to {myCandle?.is_lit ? 'extinguish' : 'light'} it
        {partnerCandle?.is_lit ? '\nTap partner\'s candle to blow it out' : ''}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 18,
    color: Colors.warmWhite,
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: Spacing.xxl,
    letterSpacing: 0.3,
  },
  candleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 60,
  },
  hintText: {
    fontSize: 14,
    color: Colors.coolGray,
    textAlign: 'center',
    marginTop: Spacing.xxl,
    lineHeight: 22,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.warmWhite,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 16,
    color: Colors.warmGray,
    textAlign: 'center',
    lineHeight: 24,
  },
});
