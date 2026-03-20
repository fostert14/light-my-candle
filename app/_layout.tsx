import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { CandleProvider } from '@/contexts/CandleContext';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/theme';
import { registerForPushNotifications } from '@/lib/notifications';

// This is the top-level layout. Expo Router renders this FIRST,
// then slots in the appropriate child route (auth screens or tab screens).
//
// The provider hierarchy matters:
// AuthProvider (outermost) → CandleProvider (needs auth) → screens
//
// Stack is the navigation container — it manages the screen stack.
// headerShown: false hides the default navigation bar so we control our own UI.

function AppLayout() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      registerForPushNotifications(user.id);
    }
  }, [user]);

  return (
    <CandleProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'fade',
        }}
      />
    </CandleProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppLayout />
    </AuthProvider>
  );
}
