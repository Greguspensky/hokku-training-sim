'use client'

import React, { useState } from 'react'
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'

/**
 * AudioTagsReference Component
 *
 * Displays ElevenLabs v3 audio tags for emotional TTS delivery.
 * Managers can click to copy tags and paste them into recommendation questions.
 *
 * Supported by: eleven_turbo_v2_5, eleven_multilingual_v2 models
 */

interface AudioTagsReferenceProps {
  className?: string
  defaultExpanded?: boolean
}

interface TagCategory {
  name: string
  description: string
  tags: string[]
  color: string
}

const TAG_CATEGORIES: TagCategory[] = [
  {
    name: 'Emotions',
    description: 'Control emotional delivery of speech',
    tags: [
      '[sad]', '[happy]', '[excited]', '[frustrated]', '[angry]',
      '[cheerful]', '[cautious]', '[indecisive]', '[elated]',
      '[sympathetic]', '[professional]', '[reassuring]', '[panicking]',
      '[mischievous]', '[sarcastic]', '[curious]', '[crying]'
    ],
    color: 'bg-purple-100 text-purple-700 hover:bg-purple-200'
  },
  {
    name: 'Vocal Expressions',
    description: 'Add vocal sounds and expressions',
    tags: [
      '[laughs]', '[laughing]', '[giggles]', '[sighs]', '[exhales]',
      '[whispers]', '[shouting]', '[groaning]', '[stuttering]'
    ],
    color: 'bg-blue-100 text-blue-700 hover:bg-blue-200'
  },
  {
    name: 'Training-Specific',
    description: 'Delivery styles for training scenarios',
    tags: [
      '[confident]', '[nervous]', '[impatient]', '[apologetic]',
      '[dismissive]', '[empathetic]'
    ],
    color: 'bg-green-100 text-green-700 hover:bg-green-200'
  },
  {
    name: 'Pacing & Control',
    description: 'Control speech timing and pace',
    tags: ['[pause]', '[slow]', '[fast]'],
    color: 'bg-orange-100 text-orange-700 hover:bg-orange-200'
  }
]

export function AudioTagsReference({
  className = '',
  defaultExpanded = true
}: AudioTagsReferenceProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [copiedTag, setCopiedTag] = useState<string | null>(null)

  const copyToClipboard = async (tag: string) => {
    try {
      await navigator.clipboard.writeText(tag)
      setCopiedTag(tag)

      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopiedTag(null)
      }, 2000)
    } catch (err) {
      console.error('Failed to copy tag:', err)
    }
  }

  return (
    <div className={`bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg ${className}`}>
      {/* Header - Always visible */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">📢</span>
          <div>
            <h4 className="font-semibold text-gray-900">
              Audio Tags for Emotional TTS Delivery
            </h4>
            <p className="text-sm text-gray-600">
              Click tags to copy, then paste into your questions for emotional voice control
            </p>
          </div>
        </div>
        <button
          className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-600" />
          )}
        </button>
      </div>

      {/* Tag Categories - Collapsible */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Usage Example */}
          <div className="bg-white/60 rounded-lg p-3 border border-purple-200">
            <p className="text-sm text-gray-700">
              <strong>Example:</strong> <span className="font-mono text-purple-700">[excited] Have you tried our seasonal special? [pause] [curious] What flavors do you enjoy?</span>
            </p>
          </div>

          {/* Tag Categories */}
          {TAG_CATEGORIES.map((category) => (
            <div key={category.name} className="space-y-2">
              <div className="flex items-center gap-2">
                <h5 className="font-semibold text-gray-900 text-sm">
                  {category.name}
                </h5>
                <span className="text-xs text-gray-500">
                  ({category.tags.length} tags)
                </span>
              </div>
              <p className="text-xs text-gray-600 mb-2">
                {category.description}
              </p>

              <div className="flex flex-wrap gap-2">
                {category.tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={(e) => {
                      e.stopPropagation()
                      copyToClipboard(tag)
                    }}
                    className={`
                      px-3 py-1.5 rounded-md text-sm font-mono font-medium
                      transition-all duration-200 transform active:scale-95
                      flex items-center gap-1.5
                      ${category.color}
                      ${copiedTag === tag ? 'ring-2 ring-green-500' : ''}
                    `}
                    title={`Click to copy ${tag}`}
                  >
                    {tag}
                    {copiedTag === tag ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3 opacity-50" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Footer Note */}
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 mt-4">
            <p className="text-xs text-blue-800">
              <strong>💡 Tip:</strong> Audio tags work with <span className="font-mono">eleven_v3</span> model (alpha).
              You can combine multiple tags in a single question for progressive emotional changes.
              Tags are hidden from display but control TTS delivery.
            </p>
          </div>

          {/* Copied Notification */}
          {copiedTag && (
            <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-slide-up z-50">
              <Check className="w-4 h-4" />
              <span className="font-medium">Copied {copiedTag}!</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
