'use client'

import { MessageSquare, AlertTriangle } from 'lucide-react'

interface ManagerSummaryProps {
  summary: string
  overallScore?: number // Optional: used to determine visual styling
}

export default function ManagerSummary({ summary, overallScore }: ManagerSummaryProps) {
  // Determine severity based on overall score or content
  const isCritical = overallScore !== undefined && overallScore < 40
  const isWarning = overallScore !== undefined && overallScore >= 40 && overallScore < 70
  const isPositive = overallScore !== undefined && overallScore >= 70

  // Visual styles based on severity
  const bgGradient = isCritical
    ? 'from-red-50 to-orange-50'
    : isWarning
    ? 'from-yellow-50 to-orange-50'
    : 'from-blue-50 to-indigo-50'

  const borderColor = isCritical
    ? 'border-red-300'
    : isWarning
    ? 'border-yellow-300'
    : 'border-blue-200'

  const iconBgColor = isCritical
    ? 'bg-red-600'
    : isWarning
    ? 'bg-yellow-600'
    : 'bg-blue-600'

  const Icon = isCritical ? AlertTriangle : MessageSquare

  // Helper function to render text with markdown-style formatting
  const renderFormattedText = (text: string) => {
    // Handle bold text: **text** -> <strong>text</strong>
    const boldRegex = /\*\*(.*?)\*\*/g
    const parts = []
    let lastIndex = 0
    let match

    while ((match = boldRegex.exec(text)) !== null) {
      // Add text before the bold part
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index))
      }
      // Add bold part
      parts.push(<strong key={match.index} className="font-semibold">{match[1]}</strong>)
      lastIndex = boldRegex.lastIndex
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }

    return parts.length > 0 ? parts : text
  }

  // Process the summary into structured elements
  const renderContent = () => {
    const lines = summary.split('\n').filter(line => line.trim())
    const elements: React.ReactNode[] = []
    let currentList: string[] = []

    lines.forEach((line, index) => {
      const trimmedLine = line.trim()

      // Check if this is a bullet point
      if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-')) {
        const bulletText = trimmedLine.substring(1).trim()
        currentList.push(bulletText)
      } else {
        // If we were building a list, render it now
        if (currentList.length > 0) {
          elements.push(
            <ul key={`list-${index}`} className="list-disc list-inside space-y-1 my-3 ml-2">
              {currentList.map((item, i) => (
                <li key={i} className="leading-relaxed">
                  {renderFormattedText(item)}
                </li>
              ))}
            </ul>
          )
          currentList = []
        }

        // Render regular paragraph
        elements.push(
          <p key={index} className="mb-3 leading-relaxed">
            {renderFormattedText(trimmedLine)}
          </p>
        )
      }
    })

    // Handle any remaining list items
    if (currentList.length > 0) {
      elements.push(
        <ul key="list-final" className="list-disc list-inside space-y-1 my-3 ml-2">
          {currentList.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderFormattedText(item)}
            </li>
          ))}
        </ul>
      )
    }

    return elements
  }

  return (
    <div className={`bg-gradient-to-r ${bgGradient} border-2 ${borderColor} rounded-lg shadow-md p-6 mb-6`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <div className={`w-12 h-12 ${iconBgColor} rounded-full flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="ml-4 flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Training Manager Feedback
          </h3>
          <div className={`${isCritical ? 'text-red-900 font-medium' : 'text-gray-700'}`}>
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
}
