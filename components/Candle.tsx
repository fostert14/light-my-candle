import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/theme';

type CandleProps = {
  isLit: boolean;
  size?: 'small' | 'large' | 'fullscreen';
  onPress?: () => void;
  disabled?: boolean;
  label?: string;
};

// Core visual component — candle with animated flame.
//
// Animation overview:
// - `flicker`      — rapid oscillation (0↔1) driving scale/opacity on flame layers
// - `glowPulse`    — slower breathing effect on ambient glow
// - `litProgress`  — spring-animated 0→1 / 1→0 for smooth light/extinguish transitions
// - `bodyDimStyle` — dims wax + wick to 0.3 opacity when unlit (fullscreen only)

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Size presets ──────────────────────────────────────────────────────────────

const SIZE_CONFIG = {
  small: {
    candleHeight: 100,
    candleWidth: 32,
    flameHeight: 30,
    wickHeight: 8,
    wickWidth: 2,
    glowSize: 120,
    outerFlameWidth: 16,
    innerFlameWidth: 8,
    bodyRadius: 5,
    bodyTopRadius: 5,
    labelSize: 13,
    glowOpacity: 0.3,
  },
  large: {
    candleHeight: 160,
    candleWidth: 50,
    flameHeight: 50,
    wickHeight: 12,
    wickWidth: 2,
    glowSize: 200,
    outerFlameWidth: 24,
    innerFlameWidth: 12,
    bodyRadius: 8,
    bodyTopRadius: 8,
    labelSize: 16,
    glowOpacity: 0.3,
  },
  fullscreen: {
    candleHeight: SCREEN_HEIGHT * 0.45,
    candleWidth: SCREEN_WIDTH * 0.65,
    flameHeight: 90,
    wickHeight: 20,
    wickWidth: 3,
    glowSize: SCREEN_WIDTH * 1.3,
    outerFlameWidth: 44,
    innerFlameWidth: 22,
    bodyRadius: 0,
    bodyTopRadius: 30,
    labelSize: 20,
    glowOpacity: 0.4,
  },
} as const;

// ── Flicker sequence — irregular timing simulates a real flame ────────────────

const FLICKER_EASING = Easing.inOut(Easing.ease);

const flickerSequence = () =>
  withRepeat(
    withSequence(
      withTiming(1, { duration: 300, easing: FLICKER_EASING }),
      withTiming(0.3, { duration: 200, easing: FLICKER_EASING }),
      withTiming(0.8, { duration: 250, easing: FLICKER_EASING }),
      withTiming(0.2, { duration: 350, easing: FLICKER_EASING }),
    ),
    -1,
    false,
  );

const glowSequence = () =>
  withRepeat(
    withSequence(
      withTiming(1, { duration: 2000, easing: FLICKER_EASING }),
      withTiming(0, { duration: 2000, easing: FLICKER_EASING }),
    ),
    -1,
    false,
  );

// ── Component ─────────────────────────────────────────────────────────────────

export default function Candle({ isLit, size = 'large', onPress, disabled, label }: CandleProps) {
  const flicker = useSharedValue(0);
  const glowPulse = useSharedValue(0);
  const litProgress = useSharedValue(isLit ? 1 : 0);

  const config = SIZE_CONFIG[size];
  const isFullscreen = size === 'fullscreen';

  useEffect(() => {
    litProgress.value = withSpring(isLit ? 1 : 0, { damping: 15, stiffness: 100 });

    if (isLit) {
      flicker.value = flickerSequence();
      glowPulse.value = glowSequence();
    }
  }, [isLit]);

  // ── Animated styles ───────────────────────────────────────────

  const flameStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleX: interpolate(flicker.value, [0, 1], [0.9, 1.1]) },
      { scaleY: interpolate(flicker.value, [0, 1], [0.95, 1.05]) },
    ],
    opacity: litProgress.value,
  }));

  const innerFlameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(flicker.value, [0, 1], [0.85, 1.15]) }],
    opacity: litProgress.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(glowPulse.value, [0, 1], [1, 1.2]) }],
    opacity: interpolate(litProgress.value, [0, 1], [0, config.glowOpacity]),
  }));

  const bodyDimStyle = useAnimatedStyle(() => ({
    opacity: isFullscreen ? interpolate(litProgress.value, [0, 1], [0.3, 1.0]) : 1,
  }));

  // ── Render ────────────────────────────────────────────────────

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.container,
        isFullscreen && styles.containerFullscreen,
      ]}
    >
      {/* Ambient glow — behind everything */}
      <Animated.View
        style={[
          styles.glow,
          {
            width: config.glowSize,
            height: config.glowSize,
            borderRadius: config.glowSize / 2,
            bottom: isFullscreen ? config.candleHeight : config.candleHeight * 0.25,
          },
          glowStyle,
        ]}
      />

      {/* Flame layers */}
      <View style={[styles.flameContainer, { height: config.flameHeight }]}>
        <Animated.View
          style={[
            styles.flame,
            { width: config.outerFlameWidth, height: config.flameHeight, backgroundColor: Colors.flame },
            flameStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.innerFlame,
            { width: config.innerFlameWidth, height: config.flameHeight * 0.6, backgroundColor: Colors.flameGlow },
            innerFlameStyle,
          ]}
        />
      </View>

      {/* Wick + Body — dim together when fullscreen & unlit */}
      <Animated.View style={[styles.wickAndBody, bodyDimStyle]}>
        <View style={[styles.wick, { height: config.wickHeight, width: config.wickWidth }]} />

        {isFullscreen ? (
          <LinearGradient
            colors={['#FFF8EC', '#F5E0BC', '#E8C090']}
            start={{ x: 0.35, y: 0 }}
            end={{ x: 0.65, y: 1 }}
            style={[
              styles.candleBody,
              {
                width: config.candleWidth,
                height: config.candleHeight,
                borderTopLeftRadius: config.bodyTopRadius,
                borderTopRightRadius: config.bodyTopRadius,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
              },
            ]}
          />
        ) : (
          <View
            style={[
              styles.candleBody,
              {
                width: config.candleWidth,
                height: config.candleHeight,
                borderRadius: config.bodyRadius,
                backgroundColor: isLit ? '#F5E6D3' : '#D4C4B0',
              },
            ]}
          />
        )}
      </Animated.View>

      {label && (
        <Animated.Text style={[styles.label, { fontSize: config.labelSize }]}>
          {label}
        </Animated.Text>
      )}
    </Pressable>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  containerFullscreen: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    transform: [{ translateY: SCREEN_HEIGHT * 0.29 }],
  },
  glow: {
    position: 'absolute',
    backgroundColor: Colors.flame,
  },
  flameContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 2,
  },
  flame: {
    borderRadius: 50,
    position: 'absolute',
    bottom: 0,
  },
  innerFlame: {
    borderRadius: 50,
    position: 'absolute',
    bottom: 4,
    zIndex: 3,
  },
  wickAndBody: {
    alignItems: 'center',
  },
  wick: {
    backgroundColor: '#333',
    zIndex: 1,
  },
  candleBody: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  label: {
    color: Colors.warmGray,
    marginTop: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});