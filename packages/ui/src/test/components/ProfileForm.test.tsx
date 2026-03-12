import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileForm } from '../../components/ProfileForm'
import type { ProfileFormData } from '@odie/shared'

const EMAIL = 'alice@example.com'

const baseData: ProfileFormData = {
  displayName: 'Alice Smith',
  headline: 'Software Engineer',
  summary: 'I build things.',
  phone: '555-1234',
  location: 'New York, NY',
  links: [],
}

describe('ProfileForm', () => {
  let onSave: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onSave = vi.fn().mockResolvedValue(undefined)
  })

  it('renders all fields with initial data', () => {
    render(<ProfileForm initialData={baseData} email={EMAIL} onSave={onSave} />)

    expect(screen.getByTestId('input-display-name')).toHaveValue('Alice Smith')
    expect(screen.getByTestId('input-email')).toHaveValue(EMAIL)
    expect(screen.getByTestId('input-headline')).toHaveValue('Software Engineer')
    expect(screen.getByTestId('input-summary')).toHaveValue('I build things.')
    expect(screen.getByTestId('input-phone')).toHaveValue('555-1234')
    expect(screen.getByTestId('input-location')).toHaveValue('New York, NY')
  })

  it('email field is read-only and not editable', async () => {
    const user = userEvent.setup()
    render(<ProfileForm initialData={baseData} email={EMAIL} onSave={onSave} />)

    const emailInput = screen.getByTestId('input-email')
    expect(emailInput).toHaveAttribute('readonly')

    await user.click(emailInput)
    await user.type(emailInput, 'hacker@evil.com')

    expect(emailInput).toHaveValue(EMAIL)
  })

  it('shows predefined quick-add buttons and a Custom button', () => {
    render(<ProfileForm initialData={baseData} email={EMAIL} onSave={onSave} />)

    expect(screen.getByTestId('btn-add-link-LinkedIn')).toBeInTheDocument()
    expect(screen.getByTestId('btn-add-link-GitHub')).toBeInTheDocument()
    expect(screen.getByTestId('btn-add-link-Twitter')).toBeInTheDocument()
    expect(screen.getByTestId('btn-add-link-Website')).toBeInTheDocument()
    expect(screen.getByTestId('btn-add-link-Custom')).toBeInTheDocument()
  })

  it('clicking a predefined button adds a link row with the label pre-filled', async () => {
    const user = userEvent.setup()
    render(<ProfileForm initialData={baseData} email={EMAIL} onSave={onSave} />)

    await user.click(screen.getByTestId('btn-add-link-LinkedIn'))

    expect(screen.getByTestId('input-link-label-0')).toHaveValue('LinkedIn')
    expect(screen.getByTestId('input-link-url-0')).toHaveValue('')
  })

  it('clicking Custom adds a link row with both inputs empty', async () => {
    const user = userEvent.setup()
    render(<ProfileForm initialData={baseData} email={EMAIL} onSave={onSave} />)

    await user.click(screen.getByTestId('btn-add-link-Custom'))

    expect(screen.getByTestId('input-link-label-0')).toHaveValue('')
    expect(screen.getByTestId('input-link-url-0')).toHaveValue('')
  })

  it('delete button removes the link row', async () => {
    const user = userEvent.setup()
    const dataWithLinks: ProfileFormData = {
      ...baseData,
      links: [
        { label: 'GitHub', url: 'https://github.com/alice' },
        { label: 'LinkedIn', url: 'https://linkedin.com/in/alice' },
      ],
    }
    render(<ProfileForm initialData={dataWithLinks} email={EMAIL} onSave={onSave} />)

    expect(screen.getByTestId('input-link-label-0')).toBeInTheDocument()
    expect(screen.getByTestId('input-link-label-1')).toBeInTheDocument()

    await user.click(screen.getByTestId('btn-remove-link-0'))

    expect(screen.queryByTestId('input-link-label-1')).not.toBeInTheDocument()
    // After removing index 0, remaining item is at index 0
    expect(screen.getByTestId('input-link-label-0')).toHaveValue('LinkedIn')
  })

  it('disables quick-add buttons when 8 links exist', async () => {
    const user = userEvent.setup()
    const dataWithMaxLinks: ProfileFormData = {
      ...baseData,
      links: Array.from({ length: 8 }, (_, i) => ({
        label: `Link ${i}`,
        url: `https://example.com/${i}`,
      })),
    }
    render(<ProfileForm initialData={dataWithMaxLinks} email={EMAIL} onSave={onSave} />)

    expect(screen.getByTestId('btn-add-link-LinkedIn')).toBeDisabled()
    expect(screen.getByTestId('btn-add-link-GitHub')).toBeDisabled()
    expect(screen.getByTestId('btn-add-link-Custom')).toBeDisabled()

    // Clicking a disabled button must not add a row
    await user.click(screen.getByTestId('btn-add-link-Custom'))
    expect(screen.queryByTestId('input-link-label-8')).not.toBeInTheDocument()
  })

  it('submit calls onSave with correct ProfileFormData', async () => {
    const user = userEvent.setup()
    render(<ProfileForm initialData={baseData} email={EMAIL} onSave={onSave} />)

    // Change display name
    const nameInput = screen.getByTestId('input-display-name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Bob Jones')

    // Add a link
    await user.click(screen.getByTestId('btn-add-link-GitHub'))
    await user.type(screen.getByTestId('input-link-url-0'), 'https://github.com/bob')

    await user.click(screen.getByTestId('btn-save-profile'))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledOnce()
    })

    const saved = onSave.mock.calls[0][0] as ProfileFormData
    expect(saved.displayName).toBe('Bob Jones')
    expect(saved.links).toHaveLength(1)
    expect(saved.links[0]).toEqual({ label: 'GitHub', url: 'https://github.com/bob' })
  })

  it('shows "Saving…" text on submit button when isSaving is true', () => {
    render(<ProfileForm initialData={baseData} email={EMAIL} isSaving={true} onSave={onSave} />)

    expect(screen.getByTestId('btn-save-profile')).toHaveTextContent('Saving')
    expect(screen.getByTestId('btn-save-profile')).toBeDisabled()
  })

  it('disables submit when displayName is blank', () => {
    const emptyName = { ...baseData, displayName: '' }
    render(<ProfileForm initialData={emptyName} email={EMAIL} onSave={onSave} />)

    expect(screen.getByTestId('btn-save-profile')).toBeDisabled()
  })
})
