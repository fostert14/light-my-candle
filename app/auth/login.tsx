import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Spacing } from '@/constants/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Oops', 'Please fill in both fields');
      return;
    }

    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      Alert.alert('Login failed', error.message);
    } else {
      // Auth state change triggers the redirect in index.tsx automatically
      router.replace('/(app)');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Header */}
        <Text style={styles.emoji}>🕯️</Text>
        <Text style={styles.title}>Light My Candle</Text>
        <Text style={styles.subtitle}>Welcome back</Text>

        {/* Form */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={Colors.coolGray}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={Colors.coolGray}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Text>
          </Pressable>
        </View>

        {/* Footer link */}
        <Link href="/auth/register" asChild>
          <Pressable style={styles.linkContainer}>
            <Text style={styles.linkText}>
              Don't have an account?{' '}
              <Text style={styles.linkHighlight}>Sign Up</Text>
            </Text>
          </Pressable>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emoji: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.warmWhite,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.warmGray,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  form: {
    gap: Spacing.md,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: 16,
    color: Colors.warmWhite,
  },
  button: {
    backgroundColor: Colors.flame,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  linkContainer: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  linkText: {
    color: Colors.warmGray,
    fontSize: 15,
  },
  linkHighlight: {
    color: Colors.flame,
    fontWeight: '600',
  },
});
