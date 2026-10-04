import AsyncStorage from '@react-native-async-storage/async-storage'

export const getItem = async (key: string): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(key)
  } catch {
    return null
  }
}

export const setItem = async (key: string, value: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, value)
  } catch {
    // almacenamiento no disponible: la app sigue funcionando sin persistir
  }
}
