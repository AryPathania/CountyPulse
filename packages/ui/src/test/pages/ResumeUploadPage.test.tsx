import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../../lib/queryClient'
import { ResumeUploadPage } from '../../pages/ResumeUploadPage'

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock useAuth
vi.mock('../../components/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}))

// Mock resume upload service
const mockUploadAndParse = vi.fn()
vi.mock('../../services/resume-upload', () => ({
  uploadAndParseResume: (...args: unknown[]) => mockUploadAndParse(...args),
}))

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ResumeUploadPage />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('ResumeUploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
  })

  it('renders the upload page', () => {
    renderPage()
    expect(screen.getByTestId('resume-upload-page')).toBeInTheDocument()
    expect(screen.getByText('Upload Your Resume')).toBeInTheDocument()
  })

  it('shows file dropzone in initial state', () => {
    renderPage()
    expect(screen.getByTestId('upload-dropzone')).toBeInTheDocument()
    expect(screen.getByTestId('file-input')).toBeInTheDocument()
    expect(screen.getByText(/Choose PDF file/)).toBeInTheDocument()
  })

  it('displays subtitle text', () => {
    renderPage()
    expect(
      screen.getByText(/Upload a PDF resume and Odie will extract/)
    ).toBeInTheDocument()
  })

  it('shows error for files over 10MB', async () => {
    renderPage()

    const input = screen.getByTestId('file-input')
    const bigFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'big.pdf', {
      type: 'application/pdf',
    })

    await userEvent.upload(input, bigFile)

    await waitFor(() => {
      expect(screen.getByTestId('upload-error')).toHaveTextContent('File must be under 10MB')
    })
  })

  it('shows error for non-PDF files', async () => {
    renderPage()

    const input = screen.getByTestId('file-input') as HTMLInputElement
    // Create a non-PDF file and fire change event manually since userEvent.upload
    // does not always preserve file.type in jsdom
    const textFile = new File(['hello'], 'doc.txt', { type: 'text/plain' })
    Object.defineProperty(textFile, 'type', { value: 'text/plain' })

    // Manually fire the change event with the file
    Object.defineProperty(input, 'files', { value: [textFile], writable: true })
    input.dispatchEvent(new Event('change', { bubbles: true }))

    await waitFor(() => {
      expect(screen.getByTestId('upload-error')).toHaveTextContent('Please upload a PDF file')
    })
  })

  it('shows progress indicator during upload', async () => {
    // Make the upload hang so we can observe the progress state
    mockUploadAndParse.mockReturnValue(new Promise(() => {}))

    renderPage()

    const input = screen.getByTestId('file-input')
    const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })

    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(screen.getByTestId('upload-progress')).toBeInTheDocument()
    })

    expect(screen.getByText('resume.pdf')).toBeInTheDocument()
  })

  it('shows results after successful upload', async () => {
    mockUploadAndParse.mockResolvedValue({
      uploadedResumeId: 'resume-1',
      parsedData: {},
      context: { mode: 'resume' },
      stats: {
        strongBullets: 5,
        fixableBullets: 3,
        weakBullets: 2,
        positions: 2,
      },
    })

    renderPage()

    const input = screen.getByTestId('file-input')
    const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })

    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(screen.getByTestId('upload-results')).toBeInTheDocument()
    })

    expect(screen.getByText('Resume Analyzed')).toBeInTheDocument()
    // Check stat labels are present
    expect(screen.getByText('Positions')).toBeInTheDocument()
    expect(screen.getByText('Strong bullets')).toBeInTheDocument()
    expect(screen.getByText('Auto-fixed')).toBeInTheDocument()
    expect(screen.getByText('To discuss')).toBeInTheDocument()

    // Check stat values using getAllByText since some values may appear multiple times
    const statValues = screen.getAllByText(/^[0-9]+$/)
    const values = statValues.map(el => el.textContent)
    expect(values).toContain('5')
    expect(values).toContain('3')
    expect(values).toContain('2')
  })

  it('navigates to interview on Start Interview click', async () => {
    const mockResult = {
      uploadedResumeId: 'resume-1',
      parsedData: {},
      context: { mode: 'resume' },
      stats: { strongBullets: 1, fixableBullets: 0, weakBullets: 0, positions: 1 },
    }
    mockUploadAndParse.mockResolvedValue(mockResult)

    renderPage()

    const input = screen.getByTestId('file-input')
    const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })
    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(screen.getByTestId('start-interview-btn')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByTestId('start-interview-btn'))

    expect(mockNavigate).toHaveBeenCalledWith('/interview', {
      state: { interviewContext: mockResult.context },
    })
  })

  it('navigates to bullets library on View Bullets Library click', async () => {
    mockUploadAndParse.mockResolvedValue({
      uploadedResumeId: 'resume-1',
      parsedData: {},
      context: { mode: 'resume' },
      stats: { strongBullets: 1, fixableBullets: 0, weakBullets: 0, positions: 1 },
    })

    renderPage()

    const input = screen.getByTestId('file-input')
    const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })
    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(screen.getByText('View Bullets Library')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('View Bullets Library'))

    expect(mockNavigate).toHaveBeenCalledWith('/bullets')
  })

  it('shows error and returns to select state on upload failure', async () => {
    mockUploadAndParse.mockRejectedValue(new Error('Network error'))

    renderPage()

    const input = screen.getByTestId('file-input')
    const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })
    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(screen.getByTestId('upload-error')).toHaveTextContent('Network error')
    })

    // Should show dropzone again (back to select state)
    expect(screen.getByTestId('upload-dropzone')).toBeInTheDocument()
  })

  it('shows generic error message for non-Error exceptions', async () => {
    mockUploadAndParse.mockRejectedValue('something went wrong')

    renderPage()

    const input = screen.getByTestId('file-input')
    const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' })
    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(screen.getByTestId('upload-error')).toHaveTextContent('Upload failed')
    })
  })
})
