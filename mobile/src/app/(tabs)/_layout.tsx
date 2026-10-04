import type { ColorValue } from 'react-native'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLayout } from '@/lib/layout'
import { colors } from '@/theme'

type IconName = React.ComponentProps<typeof Ionicons>['name']

const tab = (title: string, icon: IconName, iconActive: IconName) => ({
  title,
  tabBarIcon: ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={focused ? iconActive : icon} size={size} color={color} />
  ),
})

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  const { isTV, isTablet } = useLayout()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: isTV ? 14 : 11, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.deep,
          borderTopColor: colors.border,
          height: (isTV ? 72 : isTablet ? 64 : 56) + insets.bottom,
          paddingBottom: insets.bottom,
        },
        sceneStyle: { backgroundColor: colors.void },
      }}
    >
      <Tabs.Screen name="index" options={tab('Inicio', 'home-outline', 'home')} />
      <Tabs.Screen name="search" options={tab('Buscar', 'search-outline', 'search')} />
      <Tabs.Screen name="movies" options={tab('Películas', 'film-outline', 'film')} />
      <Tabs.Screen name="series" options={tab('Series', 'tv-outline', 'tv')} />
      <Tabs.Screen name="more" options={tab('Más', 'ellipsis-horizontal-circle-outline', 'ellipsis-horizontal-circle')} />
    </Tabs>
  )
}
