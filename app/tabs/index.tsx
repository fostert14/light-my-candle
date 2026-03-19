import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  interpolate,
  Easing,
} from 'react-native-reanimated';
// Note: Ensure your imports point to your actual local files
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

  const { width: SCREEN_WIDTH } = useWindowDimensions();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [addPartnerOpen, setAddPartnerOpen] = useState(false);
  // We no longer strictly need currentPage for the top bar logic, 
  // but keeping it if you need it for pagination dots later!
  const [currentPage, setCurrentPage] = useState(0); 
  const scrollRef = useRef<ScrollView>(null);

  const partnerPulse = useSharedValue(0);

  useEffect(() => {
    if (partnerCandle?.is_lit) {
      partnerPulse.value = withRepeat(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(partnerPulse);
      partnerPulse.value = 0;
    }
  }, [partnerCandle?.is_lit]);

  const partnerIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(partnerPulse.value, [0, 1], [0.6, 1.0]),
  }));

  const isPaired = !!partnership?.user2_id;

  const handleLightMine = async () => {
    if (myCandle?.is_lit) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await toggleMyCandle();
  };

  const handleBlowOut = () => {
    if (!partnerCandle?.is_lit) return;
    Alert.alert(
      `Blow out ${partnerName || 'Partner'}'s candle?`,
      undefined,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await blowOutPartnerCandle();
          },
        },
      ],
    );
  };

const goToPage = (page: number) => {
    scrollRef.current?.scrollTo({ x: page * SCREEN_WIDTH, animated: true });
    setCurrentPage(page);
  };

  return (
    <SafeAreaView style={styles.container}>
      {isPaired ? (
        // ── Paired state: horizontal pager ────────────────────────
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => {
            const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            setCurrentPage(page);
          }}
          style={styles.pager}>
            
          {/* ── Screen 1: My Candle ─────────────────────────────────────── */}
          <View style={[styles.page, { width: SCREEN_WIDTH }]}>
            {/* Screen 1 Top Bar inside the page */}
            <View style={styles.pageTopBar}>
              <Pressable onPress={() => setSidebarOpen(true)} style={styles.iconButton} hitSlop={12}>
                <Ionicons name="menu" size={28} color={Colors.warmWhite} />
              </Pressable>
              <Pressable onPress={() => goToPage(1)} hitSlop={12}>
                <Animated.View style={partnerIndicatorStyle}>
                  <Ionicons
                    name={partnerCandle?.is_lit ? 'flame' : 'flame-outline'}
                    size={28}
                    color={Colors.flame}
                  />
                </Animated.View>
              </Pressable>
            </View>

            <Candle isLit={myCandle?.is_lit ?? false} size="fullscreen" onPress={handleLightMine} />
          </View>

          {/* ── Screen 2: Partner's Candle ──────────────────────────────── */}
          <View style={[styles.page, { width: SCREEN_WIDTH }]}>
            {/* Screen 2 Top Bar inside the page */}
            <View style={styles.pageTopBar}>
              <Pressable onPress={() => goToPage(0)} style={styles.iconButton} hitSlop={12}>
                <Ionicons name="chevron-back" size={28} color={Colors.warmWhite} />
              </Pressable>
              {partnerCandle?.is_lit ? (
                <Pressable onPress={handleBlowOut} hitSlop={12} style={styles.blowOutIconButton}>
                  <Ionicons name="flash-off" size={20} color={Colors.warmWhite} />
                </Pressable>
              ) : (
                <View style={{ width: 32 }} /> // Empty view to balance the flex layout if back arrow is alone
              )}
            </View>

            <Candle
              isLit={partnerCandle?.is_lit ?? false}
              size="fullscreen"
              label={partnerName || 'Partner'}
            />
          </View>
        </ScrollView>
      ) : (
        // ── Unpaired state remains unchanged ───────────────────────────────
        <>
          <View style={styles.staticTopBar}>
            <Pressable onPress={() => setSidebarOpen(true)} style={styles.iconButton} hitSlop={12}>
              <Ionicons name="menu" size={28} color={Colors.warmWhite} />
            </Pressable>
          </View>
          <View style={styles.unpairedContent}>
            <Text style={styles.unpairedEmoji}>🕯️</Text>
            <Pressable
              style={styles.addPartnerButton}
              onPress={() => setAddPartnerOpen(true)}
            >
              <Ionicons name="add" size={28} color="#fff" />
              <Text style={styles.addPartnerText}>Add Partner</Text>
            </Pressable>
            <Text style={styles.unpairedHint}>Connect with someone to share a candle</Text>
          </View>
        </>
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
  // Used only for the Unpaired state now
  staticTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  // The new moving top bar style
  pageTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    zIndex: 10, // Ensures it stays above the Candle component
  },
  iconButton: {
    // keeps consistent with existing hamburger hit area
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blowOutIconButton: {
    backgroundColor: 'rgba(204, 85, 0, 0.20)',
    borderRadius: 18,
    padding: 6,
    opacity: 0.75,
  },
  blowOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.ember,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: 50,
    marginTop: Spacing.xxl,
  },
  blowOutText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
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