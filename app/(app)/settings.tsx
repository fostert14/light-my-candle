import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useCandle } from '@/contexts/CandleContext';
import { Colors, Spacing } from '@/constants/theme';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { partnership, partnerName, unpair } = useCandle();

  const isPaired = !!(partnership?.user2_id);

  const handleUnpair = () => {
    Alert.alert(
      'Unpair',
      "Are you sure you want to disconnect from your partner? This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpair',
          style: 'destructive',
          onPress: async () => {
            await unpair();
            router.back();
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/auth/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Back button */}
      <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
        <Ionicons name="chevron-back" size={26} color={Colors.warmWhite} />
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Settings</Text>

        {/* ACCOUNT */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <Text style={styles.displayName}>
              {user?.user_metadata?.display_name || 'User'}
            </Text>
            <Text style={styles.email}>{user?.email}</Text>
            <Pressable style={styles.outlineButton} onPress={handleSignOut}>
              <Text style={styles.outlineButtonText}>Sign Out</Text>
            </Pressable>
          </View>
        </View>

        {/* PARTNER — only shown if paired */}
        {isPaired && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Partner</Text>
            <View style={styles.card}>
              <View style={styles.pairedRow}>
                <Ionicons name="heart" size={18} color={Colors.flame} />
                <Text style={styles.pairedText}>
                  Paired with {partnerName || 'your partner'}
                </Text>
              </View>
              <Pressable style={styles.dangerButton} onPress={handleUnpair}>
                <Text style={styles.dangerButtonText}>Unpair</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: 4,
  },
  backLabel: {
    fontSize: 17,
    color: Colors.warmWhite,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.warmWhite,
    marginBottom: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.warmGray,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  displayName: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.warmWhite,
  },
  email: {
    fontSize: 14,
    color: Colors.warmGray,
    marginBottom: Spacing.sm,
  },
  pairedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  pairedText: {
    fontSize: 16,
    color: Colors.warmWhite,
    fontWeight: '500',
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: Colors.warmGray,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  outlineButtonText: {
    color: Colors.warmGray,
    fontSize: 16,
    fontWeight: '500',
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: '500',
  },
});
