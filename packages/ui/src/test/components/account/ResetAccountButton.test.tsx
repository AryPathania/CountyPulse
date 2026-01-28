import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ResetAccountButton } from '../../../components/account/ResetAccountButton'

const mockMutateAsync = vi.fn()

vi.mock('../../../queries/account', () => ({
  useResetAccountData: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}))

vi.mock('../../../components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'user-123', email: 'test@example.com' },
  }),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('ResetAccountButton', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the button initially', () => {
    render(<ResetAccountButton />, { wrapper: createWrapper() })

    expect(screen.getByTestId('reset-account-button')).toBeInTheDocument()
    expect(screen.getByText('Reset Account Data')).toBeInTheDocument()
  })

  it('should expand to show confirmation panel when clicked', async () => {
    render(<ResetAccountButton />, { wrapper: createWrapper() })

    const button = screen.getByTestId('reset-account-button')
    await user.click(button)

    expect(screen.getByTestId('reset-account-panel')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
    expect(screen.getByText(/This will permanently delete/)).toBeInTheDocument()
  })

  it('should display warning list of what will be deleted', async () => {
    render(<ResetAccountButton />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('reset-account-button'))

    expect(screen.getByText('All resumes')).toBeInTheDocument()
    expect(screen.getByText('All bullets')).toBeInTheDocument()
    expect(screen.getByText('All positions')).toBeInTheDocument()
    expect(screen.getByText('All interview history')).toBeInTheDocument()
    expect(screen.getByText('All telemetry data')).toBeInTheDocument()
  })

  it('should show confirm input field', async () => {
    render(<ResetAccountButton />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('reset-account-button'))

    expect(screen.getByTestId('reset-confirm-input')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Type RESET')).toBeInTheDocument()
  })

  it('should disable confirm button until RESET is typed', async () => {
    render(<ResetAccountButton />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('reset-account-button'))

    const confirmButton = screen.getByTestId('reset-confirm-button')
    expect(confirmButton).toBeDisabled()

    const input = screen.getByTestId('reset-confirm-input')
    await user.type(input, 'RES')

    expect(confirmButton).toBeDisabled()

    await user.type(input, 'ET')

    expect(confirmButton).not.toBeDisabled()
  })

  it('should call mutation when confirmed', async () => {
    mockMutateAsync.mockResolvedValue(undefined)

    render(<ResetAccountButton />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('reset-account-button'))

    const input = screen.getByTestId('reset-confirm-input')
    await user.type(input, 'RESET')

    const confirmButton = screen.getByTestId('reset-confirm-button')
    await user.click(confirmButton)

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith('user-123')
    })
  })

  it('should collapse panel and reset state after successful reset', async () => {
    mockMutateAsync.mockResolvedValue(undefined)

    render(<ResetAccountButton />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('reset-account-button'))

    const input = screen.getByTestId('reset-confirm-input')
    await user.type(input, 'RESET')

    await user.click(screen.getByTestId('reset-confirm-button'))

    await waitFor(() => {
      expect(screen.queryByTestId('reset-account-panel')).not.toBeInTheDocument()
      expect(screen.getByTestId('reset-account-button')).toBeInTheDocument()
    })
  })

  it('should display error message when mutation fails', async () => {
    mockMutateAsync.mockRejectedValue(new Error('Database error'))

    render(<ResetAccountButton />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('reset-account-button'))

    const input = screen.getByTestId('reset-confirm-input')
    await user.type(input, 'RESET')

    await user.click(screen.getByTestId('reset-confirm-button'))

    await waitFor(() => {
      expect(screen.getByTestId('reset-error')).toBeInTheDocument()
      expect(screen.getByText('Database error')).toBeInTheDocument()
    })
  })

  it('should collapse panel when cancel is clicked', async () => {
    render(<ResetAccountButton />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('reset-account-button'))
    expect(screen.getByTestId('reset-account-panel')).toBeInTheDocument()

    await user.click(screen.getByTestId('reset-cancel-button'))

    expect(screen.queryByTestId('reset-account-panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('reset-account-button')).toBeInTheDocument()
  })

  it('should clear input and error when cancel is clicked', async () => {
    mockMutateAsync.mockRejectedValue(new Error('Test error'))

    render(<ResetAccountButton />, { wrapper: createWrapper() })

    await user.click(screen.getByTestId('reset-account-button'))

    const input = screen.getByTestId('reset-confirm-input')
    await user.type(input, 'RESET')
    await user.click(screen.getByTestId('reset-confirm-button'))

    await waitFor(() => {
      expect(screen.getByTestId('reset-error')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('reset-cancel-button'))

    // Re-open and verify state is cleared
    await user.click(screen.getByTestId('reset-account-button'))

    expect(screen.getByTestId('reset-confirm-input')).toHaveValue('')
    expect(screen.queryByTestId('reset-error')).not.toBeInTheDocument()
  })
})
