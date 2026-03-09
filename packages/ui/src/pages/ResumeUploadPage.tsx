import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Navigation } from '../components/layout'
import { useAuth } from '../components/auth/AuthProvider'
import { uploadAndParseResume, type ResumeUploadResult } from '../services/resume-upload'
import './ResumeUploadPage.css'

type UploadStep = 'select' | 'extracting' | 'analyzing' | 'creating' | 'done'

export function ResumeUploadPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<UploadStep>('select')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ResumeUploadResult | null>(null)
  const [fileName, setFileName] = useState('')

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return

    // Client-side validation
    if (file.size > 10 * 1024 * 1024) {
      setError('File must be under 10MB')
      return
    }

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file')
      return
    }

    setFileName(file.name)
    setError(null)
    setStep('extracting')

    try {
      // Simulate step progression (actual steps happen inside uploadAndParseResume)
      const stepTimer = setTimeout(() => setStep('analyzing'), 2000)
      const stepTimer2 = setTimeout(() => setStep('creating'), 5000)

      const uploadResult = await uploadAndParseResume(user.id, file)

      clearTimeout(stepTimer)
      clearTimeout(stepTimer2)

      setResult(uploadResult)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setStep('select')
    }
  }, [user?.id])

  const handleStartInterview = useCallback(() => {
    if (result) {
      navigate('/interview', { state: { interviewContext: result.context } })
    }
  }, [navigate, result])

  const stepLabels: Record<UploadStep, string> = {
    select: 'Select a file',
    extracting: 'Extracting text from PDF...',
    analyzing: 'Analyzing resume content...',
    creating: 'Creating bullets...',
    done: 'Done!',
  }

  return (
    <div className="resume-upload-page" data-testid="resume-upload-page">
      <Navigation />
      <main className="resume-upload-page__main">
        <h1 className="resume-upload-page__title">Upload Your Resume</h1>
        <p className="resume-upload-page__subtitle">
          Upload a PDF resume and Odie will extract your experience and identify areas to explore
        </p>

        {step === 'select' && (
          <div className="resume-upload-page__dropzone" data-testid="upload-dropzone">
            <label className="resume-upload-page__label">
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                className="resume-upload-page__file-input"
                data-testid="file-input"
              />
              <span className="resume-upload-page__label-text">
                Choose PDF file (max 10MB)
              </span>
            </label>
          </div>
        )}

        {(step === 'extracting' || step === 'analyzing' || step === 'creating') && (
          <div className="resume-upload-page__progress" data-testid="upload-progress">
            <div className="resume-upload-page__spinner" />
            <p className="resume-upload-page__step">{stepLabels[step]}</p>
            <p className="resume-upload-page__filename">{fileName}</p>
          </div>
        )}

        {step === 'done' && result && (
          <div className="resume-upload-page__results" data-testid="upload-results">
            <h2>Resume Analyzed</h2>
            <div className="resume-upload-page__stats">
              <div className="resume-upload-page__stat">
                <span className="resume-upload-page__stat-value">{result.stats.positions}</span>
                <span className="resume-upload-page__stat-label">Positions</span>
              </div>
              <div className="resume-upload-page__stat">
                <span className="resume-upload-page__stat-value">{result.stats.strongBullets}</span>
                <span className="resume-upload-page__stat-label">Strong bullets</span>
              </div>
              <div className="resume-upload-page__stat">
                <span className="resume-upload-page__stat-value">{result.stats.fixableBullets}</span>
                <span className="resume-upload-page__stat-label">Auto-fixed</span>
              </div>
              <div className="resume-upload-page__stat">
                <span className="resume-upload-page__stat-value">{result.stats.weakBullets}</span>
                <span className="resume-upload-page__stat-label">To discuss</span>
              </div>
            </div>
            <button
              onClick={handleStartInterview}
              className="btn-primary"
              data-testid="start-interview-btn"
            >
              Start Interview
            </button>
            <button
              onClick={() => navigate('/bullets')}
              className="btn-secondary"
              style={{ marginTop: '0.5rem' }}
            >
              View Bullets Library
            </button>
          </div>
        )}

        {error && (
          <div className="resume-upload-page__error" data-testid="upload-error">
            {error}
          </div>
        )}
      </main>
    </div>
  )
}
