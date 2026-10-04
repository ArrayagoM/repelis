import { StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { FocusPressable } from '@/components/FocusPressable'
import { colors, radius } from '@/theme'

export default function NotFound() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Esta pantalla no existe</Text>
      <FocusPressable hasTVPreferredFocus onPress={() => router.replace('/')} style={styles.btn}>
        <Text style={styles.btnText}>Ir al inicio</Text>
      </FocusPressable>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.void, alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { color: colors.chalk, fontSize: 18, fontWeight: '700' },
  btn: { backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 10, borderWidth: 2, borderColor: 'transparent' },
  btnText: { color: colors.void, fontWeight: '800' },
})
