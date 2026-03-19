import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Candle from '@/components/Candle';
import Sidebar from '@/components/Sidebar';
import AddPartnerModal from '@/components/AddPartnerModal';
import { useCandle } from '@/contexts/CandleContext';
import { Colors, Spacing } from '@/constants/theme';

export default function CandleScreen() {
  const {
    partnership,
    myCandle,
    partnerCandle,
    partnerName,
    toggleMyCandle,
    blowOutPartnerCandle,
  } = useCandle();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [addPartnerOpen, setAddPartnerOpen] = useState(false);

  const isPaired = !!partnership?.user2_id;

  const handleToggleMine = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await toggleMyCandle();
  };

  const handleBlowOut = async () => {
    if (!partnerCandle?.is_lit) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await blowOutPartnerCandle();
  };

  // const getStatusMessage = () => {
  //   const myLit = myCandle?.is_lit;
  //   const theirLit = partnerCandle?.is_lit;
  //   if (myLit && theirLit) return "You're both in the mood ✨";
  //   if (myLit && !theirLit) return 'Your candle is lit...waiting';
  //   if (!myLit && theirLit) return `${partnerName || 'Partner'} lit their candle 👀`;
  //   return 'All quiet tonight';
  // };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => setSidebarOpen(true)} style={styles.hamburger} hitSlop={12}>
          <Ionicons name="menu" size={28} color={Colors.warmWhite} />
        </Pressable>
      </View>

      {/* Main content */}
      {isPaired ? (
        // ── Paired state: show both candles ──────────────────────
        <View style={styles.pairedContent}>

          <View style={styles.candleRow}>
            <Candle
              isLit={myCandle?.is_lit ?? false}
              size="large"
              onPress={handleToggleMine}
              label="You"
            />
            <Candle
              isLit={partnerCandle?.is_lit ?? false}
              size="large"
              onPress={handleBlowOut}
              label={partnerName || 'Partner'}
            />
          </View>

          <Text style={styles.hintText}>
            Tap your candle to {myCandle?.is_lit ? 'extinguish' : 'light'} it
            {partnerCandle?.is_lit ? "\nTap partner's candle to blow it out" : ''}
          </Text>
        </View>
      ) : (
        // ── Unpaired state: Add Partner button ───────────────────
        <View style={styles.unpairedContent}>
          <Text style={styles.unpairedEmoji}>🕯️</Text>
          <Pressable
            style={styles.addPartnerButton}
            onPress={() => setAddPartnerOpen(true)}
          >
            <Ionicons name="add" size={28} color="#fff" />
            <Text style={styles.addPartnerText}>Add Partner</Text>
          </Pressable>
          <Text style={styles.unpairedHint}>
            Connect with someone to share a candle
          </Text>
        </View>
      )}

      <Sidebar visible={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <AddPartnerModal visible={addPartnerOpen} onClose={() => setAddPartnerOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  hamburger: {
    alignSelf: 'flex-start',
  },
  // Paired layout
  pairedContent: {
    flex: 1,
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
  // Unpaired layout
  unpairedContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  unpairedEmoji: {
    fontSize: 72,
  },
  addPartnerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.flame,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: 50,
  },
  addPartnerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  unpairedHint: {
    fontSize: 15,
    color: Colors.coolGray,
    textAlign: 'center',
  },
});
