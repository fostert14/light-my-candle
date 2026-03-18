import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
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
import { Colors } from '@/constants/theme';

type CandleProps = {
  isLit: boolean;
  size?: 'small' | 'large';
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

export default function Candle({ isLit, size = 'large', onPress, disabled, label }: CandleProps) {
  const flicker = useSharedValue(0);
  const glowPulse = useSharedValue(0);
  const litProgress = useSharedValue(isLit ? 1 : 0);

  const isLarge = size === 'large';
  const candleHeight = isLarge ? 160 : 100;
  const candleWidth = isLarge ? 50 : 32;
  const flameHeight = isLarge ? 50 : 30;

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
  const flameStyle = useAnimatedStyle(() => {
    const scale = interpolate(flicker.value, [0, 1], [0.9, 1.1]);
    const opacity = litProgress.value;
    return {
      transform: [{ scaleX: scale }, { scaleY: interpolate(flicker.value, [0, 1], [0.95, 1.05]) }],
      opacity,
    };
  });

  // Inner flame (brighter yellow core) — slightly different flicker timing
  const innerFlameStyle = useAnimatedStyle(() => {
    const scale = interpolate(flicker.value, [0, 1], [0.85, 1.15]);
    return {
      transform: [{ scale }],
      opacity: litProgress.value,
    };
  });

  // The glow effect behind the candle — large, soft, pulsing
  const glowStyle = useAnimatedStyle(() => {
    const scale = interpolate(glowPulse.value, [0, 1], [1, 1.2]);
    const opacity = interpolate(litProgress.value, [0, 1], [0, 0.3]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <Pressable onPress={onPress} disabled={disabled} style={styles.container}>
      {/* Ambient glow — renders behind everything */}
      <Animated.View
        style={[
          styles.glow,
          {
            width: isLarge ? 200 : 120,
            height: isLarge ? 200 : 120,
            borderRadius: isLarge ? 100 : 60,
          },
          glowStyle,
        ]}
      />

      {/* Flame layers */}
      <View style={[styles.flameContainer, { height: flameHeight }]}>
        {/* Outer flame — orange */}
        <Animated.View
          style={[
            styles.flame,
            {
              width: isLarge ? 24 : 16,
              height: flameHeight,
              backgroundColor: Colors.flame,
            },
            flameStyle,
          ]}
        />
        {/* Inner flame — bright yellow */}
        <Animated.View
          style={[
            styles.innerFlame,
            {
              width: isLarge ? 12 : 8,
              height: flameHeight * 0.6,
              backgroundColor: Colors.flameGlow,
            },
            innerFlameStyle,
          ]}
        />
      </View>

      {/* Wick */}
      <View
        style={[
          styles.wick,
          {
            height: isLarge ? 12 : 8,
            width: 2,
          },
        ]}
      />

      {/* Candle body */}
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

      {/* Label below the candle */}
      {label && (
        <Animated.Text
          style={[
            styles.label,
            { fontSize: isLarge ? 16 : 13 },
          ]}
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
