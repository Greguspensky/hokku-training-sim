interface HiddenContentProps {
  type: 'title' | 'description' | 'goals' | 'milestones' | 'expected_response'
  showIcon?: boolean
  customPlaceholder?: string
  className?: string
}

/**
 * Surprise Mode Component - Hides sensitive training information until session starts
 *
 * Usage: <HiddenContent type="title" />
 */
export default function HiddenContent({
  type,
  showIcon = true,
  customPlaceholder,
  className = ''
}: HiddenContentProps) {
  const placeholders = {
    title: { icon: '🎭', text: 'Mystery Training Session' },
    description: { icon: '🔒', text: 'Details will be revealed when you start training' },
    goals: { icon: '🎯', text: 'Goals Hidden - Discover During Training' },
    milestones: { icon: '✅', text: 'Milestones will be revealed during training' },
    expected_response: { icon: '💡', text: 'Expected response hidden - Learn as you go' }
  }

  const placeholder = placeholders[type]
  const displayText = customPlaceholder || placeholder.text

  return (
    <span className={`inline-flex items-center gap-2 text-gray-500 italic ${className}`}>
      {showIcon && <span className="text-lg">{placeholder.icon}</span>}
      <span>{displayText}</span>
    </span>
  )
}

/**
 * Wrapper component for blurring entire sections
 */
export function HiddenSection({
  title,
  icon = '🔒',
  message = 'This section will be revealed during your training session',
  className = ''
}: {
  title: string
  icon?: string
  message?: string
  className?: string
}) {
  return (
    <div className={`bg-gray-50 border border-gray-200 rounded-lg p-6 text-center ${className}`}>
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-700 mb-2">{title}</h3>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}
