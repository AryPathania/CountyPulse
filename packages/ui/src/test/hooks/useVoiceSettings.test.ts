import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVoiceSettings, type VoiceSettings } from '../../hooks/useVoiceSettings'

const STORAGE_KEY = 'voice-settings'

// Use a constant object reference so mock functions maintain the reference
const mockLocalStorage: Record<string, string> = {}

const localStorageMock = {
  getItem: vi.fn((key: string) => mockLocalStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockLocalStorage[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete mockLocalStorage[key]
  }),
  clear: vi.fn(() => {
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key])
  }),
  length: 0,
  key: vi.fn(),
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

describe('useVoiceSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns default settings when localStorage is empty', () => {
    const { result } = renderHook(() => useVoiceSettings())

    expect(result.current.settings).toEqual({
      inputEnabled: false,
      outputEnabled: false,
      voice: 'nova',
    })
  })

  it('loads settings from localStorage on mount', () => {
    const storedSettings: VoiceSettings = {
      inputEnabled: true,
      outputEnabled: true,
      voice: 'alloy',
    }
    mockLocalStorage[STORAGE_KEY] = JSON.stringify(storedSettings)

    const { result } = renderHook(() => useVoiceSettings())

    expect(result.current.settings).toEqual(storedSettings)
    expect(localStorageMock.getItem).toHaveBeenCalledWith(STORAGE_KEY)
  })

  it('setInputEnabled updates state and localStorage', () => {
    const { result } = renderHook(() => useVoiceSettings())

    expect(result.current.settings.inputEnabled).toBe(false)

    act(() => {
      result.current.setInputEnabled(true)
    })

    expect(result.current.settings.inputEnabled).toBe(true)
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.stringContaining('"inputEnabled":true')
    )
  })

  it('setOutputEnabled updates state and localStorage', () => {
    const { result } = renderHook(() => useVoiceSettings())

    expect(result.current.settings.outputEnabled).toBe(false)

    act(() => {
      result.current.setOutputEnabled(true)
    })

    expect(result.current.settings.outputEnabled).toBe(true)
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.stringContaining('"outputEnabled":true')
    )
  })

  it('setVoice updates state and localStorage', () => {
    const { result } = renderHook(() => useVoiceSettings())

    expect(result.current.settings.voice).toBe('nova')

    act(() => {
      result.current.setVoice('shimmer')
    })

    expect(result.current.settings.voice).toBe('shimmer')
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.stringContaining('"voice":"shimmer"')
    )
  })

  it('handles invalid JSON in localStorage gracefully', () => {
    mockLocalStorage[STORAGE_KEY] = 'invalid json {'

    const { result } = renderHook(() => useVoiceSettings())

    // Should fall back to defaults
    expect(result.current.settings).toEqual({
      inputEnabled: false,
      outputEnabled: false,
      voice: 'nova',
    })
  })

  it('handles partial settings in localStorage', () => {
    // Only inputEnabled is stored
    mockLocalStorage[STORAGE_KEY] = JSON.stringify({ inputEnabled: true })

    const { result } = renderHook(() => useVoiceSettings())

    // Should merge with defaults
    expect(result.current.settings).toEqual({
      inputEnabled: true,
      outputEnabled: false, // default
      voice: 'nova', // default
    })
  })

  it('handles null values in stored settings', () => {
    mockLocalStorage[STORAGE_KEY] = JSON.stringify({
      inputEnabled: null,
      outputEnabled: true,
      voice: null,
    })

    const { result } = renderHook(() => useVoiceSettings())

    // null should fall back to defaults
    expect(result.current.settings).toEqual({
      inputEnabled: false, // default for null
      outputEnabled: true,
      voice: 'nova', // default for null
    })
  })

  it('persists multiple setting changes', () => {
    const { result } = renderHook(() => useVoiceSettings())

    act(() => {
      result.current.setInputEnabled(true)
    })

    act(() => {
      result.current.setOutputEnabled(true)
    })

    act(() => {
      result.current.setVoice('echo')
    })

    expect(result.current.settings).toEqual({
      inputEnabled: true,
      outputEnabled: true,
      voice: 'echo',
    })

    // Verify final localStorage state
    const lastCall = localStorageMock.setItem.mock.calls[localStorageMock.setItem.mock.calls.length - 1]
    const storedValue = JSON.parse(lastCall[1])
    expect(storedValue).toEqual({
      inputEnabled: true,
      outputEnabled: true,
      voice: 'echo',
    })
  })

  it('handles localStorage.setItem errors gracefully', () => {
    const setItemError = new Error('QuotaExceededError')
    localStorageMock.setItem = vi.fn(() => {
      throw setItemError
    })

    const { result } = renderHook(() => useVoiceSettings())

    // Should not throw
    expect(() => {
      act(() => {
        result.current.setInputEnabled(true)
      })
    }).not.toThrow()

    // State should still update even if localStorage fails
    expect(result.current.settings.inputEnabled).toBe(true)
  })

  it('handles localStorage.getItem errors gracefully', () => {
    // Save original getItem
    const originalGetItem = localStorageMock.getItem

    localStorageMock.getItem = vi.fn(() => {
      throw new Error('SecurityError')
    })

    // Should not throw and return defaults
    const { result } = renderHook(() => useVoiceSettings())

    expect(result.current.settings).toEqual({
      inputEnabled: false,
      outputEnabled: false,
      voice: 'nova',
    })

    // Restore original getItem
    localStorageMock.getItem = originalGetItem
  })

  it('toggle input off works correctly', () => {
    mockLocalStorage[STORAGE_KEY] = JSON.stringify({
      inputEnabled: true,
      outputEnabled: false,
      voice: 'nova',
    })

    const { result } = renderHook(() => useVoiceSettings())

    expect(result.current.settings.inputEnabled).toBe(true)

    act(() => {
      result.current.setInputEnabled(false)
    })

    expect(result.current.settings.inputEnabled).toBe(false)
  })

  it('toggle output off works correctly', () => {
    mockLocalStorage[STORAGE_KEY] = JSON.stringify({
      inputEnabled: false,
      outputEnabled: true,
      voice: 'nova',
    })

    const { result } = renderHook(() => useVoiceSettings())

    expect(result.current.settings.outputEnabled).toBe(true)

    act(() => {
      result.current.setOutputEnabled(false)
    })

    expect(result.current.settings.outputEnabled).toBe(false)
  })

  it('preserves other settings when updating one', () => {
    mockLocalStorage[STORAGE_KEY] = JSON.stringify({
      inputEnabled: true,
      outputEnabled: true,
      voice: 'alloy',
    })

    const { result } = renderHook(() => useVoiceSettings())

    act(() => {
      result.current.setVoice('fable')
    })

    // inputEnabled and outputEnabled should remain unchanged
    expect(result.current.settings).toEqual({
      inputEnabled: true,
      outputEnabled: true,
      voice: 'fable',
    })
  })
})
