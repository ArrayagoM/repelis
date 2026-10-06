import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { IntroSplash } from '@/components/IntroSplash'
import { LanguageProvider } from '@/lib/LanguageProvider'
import { AuthProvider } from '@/lib/auth'
import { PulseReporter } from '@/components/PulseReporter'
import { colors } from '@/theme'

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
        <PulseReporter />
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.void } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="title/[type]/[id]" />
          <Stack.Screen name="player/[type]/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        </Stack>
        <IntroSplash />
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  )
}
