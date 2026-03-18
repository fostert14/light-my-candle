import { Stack } from 'expo-router';
import { Colors } from '@/constants/theme';

// Layout for auth screens (login, register)
// Uses a simple stack with no header — the screens handle their own UI

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
      }}
    />
  );
}
