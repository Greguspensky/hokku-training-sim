'use client'

import { User, Bot } from 'lucide-react'
import type { ConversationMessage } from '@/lib/elevenlabs-conversation'

interface SessionTranscriptProps {
  messages: ConversationMessage[]
  className?: string
}

export default function SessionTranscript({ messages, className = '' }: SessionTranscriptProps) {
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  if (messages.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="text-gray-400 text-4xl mb-4">💬</div>
        <p className="text-gray-500">No conversation was recorded in this session.</p>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {messages.map((message, index) => (
        <div
          key={index}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
              message.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-900'
            }`}
          >
            <div className="flex items-center mb-1">
              {message.role === 'user' ? (
                <User className="w-4 h-4 mr-2" />
              ) : (
                <Bot className="w-4 h-4 mr-2" />
              )}
              <span className="text-xs font-medium">
                {message.role === 'user' ? 'You' : 'AI Trainer'}
              </span>
              <span className="text-xs opacity-70 ml-2">
                {formatTimestamp(message.timestamp)}
              </span>
            </div>
            <p className="text-sm leading-relaxed">{message.content}</p>
          </div>
        </div>
      ))}
    </div>
  )
}