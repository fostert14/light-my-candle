import { Redirect } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/theme';

// This is the entry screen — it decides where to send the user.
// If they're logged in → go to the main tabs
// If they're not → go to the auth flow
// While checking → show a loading spinner

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.flame} />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/(app)" />;
  }

  return <Redirect href="/auth/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
