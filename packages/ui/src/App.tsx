import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './components/auth/AuthProvider'
import { LoginForm } from './components/auth/LoginForm'
import { AuthGuard } from './components/auth/AuthGuard'
import { CompleteProfile } from './pages/CompleteProfile'
import { BulletsPage } from './pages/BulletsPage'
import { InterviewPage } from './pages/InterviewPage'
import { HomePage } from './pages/HomePage'
import { ResumesPage } from './pages/ResumesPage'
import { DraftResumePage } from './pages/DraftResumePage'
import { ResumeBuilderPage } from './pages/ResumeBuilderPage'
import { TelemetryPage } from './pages/TelemetryPage'
import { SettingsPage } from './pages/SettingsPage'
import './App.css'

function AuthenticatedApp() {
  return (
    <Router>
      <Routes>
        {/* Profile completion - accessible to authenticated users */}
        <Route path="/complete-profile" element={
          <AuthGuard fallback={<LoginForm />}>
            <CompleteProfile />
          </AuthGuard>
        } />

        {/* Bullets Library */}
        <Route path="/bullets" element={
          <AuthGuard fallback={<LoginForm />}>
            <BulletsPage />
          </AuthGuard>
        } />

        {/* Interview Flow */}
        <Route path="/interview" element={
          <AuthGuard fallback={<LoginForm />}>
            <InterviewPage />
          </AuthGuard>
        } />

        {/* Resumes List */}
        <Route path="/resumes" element={
          <AuthGuard fallback={<LoginForm />}>
            <ResumesPage />
          </AuthGuard>
        } />

        {/* Resume Builder */}
        <Route path="/resumes/:id/edit" element={
          <AuthGuard fallback={<LoginForm />}>
            <ResumeBuilderPage />
          </AuthGuard>
        } />

        {/* Draft Resume / Resume View */}
        <Route path="/resumes/:id" element={
          <AuthGuard fallback={<LoginForm />}>
            <DraftResumePage />
          </AuthGuard>
        } />

        {/* Telemetry Dashboard */}
        <Route path="/telemetry" element={
          <AuthGuard fallback={<LoginForm />}>
            <TelemetryPage />
          </AuthGuard>
        } />

        {/* Settings */}
        <Route path="/settings" element={
          <AuthGuard fallback={<LoginForm />}>
            <SettingsPage />
          </AuthGuard>
        } />

        {/* Home - JD paste interface */}
        <Route path="/" element={
          <AuthGuard fallback={<LoginForm />}>
            <HomePage />
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
