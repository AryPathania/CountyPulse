import { useNavigate } from 'react-router-dom'

interface StartInterviewButtonProps {
  context: { mode: string; [key: string]: unknown }
  label?: string
  variant?: 'primary' | 'secondary'
  className?: string
  disabled?: boolean
  'data-testid'?: string
}

export function StartInterviewButton({
  context,
  label = 'Start Interview',
  variant = 'primary',
  className,
  disabled,
  'data-testid': testId = 'start-interview-btn',
}: StartInterviewButtonProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate('/interview', { state: { interviewContext: context } })
  }

  return (
    <button
      onClick={handleClick}
      className={className ?? `btn-${variant}`}
      data-testid={testId}
      disabled={disabled}
    >
      {label}
    </button>
  )
}
