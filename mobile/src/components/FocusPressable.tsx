import { useState, type ReactNode } from 'react'
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import { colors } from '@/theme'

interface Props extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  focusedStyle?: StyleProp<ViewStyle>
  /** escala al enfocar (control remoto de TV / teclado) */
  focusScale?: number
}

// Pressable con estado de foco visible: imprescindible para el control remoto (D-pad) de TV y para teclado en desktop/web.
export function FocusPressable({ children, style, focusedStyle, focusScale = 1.06, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false)
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      onFocus={(e) => {
        setFocused(true)
        onFocus?.(e)
      }}
      onBlur={(e) => {
        setFocused(false)
        onBlur?.(e)
      }}
      style={[
        style,
        focused && { transform: [{ scale: focusScale }], borderColor: colors.gold, borderWidth: 2 },
        focused && focusedStyle,
      ]}
    >
      {children}
    </Pressable>
  )
}
