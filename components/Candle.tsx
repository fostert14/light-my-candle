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

// This is the core visual component — the candle with an animated flame.
//
// How the animation works:
// - `flicker` is a shared value that oscillates between 0 and 1 repeatedly
// - We use it to drive subtle scale/opacity changes on the flame layers
// - `glowPulse` drives a slower breathing effect on the background glow
// - When isLit changes, `litProgress` animates from 0→1 or 1→0 with a spring
//   to create a smooth light/extinguish transition
// - `bodyDimStyle` dims the wax body + wick to 0.3 opacity when unlit (fullscreen only)

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function Candle({ isLit, size = 'large', onPress, disabled, label }: CandleProps) {
  const flicker = useSharedValue(0);
  const glowPulse = useSharedValue(0);
  const litProgress = useSharedValue(isLit ? 1 : 0);

  const isFullscreen = size === 'fullscreen';
  const isLarge = size === 'large';

  const candleHeight = isFullscreen ? SCREEN_HEIGHT * 0.45 : isLarge ? 160 : 100;
  const candleWidth = isFullscreen ? SCREEN_WIDTH * 0.65 : isLarge ? 50 : 32;
  const flameHeight = isFullscreen ? 90 : isLarge ? 50 : 30;
  const wickHeight = isFullscreen ? 20 : isLarge ? 12 : 8;
  const glowSize = isFullscreen ? SCREEN_WIDTH * 0.85 : isLarge ? 200 : 120;
  const outerFlameWidth = isFullscreen ? 44 : isLarge ? 24 : 16;
  const innerFlameWidth = isFullscreen ? 22 : isLarge ? 12 : 8;

  useEffect(() => {
    // Animate litProgress when isLit changes — spring gives it a natural feel
    litProgress.value = withSpring(isLit ? 1 : 0, {
      damping: 15,
      stiffness: 100,
    });

    if (isLit) {
      // Flicker: rapid, irregular oscillation to simulate a real flame
      flicker.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 300, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 200, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.8, { duration: 250, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: 350, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, // -1 means repeat forever
        false,
      );

      // Glow pulse: slower breathing effect for ambient light
      glowPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }
  }, [isLit]);

  // Animated style for the outer flame (the orange/red part)
  const flameStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleX: interpolate(flicker.value, [0, 1], [0.9, 1.1]) },
      { scaleY: interpolate(flicker.value, [0, 1], [0.95, 1.05]) },
    ],
    opacity: litProgress.value,
  }));

  // Inner flame (brighter yellow core) — slightly different flicker timing
  const innerFlameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(flicker.value, [0, 1], [0.85, 1.15]) }],
    opacity: litProgress.value,
  }));

  // The glow effect behind the candle — large, soft, pulsing
  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(glowPulse.value, [0, 1], [1, 1.2]) }],
    opacity: interpolate(litProgress.value, [0, 1], [0, isFullscreen ? 0.4 : 0.3]),
  }));

  // Fullscreen only: dim the wax body + wick to 0.3 when unlit, full opacity when lit
  const bodyDimStyle = useAnimatedStyle(() => ({
    opacity: isFullscreen ? interpolate(litProgress.value, [0, 1], [0.3, 1.0]) : 1,
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.container,
        isFullscreen && {
          flex: 1,
          width: '100%',
          justifyContent: 'flex-end',
          transform: [{ translateY: SCREEN_HEIGHT * 0.29 }],
        },
      ]}>
      {/* Ambient glow — renders behind everything */}
      <Animated.View
        style={[
          styles.glow,
          { width: glowSize, height: glowSize, borderRadius: glowSize / 2 },
          isFullscreen && { top: 0.1 },
          glowStyle,
        ]}
      />

      {/* Flame layers */}
      <View style={[styles.flameContainer, { height: flameHeight }]}>
        {/* Outer flame — orange */}
        <Animated.View
          style={[
            styles.flame,
            { width: outerFlameWidth, height: flameHeight, backgroundColor: Colors.flame },
            flameStyle,
          ]}
        />
        {/* Inner flame — bright yellow core */}
        <Animated.View
          style={[
            styles.innerFlame,
            { width: innerFlameWidth, height: flameHeight * 0.6, backgroundColor: Colors.flameGlow },
            innerFlameStyle,
          ]}
        />
      </View>

      {/* Wick + Body grouped so they dim together on fullscreen unlit state */}
      <Animated.View style={[styles.wickAndBody, bodyDimStyle]}>
        <View style={[styles.wick, { height: wickHeight, width: isFullscreen ? 3 : 2 }]} />

        {/* Fullscreen uses a warm amber/ivory LinearGradient; small/large use a plain View */}
        {isFullscreen ? (
          <LinearGradient
            colors={['#FFF8EC', '#F5E0BC', '#E8C090']}
            start={{ x: 0.35, y: 0 }}
            end={{ x: 0.65, y: 1 }}
            style={[
              styles.candleBody,
              {
                width: candleWidth,
                height: candleHeight,
                borderTopLeftRadius: 30,
                borderTopRightRadius: 30,
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
                width: candleWidth,
                height: candleHeight,
                borderRadius: isLarge ? 8 : 5,
                backgroundColor: isLit ? '#F5E6D3' : '#D4C4B0',
              },
            ]}
          />
        )}
      </Animated.View>

      {/* Label below the candle */}
      {label && (
        <Animated.Text
          style={[styles.label, { fontSize: isFullscreen ? 20 : isLarge ? 16 : 13 }]}
        >
          {label}
        </Animated.Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  glow: {
    position: 'absolute',
    top: -40,
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
