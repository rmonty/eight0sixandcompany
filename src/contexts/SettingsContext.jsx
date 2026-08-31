import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { defaultSettings } from '../config/defaults'
import { getStoreSettings, updateStoreSettings } from '../services/settingsService'

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaultSettings)
  const [loading, setLoading] = useState(true)

  const refreshSettings = useCallback(async () => {
    setLoading(true)
    const data = await getStoreSettings()
    setSettings(data)
    setLoading(false)
    return data
  }, [])

  useEffect(() => {
    refreshSettings()
  }, [refreshSettings])

  const saveSettings = useCallback(async (updates) => {
    const next = {
      ...settings,
      ...updates,
      shipping: updates.shipping
        ? { ...defaultSettings.shipping, ...(settings.shipping || {}), ...updates.shipping }
        : settings.shipping,
    }
    await updateStoreSettings(next)
    setSettings(next)
    return next
  }, [settings])

  const updateShippingSettings = useCallback(async (patch) => {
    const next = {
      ...settings,
      shipping: { ...defaultSettings.shipping, ...(settings.shipping || {}), ...patch },
    }
    await updateStoreSettings(next)
    setSettings(next)
    return next
  }, [settings])

  const value = useMemo(
    () => ({
      settings,
      loading,
      refreshSettings,
      saveSettings,
      updateShippingSettings,
    }),
    [settings, loading, refreshSettings, saveSettings, updateShippingSettings],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export const useSettings = () => {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider')
  }
  return context
}
