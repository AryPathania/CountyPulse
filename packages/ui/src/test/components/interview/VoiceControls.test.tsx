import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VoiceControls, type VoiceControlsProps } from '../../../components/interview/VoiceControls'

describe('VoiceControls', () => {
  const defaultProps: VoiceControlsProps = {
    inputEnabled: false,
    outputEnabled: false,
    voice: 'nova',
    isRecording: false,
    onInputToggle: vi.fn(),
    onOutputToggle: vi.fn(),
    onVoiceChange: vi.fn(),
    onMicClick: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders all controls with correct test IDs', () => {
      render(<VoiceControls {...defaultProps} />)

      expect(screen.getByTestId('voice-controls')).toBeInTheDocument()
      expect(screen.getByTestId('voice-input-toggle')).toBeInTheDocument()
      expect(screen.getByTestId('voice-output-toggle')).toBeInTheDocument()
      expect(screen.getByTestId('voice-picker')).toBeInTheDocument()
    })

    it('renders voice input toggle with correct label', () => {
      render(<VoiceControls {...defaultProps} />)

      const toggle = screen.getByTestId('voice-input-toggle')
      expect(toggle).toHaveTextContent('Voice In')
      expect(toggle).toHaveAttribute('title', 'Toggle voice input')
    })

    it('renders voice output toggle with correct label', () => {
      render(<VoiceControls {...defaultProps} />)

      const toggle = screen.getByTestId('voice-output-toggle')
      expect(toggle).toHaveTextContent('Voice Out')
      expect(toggle).toHaveAttribute('title', 'Toggle voice output')
    })

    it('renders voice picker with all available voices', () => {
      render(<VoiceControls {...defaultProps} />)

      const picker = screen.getByTestId('voice-picker')
      expect(picker).toBeInTheDocument()

      // Check all voices are available
      const options = picker.querySelectorAll('option')
      expect(options).toHaveLength(6)

      const voiceNames = Array.from(options).map((opt) => opt.textContent)
      expect(voiceNames).toContain('Alloy')
      expect(voiceNames).toContain('Echo')
      expect(voiceNames).toContain('Fable')
      expect(voiceNames).toContain('Onyx')
      expect(voiceNames).toContain('Nova')
      expect(voiceNames).toContain('Shimmer')
    })
  })

  describe('input toggle state', () => {
    it('shows inactive state when inputEnabled is false', () => {
      render(<VoiceControls {...defaultProps} inputEnabled={false} />)

      const toggle = screen.getByTestId('voice-input-toggle')
      expect(toggle).toHaveAttribute('aria-pressed', 'false')
      expect(toggle).not.toHaveClass('active')
    })

    it('shows active state when inputEnabled is true', () => {
      render(<VoiceControls {...defaultProps} inputEnabled={true} />)

      const toggle = screen.getByTestId('voice-input-toggle')
      expect(toggle).toHaveAttribute('aria-pressed', 'true')
      expect(toggle).toHaveClass('active')
    })
  })

  describe('output toggle state', () => {
    it('shows inactive state when outputEnabled is false', () => {
      render(<VoiceControls {...defaultProps} outputEnabled={false} />)

      const toggle = screen.getByTestId('voice-output-toggle')
      expect(toggle).toHaveAttribute('aria-pressed', 'false')
      expect(toggle).not.toHaveClass('active')
    })

    it('shows active state when outputEnabled is true', () => {
      render(<VoiceControls {...defaultProps} outputEnabled={true} />)

      const toggle = screen.getByTestId('voice-output-toggle')
      expect(toggle).toHaveAttribute('aria-pressed', 'true')
      expect(toggle).toHaveClass('active')
    })
  })

  describe('voice picker', () => {
    it('shows current voice selected', () => {
      render(<VoiceControls {...defaultProps} voice="nova" />)

      const picker = screen.getByTestId('voice-picker') as HTMLSelectElement
      expect(picker.value).toBe('nova')
    })

    it('shows different voice when specified', () => {
      render(<VoiceControls {...defaultProps} voice="shimmer" />)

      const picker = screen.getByTestId('voice-picker') as HTMLSelectElement
      expect(picker.value).toBe('shimmer')
    })

    it('is disabled when output is not enabled', () => {
      render(<VoiceControls {...defaultProps} outputEnabled={false} />)

      const picker = screen.getByTestId('voice-picker')
      expect(picker).toBeDisabled()
    })

    it('is enabled when output is enabled', () => {
      render(<VoiceControls {...defaultProps} outputEnabled={true} />)

      const picker = screen.getByTestId('voice-picker')
      expect(picker).not.toBeDisabled()
    })
  })

  describe('mic button', () => {
    it('does not render mic button when input is disabled', () => {
      render(<VoiceControls {...defaultProps} inputEnabled={false} />)

      expect(screen.queryByTestId('mic-button')).not.toBeInTheDocument()
    })

    it('renders mic button when input is enabled', () => {
      render(<VoiceControls {...defaultProps} inputEnabled={true} />)

      expect(screen.getByTestId('mic-button')).toBeInTheDocument()
    })

    it('shows "Start recording" aria-label when not recording', () => {
      render(<VoiceControls {...defaultProps} inputEnabled={true} isRecording={false} />)

      const micButton = screen.getByTestId('mic-button')
      expect(micButton).toHaveAttribute('aria-label', 'Start recording')
    })

    it('shows "Stop recording" aria-label when recording', () => {
      render(<VoiceControls {...defaultProps} inputEnabled={true} isRecording={true} />)

      const micButton = screen.getByTestId('mic-button')
      expect(micButton).toHaveAttribute('aria-label', 'Stop recording')
    })

    it('has recording class when recording', () => {
      render(<VoiceControls {...defaultProps} inputEnabled={true} isRecording={true} />)

      const micButton = screen.getByTestId('mic-button')
      expect(micButton).toHaveClass('recording')
    })

    it('does not have recording class when not recording', () => {
      render(<VoiceControls {...defaultProps} inputEnabled={true} isRecording={false} />)

      const micButton = screen.getByTestId('mic-button')
      expect(micButton).not.toHaveClass('recording')
    })
  })

  describe('recording indicator', () => {
    it('does not show recording indicator when not recording', () => {
      render(<VoiceControls {...defaultProps} inputEnabled={true} isRecording={false} />)

      expect(screen.queryByTestId('recording-indicator')).not.toBeInTheDocument()
    })

    it('shows recording indicator when recording', () => {
      render(<VoiceControls {...defaultProps} inputEnabled={true} isRecording={true} />)

      expect(screen.getByTestId('recording-indicator')).toBeInTheDocument()
    })
  })

  describe('click handlers', () => {
    it('calls onInputToggle when input toggle is clicked', async () => {
      const onInputToggle = vi.fn()
      render(<VoiceControls {...defaultProps} onInputToggle={onInputToggle} />)

      await userEvent.click(screen.getByTestId('voice-input-toggle'))

      expect(onInputToggle).toHaveBeenCalledOnce()
    })

    it('calls onOutputToggle when output toggle is clicked', async () => {
      const onOutputToggle = vi.fn()
      render(<VoiceControls {...defaultProps} onOutputToggle={onOutputToggle} />)

      await userEvent.click(screen.getByTestId('voice-output-toggle'))

      expect(onOutputToggle).toHaveBeenCalledOnce()
    })

    it('calls onVoiceChange when voice is changed', async () => {
      const onVoiceChange = vi.fn()
      render(<VoiceControls {...defaultProps} outputEnabled={true} onVoiceChange={onVoiceChange} />)

      const picker = screen.getByTestId('voice-picker')
      await userEvent.selectOptions(picker, 'echo')

      expect(onVoiceChange).toHaveBeenCalledWith('echo')
    })

    it('calls onMicClick when mic button is clicked', async () => {
      const onMicClick = vi.fn()
      render(<VoiceControls {...defaultProps} inputEnabled={true} onMicClick={onMicClick} />)

      await userEvent.click(screen.getByTestId('mic-button'))

      expect(onMicClick).toHaveBeenCalledOnce()
    })
  })

  describe('accessibility', () => {
    it('has accessible name for voice picker', () => {
      render(<VoiceControls {...defaultProps} />)

      const picker = screen.getByLabelText('Select voice')
      expect(picker).toBeInTheDocument()
    })

    it('input toggle has button type', () => {
      render(<VoiceControls {...defaultProps} />)

      const toggle = screen.getByTestId('voice-input-toggle')
      expect(toggle).toHaveAttribute('type', 'button')
    })

    it('output toggle has button type', () => {
      render(<VoiceControls {...defaultProps} />)

      const toggle = screen.getByTestId('voice-output-toggle')
      expect(toggle).toHaveAttribute('type', 'button')
    })

    it('mic button has button type', () => {
      render(<VoiceControls {...defaultProps} inputEnabled={true} />)

      const micButton = screen.getByTestId('mic-button')
      expect(micButton).toHaveAttribute('type', 'button')
    })
  })

  describe('voice selection', () => {
    it('can select alloy voice', async () => {
      const onVoiceChange = vi.fn()
      render(<VoiceControls {...defaultProps} outputEnabled={true} onVoiceChange={onVoiceChange} />)

      await userEvent.selectOptions(screen.getByTestId('voice-picker'), 'alloy')
      expect(onVoiceChange).toHaveBeenCalledWith('alloy')
    })

    it('can select echo voice', async () => {
      const onVoiceChange = vi.fn()
      render(<VoiceControls {...defaultProps} outputEnabled={true} onVoiceChange={onVoiceChange} />)

      await userEvent.selectOptions(screen.getByTestId('voice-picker'), 'echo')
      expect(onVoiceChange).toHaveBeenCalledWith('echo')
    })

    it('can select fable voice', async () => {
      const onVoiceChange = vi.fn()
      render(<VoiceControls {...defaultProps} outputEnabled={true} onVoiceChange={onVoiceChange} />)

      await userEvent.selectOptions(screen.getByTestId('voice-picker'), 'fable')
      expect(onVoiceChange).toHaveBeenCalledWith('fable')
    })

    it('can select onyx voice', async () => {
      const onVoiceChange = vi.fn()
      render(<VoiceControls {...defaultProps} outputEnabled={true} onVoiceChange={onVoiceChange} />)

      await userEvent.selectOptions(screen.getByTestId('voice-picker'), 'onyx')
      expect(onVoiceChange).toHaveBeenCalledWith('onyx')
    })

    it('can select shimmer voice', async () => {
      const onVoiceChange = vi.fn()
      render(<VoiceControls {...defaultProps} outputEnabled={true} onVoiceChange={onVoiceChange} />)

      await userEvent.selectOptions(screen.getByTestId('voice-picker'), 'shimmer')
      expect(onVoiceChange).toHaveBeenCalledWith('shimmer')
    })
  })
})
