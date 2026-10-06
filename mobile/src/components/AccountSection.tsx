import { useState } from 'react'
import { ActivityIndicator, Linking, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { FocusPressable } from '@/components/FocusPressable'
import { useAuth } from '@/lib/auth'
import { SITE_URL } from '@/lib/site'
import { colors, radius } from '@/theme'

/** Cuenta gratis de Life High dentro de la app: ingresar, crear cuenta o cerrar sesión. */
export function AccountSection({ reason }: { reason?: string }) {
  const { status, user, login, register, logout } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'loading') return <ActivityIndicator color={colors.gold} style={{ marginVertical: 16 }} />
  if (status === 'unavailable') {
    return <Text style={styles.hint}>Las cuentas no están disponibles por ahora (sin conexión o en mantenimiento). Podés seguir mirando.</Text>
  }

  if (status === 'in' && user) {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{(user.name || user.email).trim().charAt(0).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{user.name || 'Mi cuenta'}</Text>
            <Text style={styles.hint}>{user.email}</Text>
          </View>
        </View>
        {!user.emailVerified && <Text style={[styles.hint, { color: colors.gold }]}>Confirmá tu mail desde el enlace que te enviamos para poder publicar en la comunidad.</Text>}
        <FocusPressable onPress={() => Linking.openURL(`${SITE_URL}/comunidad`)} style={styles.link}>
          <Ionicons name="people-outline" size={18} color={colors.gold} />
          <Text style={styles.linkText}>Comunidad: listas, opiniones y avisos (en la web)</Text>
        </FocusPressable>
        <FocusPressable onPress={() => void logout()} style={styles.secondary} accessibilityLabel="Cerrar sesión">
          <Text style={styles.secondaryText}>Cerrar sesión</Text>
        </FocusPressable>
      </View>
    )
  }

  const submit = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    const err = mode === 'login' ? await login(email, password) : await register(email, password, name)
    setBusy(false)
    if (err) setError(err)
  }
  const disabled = busy || !email || !password

  return (
    <View style={styles.card}>
      {!!reason && <Text style={styles.reason}>{reason}</Text>}
      <Text style={styles.title}>{mode === 'login' ? 'Ingresar' : 'Crear cuenta gratis'}</Text>
      <Text style={styles.hint}>Con tu cuenta se desbloquean los títulos más populares y calificados, y la comunidad. Mirar el resto sigue siendo libre.</Text>
      {mode === 'register' && (
        <TextInput value={name} onChangeText={setName} placeholder="Tu nombre (opcional)" placeholderTextColor={colors.muted} style={styles.input} autoCapitalize="words" maxLength={60} />
      )}
      <TextInput
        value={email} onChangeText={setEmail} placeholder="Mail" placeholderTextColor={colors.muted} style={styles.input}
        autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" autoComplete="email"
      />
      <TextInput
        value={password} onChangeText={setPassword} placeholder="Contraseña (mínimo 8 caracteres)" placeholderTextColor={colors.muted} style={styles.input}
        secureTextEntry autoCapitalize="none" textContentType={mode === 'login' ? 'password' : 'newPassword'}
        autoComplete={mode === 'login' ? 'password' : 'new-password'} onSubmitEditing={submit}
      />
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <FocusPressable onPress={submit} disabled={disabled} style={[styles.primary, disabled && { opacity: 0.5 }]}>
        {busy ? <ActivityIndicator color={colors.void} /> : <Text style={styles.primaryText}>{mode === 'login' ? 'Ingresar' : 'Crear mi cuenta'}</Text>}
      </FocusPressable>
      <FocusPressable onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null) }} style={styles.link}>
        <Text style={styles.linkText}>{mode === 'login' ? '¿No tenés cuenta? Crear una' : '¿Ya tenés cuenta? Ingresar'}</Text>
      </FocusPressable>
      <FocusPressable onPress={() => Linking.openURL(`${SITE_URL}/cuenta`)} style={styles.link}>
        <Text style={styles.hint}>¿Entrás con Google o olvidaste tu contraseña? Hacelo desde la web</Text>
      </FocusPressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 10, borderWidth: 2, borderColor: 'transparent' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.void, fontWeight: '800', fontSize: 18 },
  title: { color: colors.chalk, fontSize: 17, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  reason: { color: colors.gold, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  input: { backgroundColor: colors.card, color: colors.chalk, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  error: { color: colors.red, fontSize: 13 },
  primary: { backgroundColor: colors.gold, borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center' },
  primaryText: { color: colors.void, fontWeight: '800', fontSize: 15 },
  secondary: { borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: colors.chalk, fontWeight: '700', fontSize: 14 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  linkText: { color: colors.gold, fontSize: 13, fontWeight: '600' },
})
