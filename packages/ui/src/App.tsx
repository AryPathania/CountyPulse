import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './components/auth/AuthProvider'
import { LoginForm } from './components/auth/LoginForm'
import { AuthGuard } from './components/auth/AuthGuard'
import { AccessGuard } from './components/auth/AccessGuard'
import { NoAccessPage } from './pages/NoAccessPage'
import { CompleteProfile } from './pages/CompleteProfile'
import { BulletsPage } from './pages/BulletsPage'
import { InterviewPage } from './pages/InterviewPage'
import { HomePage } from './pages/HomePage'
import { ResumesPage } from './pages/ResumesPage'
import { DraftResumePage } from './pages/DraftResumePage'
import { ResumeBuilderPage } from './pages/ResumeBuilderPage'
import { TelemetryPage } from './pages/TelemetryPage'
import { SettingsPage } from './pages/SettingsPage'
import { ProfilePage } from './pages/ProfilePage'
import { ResumeUploadPage } from './pages/ResumeUploadPage'
import './App.css'

function AuthenticatedApp() {
  return (
    <Router>
      <Routes>
        {/* Auth-required, access-exempt (must be outside AccessGuard to avoid redirect loop) */}
        <Route path="/no-access" element={
          <AuthGuard fallback={<LoginForm />}>
            <NoAccessPage />
          </AuthGuard>
        } />

        {/* Profile completion - accessible to authenticated beta users */}
        <Route path="/complete-profile" element={
          <AuthGuard fallback={<LoginForm />}>
            <AccessGuard>
              <CompleteProfile />
            </AccessGuard>
          </AuthGuard>
        } />

        {/* Bullets Library */}
        <Route path="/bullets" element={
          <AuthGuard fallback={<LoginForm />}>
            <AccessGuard>
              <BulletsPage />
            </AccessGuard>
          </AuthGuard>
        } />

        {/* Interview Flow */}
        <Route path="/interview" element={
          <AuthGuard fallback={<LoginForm />}>
            <AccessGuard>
              <InterviewPage />
            </AccessGuard>
          </AuthGuard>
        } />

        {/* Resumes List */}
        <Route path="/resumes" element={
          <AuthGuard fallback={<LoginForm />}>
            <AccessGuard>
              <ResumesPage />
            </AccessGuard>
          </AuthGuard>
        } />

        {/* Resume Builder */}
        <Route path="/resumes/:id/edit" element={
          <AuthGuard fallback={<LoginForm />}>
            <AccessGuard>
              <ResumeBuilderPage />
            </AccessGuard>
          </AuthGuard>
        } />

        {/* Draft Resume / Resume View */}
        <Route path="/resumes/:id" element={
          <AuthGuard fallback={<LoginForm />}>
            <AccessGuard>
              <DraftResumePage />
            </AccessGuard>
          </AuthGuard>
        } />

        {/* Telemetry Dashboard */}
        <Route path="/telemetry" element={
          <AuthGuard fallback={<LoginForm />}>
            <AccessGuard>
              <TelemetryPage />
            </AccessGuard>
          </AuthGuard>
        } />

        {/* Profile */}
        <Route path="/profile" element={
          <AuthGuard fallback={<LoginForm />}>
            <AccessGuard>
              <ProfilePage />
            </AccessGuard>
          </AuthGuard>
        } />

        {/* Settings */}
        <Route path="/settings" element={
          <AuthGuard fallback={<LoginForm />}>
            <AccessGuard>
              <SettingsPage />
            </AccessGuard>
          </AuthGuard>
        } />

        {/* Resume Upload */}
        <Route path="/upload-resume" element={
          <AuthGuard fallback={<LoginForm />}>
            <AccessGuard>
              <ResumeUploadPage />
            </AccessGuard>
          </AuthGuard>
        } />

        {/* Home - JD paste interface */}
        <Route path="/" element={
          <AuthGuard fallback={<LoginForm />}>
            <AccessGuard>
              <HomePage />
            </AccessGuard>
          </AuthGuard>
        } />
      </Routes>
    </Router>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
