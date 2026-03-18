import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useCandle } from '@/contexts/CandleContext';
import { Colors, Spacing } from '@/constants/theme';
import { router } from 'expo-router';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const {
    partnership,
    partnerName,
    pairCode,
    generatePairCode,
    joinWithCode,
    unpair,
  } = useCandle();

  const [inputCode, setInputCode] = useState('');
  const [loading, setLoading] = useState(false);

  const isPaired = partnership && partnership.user2_id;
  const isWaiting = partnership && !partnership.user2_id;

  // Generate a new pair code for your partner to enter
  const handleGenerateCode = async () => {
    setLoading(true);
    const code = await generatePairCode();
    setLoading(false);
    if (code) {
      Alert.alert('Your pair code', `Share this with your partner: ${code}`);
    }
  };

  // Join using a code your partner gave you
  const handleJoinWithCode = async () => {
    if (!inputCode.trim()) {
      Alert.alert('Oops', 'Please enter a pair code');
      return;
    }
    setLoading(true);
    const { error } = await joinWithCode(inputCode.trim());
    setLoading(false);
    if (error) {
      Alert.alert('Error', error);
    } else {
      Alert.alert('Paired!', 'You\'re now connected with your partner 🕯️');
      setInputCode('');
    }
  };

  // Copy pair code to clipboard
  const handleCopyCode = async () => {
    if (pairCode || partnership?.pair_code) {
      await Clipboard.setStringAsync(pairCode || partnership?.pair_code || '');
      Alert.alert('Copied!', 'Pair code copied to clipboard');
    }
  };

  // Disconnect from partner
  const handleUnpair = () => {
    Alert.alert(
      'Unpair',
      'Are you sure you want to disconnect from your partner? This can\'t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpair',
          style: 'destructive',
          onPress: async () => {
            await unpair();
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.header}>Settings</Text>

        {/* PAIRING SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Partner Pairing</Text>

          {isPaired ? (
            // Already paired — show partner info and unpair option
            <View style={styles.card}>
              <View style={styles.pairedRow}>
                <Ionicons name="heart" size={20} color={Colors.flame} />
                <Text style={styles.pairedText}>
                  Paired with {partnerName || 'your partner'}
                </Text>
              </View>
              <Pressable style={styles.dangerButton} onPress={handleUnpair}>
                <Text style={styles.dangerButtonText}>Unpair</Text>
              </Pressable>
            </View>
          ) : isWaiting ? (
            // Generated a code, waiting for partner to join
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Your pair code:</Text>
              <View style={styles.codeRow}>
                <Text style={styles.codeText}>
                  {pairCode || partnership?.pair_code}
                </Text>
                <Pressable onPress={handleCopyCode} style={styles.copyButton}>
                  <Ionicons name="copy-outline" size={20} color={Colors.flame} />
                </Pressable>
              </View>
              <Text style={styles.cardHint}>
                Share this code with your partner. They'll enter it to connect with you.
              </Text>
            </View>
          ) : (
            // Not paired at all — show both options
            <>
              {/* Option 1: Generate a code */}
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Generate a code</Text>
                <Text style={styles.cardHint}>
                  Create a code and share it with your partner
                </Text>
                <Pressable
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleGenerateCode}
                  disabled={loading}
                >
                  <Text style={styles.buttonText}>Generate Pair Code</Text>
                </Pressable>
              </View>

              {/* Option 2: Enter a code */}
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Enter partner's code</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter 6-character code"
                  placeholderTextColor={Colors.coolGray}
                  value={inputCode}
                  onChangeText={setInputCode}
                  autoCapitalize="characters"
                  maxLength={6}
                />
                <Pressable
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleJoinWithCode}
                  disabled={loading}
                >
                  <Text style={styles.buttonText}>Join</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        {/* ACCOUNT SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>
              {user?.user_metadata?.display_name || 'User'}
            </Text>
            <Text style={styles.emailText}>{user?.email}</Text>
            <Pressable style={styles.outlineButton} onPress={handleSignOut}>
              <Text style={styles.outlineButtonText}>Sign Out</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
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
    fontSize: 14,
    fontWeight: '600',
    color: Colors.warmGray,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.warmWhite,
    marginBottom: Spacing.xs,
  },
  cardHint: {
    fontSize: 14,
    color: Colors.warmGray,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  pairedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  pairedText: {
    fontSize: 17,
    color: Colors.warmWhite,
    fontWeight: '500',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  codeText: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.flame,
    letterSpacing: 4,
  },
  copyButton: {
    padding: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: 18,
    color: Colors.warmWhite,
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  button: {
    backgroundColor: Colors.flame,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: Colors.warmGray,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md,
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
  emailText: {
    fontSize: 14,
    color: Colors.warmGray,
  },
});
