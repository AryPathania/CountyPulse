import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'voice-settings'

export interface VoiceSettings {
  inputEnabled: boolean
  outputEnabled: boolean
  voice: string
}

export interface UseVoiceSettingsReturn {
  settings: VoiceSettings
  setInputEnabled: (enabled: boolean) => void
  setOutputEnabled: (enabled: boolean) => void
  setVoice: (voice: string) => void
}

const DEFAULT_SETTINGS: VoiceSettings = {
  inputEnabled: false,
  outputEnabled: false,
  voice: 'nova',
}

/**
 * Hook for persisting voice preferences to localStorage.
 */
export function useVoiceSettings(): UseVoiceSettingsReturn {
  const [settings, setSettings] = useState<VoiceSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        return {
          inputEnabled: parsed.inputEnabled ?? DEFAULT_SETTINGS.inputEnabled,
          outputEnabled: parsed.outputEnabled ?? DEFAULT_SETTINGS.outputEnabled,
          voice: parsed.voice ?? DEFAULT_SETTINGS.voice,
        }
      }
    } catch {
      // Ignore localStorage errors
    }
    return DEFAULT_SETTINGS
  })

  // Persist to localStorage whenever settings change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // Ignore localStorage errors
    }
  }, [settings])

  const setInputEnabled = useCallback((enabled: boolean) => {
    setSettings((prev) => ({ ...prev, inputEnabled: enabled }))
  }, [])

  const setOutputEnabled = useCallback((enabled: boolean) => {
    setSettings((prev) => ({ ...prev, outputEnabled: enabled }))
  }, [])

  const setVoice = useCallback((voice: string) => {
    setSettings((prev) => ({ ...prev, voice }))
  }, [])

  return {
    settings,
    setInputEnabled,
    setOutputEnabled,
    setVoice,
  }
}
