'use client'

import { useState, useMemo } from 'react'
import { FileText, Download, Copy, MessageSquare, User, Bot, CheckCircle, XCircle } from 'lucide-react'

interface TranscriptMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string | number
}

interface QAExchange {
  question: string
  answer: string
  questionTimestamp?: number
  answerTimestamp?: number
}

interface TranscriptData {
  success: boolean
  conversationId: string
  transcript: {
    messages?: TranscriptMessage[]
    [key: string]: any
  }
  messageCount: number
  fetchedAt: string
}

export default function TestTranscriptPage() {
  const [conversationId, setConversationId] = useState('conv_1101k5yr5zdefnga05pyaqfd0ffn')
  const [loading, setLoading] = useState(false)
  const [transcriptData, setTranscriptData] = useState<TranscriptData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showRawJson, setShowRawJson] = useState(false)
  const [assessmentData, setAssessmentData] = useState<any>(null)
  const [assessmentLoading, setAssessmentLoading] = useState(false)

  // Extract Q&A pairs from transcript (same logic as assessment API)
  const qaExchanges = useMemo(() => {
    if (!transcriptData?.transcript.messages) return []

    const extractQAPairs = (transcript: TranscriptMessage[]): QAExchange[] => {
      const qaExchanges = []

      for (let i = 0; i < transcript.length - 1; i++) {
        const currentMessage = transcript[i]
        const nextMessage = transcript[i + 1]

        // Look for assistant question followed by user answer
        if (currentMessage.role === 'assistant' && nextMessage.role === 'user') {
          // Filter out very short responses that are likely not real answers
          if (nextMessage.content.trim().length > 10) {
            qaExchanges.push({
              question: currentMessage.content.trim(),
              answer: nextMessage.content.trim(),
              questionTimestamp: typeof currentMessage.timestamp === 'number' ? currentMessage.timestamp : 0,
              answerTimestamp: typeof nextMessage.timestamp === 'number' ? nextMessage.timestamp : 0
            })
          }
        }
      }

      return qaExchanges
    }

    return extractQAPairs(transcriptData.transcript.messages)
  }, [transcriptData])

  const fetchTranscript = async () => {
    if (!conversationId.trim()) {
      setError('Please enter a conversation ID')
      return
    }

    setLoading(true)
    setError(null)
    setTranscriptData(null)

    try {
      const response = await fetch('/api/test-elevenlabs-transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conversationId: conversationId.trim() })
      })

      const data = await response.json()

      if (response.ok) {
        setTranscriptData(data)
        console.log('✅ Transcript fetched successfully:', data)
      } else {
        setError(data.error || 'Failed to fetch transcript')
      }
    } catch (err) {
      console.error('❌ Error fetching transcript:', err)
      setError('Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  const runAssessment = async () => {
    if (!transcriptData?.transcript.messages) {
      setError('No transcript data available for assessment')
      return
    }

    setAssessmentLoading(true)
    setAssessmentData(null)

    try {
      const response = await fetch('/api/assess-theory-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: `test-${Date.now()}`,
          userId: '01f773e2-1027-490e-8d36-279136700bbf',
          transcript: transcriptData.transcript.messages
        })
      })

      const data = await response.json()

      if (response.ok) {
        setAssessmentData(data)
        console.log('✅ Assessment completed:', data)
      } else {
        setError(`Assessment failed: ${data.error || 'Unknown error'}`)
      }
    } catch (err) {
      console.error('❌ Error running assessment:', err)
      setError('Network error during assessment')
    } finally {
      setAssessmentLoading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('Copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const exportTranscript = () => {
    if (!transcriptData) return

    const content = JSON.stringify(transcriptData, null, 2)
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transcript-${transcriptData.conversationId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* Header */}
          <div className="border-b border-gray-200 pb-6 mb-6">
            <div className="flex items-center mb-4">
              <FileText className="w-8 h-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">ElevenLabs Transcript Tester</h1>
            </div>
            <p className="text-gray-600">
              Fetch and analyze conversation transcripts from ElevenLabs API to verify user/assistant message availability.
            </p>
          </div>

          {/* Input Section */}
          <div className="mb-6">
            <label htmlFor="conversationId" className="block text-sm font-medium text-gray-700 mb-2">
              Conversation ID
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                id="conversationId"
                value={conversationId}
                onChange={(e) => setConversationId(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter conversation ID (e.g., conv_1101k5yr5zdefnga05pyaqfd0ffn)"
                disabled={loading}
              />
              <button
                onClick={fetchTranscript}
                disabled={loading || !conversationId.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Fetching...
                  </>
                ) : (
                  'Fetch Transcript'
                )}
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="text-red-700 font-medium">Error:</div>
              <div className="text-red-600">{error}</div>
            </div>
          )}

          {/* Results Section */}
          {transcriptData && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Transcript Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="font-medium text-blue-800">Conversation ID:</div>
                    <div className="text-blue-700 break-all">{transcriptData.conversationId}</div>
                  </div>
                  <div>
                    <div className="font-medium text-blue-800">Message Count:</div>
                    <div className="text-blue-700">{transcriptData.messageCount}</div>
                  </div>
                  <div>
                    <div className="font-medium text-blue-800">Fetched At:</div>
                    <div className="text-blue-700">{new Date(transcriptData.fetchedAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="font-medium text-blue-800">Status:</div>
                    <div className="text-green-700">✅ Success</div>
                  </div>
                </div>
              </div>

              {/* Q&A Analysis */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-purple-900 mb-2">Q&A Analysis</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
                  <div>
                    <div className="font-medium text-purple-800">Q&A Exchanges:</div>
                    <div className="text-purple-700">{qaExchanges.length}</div>
                  </div>
                  <div>
                    <div className="font-medium text-purple-800">Assessment Ready:</div>
                    <div className={`flex items-center ${qaExchanges.length > 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {qaExchanges.length > 0 ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Yes
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 mr-1" />
                          No
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-purple-800">Scoring Potential:</div>
                    <div className="text-purple-700">{qaExchanges.length} questions</div>
                  </div>
                </div>

                {qaExchanges.length > 0 && (
                  <div>
                    <h4 className="font-medium text-purple-800 mb-2">Q&A Exchanges Preview:</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {qaExchanges.slice(0, 5).map((exchange, index) => (
                        <div key={index} className="bg-white rounded border border-purple-100 p-3">
                          <div className="flex items-start mb-2">
                            <Bot className="w-4 h-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-blue-700">
                              <strong>Q:</strong> {exchange.question.length > 80
                                ? exchange.question.substring(0, 80) + '...'
                                : exchange.question}
                            </div>
                          </div>
                          <div className="flex items-start">
                            <User className="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-green-700">
                              <strong>A:</strong> {exchange.answer.length > 80
                                ? exchange.answer.substring(0, 80) + '...'
                                : exchange.answer}
                            </div>
                          </div>
                          {exchange.answerTimestamp && (
                            <div className="text-xs text-gray-500 mt-1">
                              Time: {Math.floor(exchange.answerTimestamp / 1000)}s
                            </div>
                          )}
                        </div>
                      ))}
                      {qaExchanges.length > 5 && (
                        <div className="text-sm text-purple-600 text-center py-2">
                          ... and {qaExchanges.length - 5} more exchanges
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  {showRawJson ? 'Show Formatted' : 'Show Raw JSON'}
                </button>
                <button
                  onClick={exportTranscript}
                  className="px-4 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export JSON
                </button>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(transcriptData, null, 2))}
                  className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200 flex items-center"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Data
                </button>
                {qaExchanges.length > 0 && (
                  <button
                    onClick={runAssessment}
                    disabled={assessmentLoading}
                    className="px-4 py-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 disabled:bg-gray-300 disabled:text-gray-500 flex items-center"
                  >
                    {assessmentLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-700 mr-2"></div>
                        Assessing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Run Assessment
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Content Display */}
              {showRawJson ? (
                <div className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm">{JSON.stringify(transcriptData, null, 2)}</pre>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Conversation Messages</h3>

                  {transcriptData.transcript.messages && transcriptData.transcript.messages.length > 0 ? (
                    <div className="space-y-3">
                      {transcriptData.transcript.messages.map((message, index) => (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border ${
                            message.role === 'user'
                              ? 'bg-green-50 border-green-200'
                              : 'bg-blue-50 border-blue-200'
                          }`}
                        >
                          <div className="flex items-center mb-2">
                            {message.role === 'user' ? (
                              <User className="w-5 h-5 text-green-600 mr-2" />
                            ) : (
                              <Bot className="w-5 h-5 text-blue-600 mr-2" />
                            )}
                            <span className={`font-medium ${
                              message.role === 'user' ? 'text-green-800' : 'text-blue-800'
                            }`}>
                              {message.role === 'user' ? 'User' : 'Assistant'}
                            </span>
                            {message.timestamp && (
                              <span className="ml-auto text-xs text-gray-500">
                                {new Date(message.timestamp).toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div className={`${
                            message.role === 'user' ? 'text-green-700' : 'text-blue-700'
                          }`}>
                            {message.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <div>No messages found in transcript</div>
                      <div className="text-sm">The transcript may have a different structure</div>
                    </div>
                  )}
                </div>
              )}

              {/* Assessment Results */}
              {assessmentData && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mt-6">
                  <h3 className="text-lg font-semibold text-orange-900 mb-4">Assessment Results</h3>

                  {/* Summary */}
                  <div className="bg-orange-100 rounded-lg p-3 mb-4">
                    <h4 className="font-medium text-orange-800 mb-2">Overall Score</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="font-medium text-orange-700">Questions Matched:</div>
                        <div className="text-orange-600">{assessmentData.summary?.totalQuestions || 0}</div>
                      </div>
                      <div>
                        <div className="font-medium text-orange-700">Correct Answers:</div>
                        <div className="text-green-600">{assessmentData.summary?.correctAnswers || 0}</div>
                      </div>
                      <div>
                        <div className="font-medium text-orange-700">Accuracy:</div>
                        <div className="text-orange-600">{assessmentData.summary?.accuracy || 0}%</div>
                      </div>
                      <div>
                        <div className="font-medium text-orange-700">Average Score:</div>
                        <div className="text-orange-600">{Math.round((assessmentData.summary?.score || 0) / 100)}/100</div>
                      </div>
                    </div>
                  </div>

                  {/* Individual Question Results */}
                  {assessmentData.assessmentResults && assessmentData.assessmentResults.length > 0 && (
                    <div>
                      <h4 className="font-medium text-orange-800 mb-3">Question-by-Question Results</h4>
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {assessmentData.assessmentResults.map((result: any, index: number) => (
                          <div key={index} className={`border rounded-lg p-3 ${
                            result.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                          }`}>
                            <div className="flex items-center mb-2">
                              {result.isCorrect ? (
                                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-600 mr-2" />
                              )}
                              <div className={`font-medium ${
                                result.isCorrect ? 'text-green-800' : 'text-red-800'
                              }`}>
                                {result.topicName} - Score: {result.score}/100
                              </div>
                            </div>
                            <div className="mb-2">
                              <div className="text-sm font-medium text-gray-700">Question:</div>
                              <div className="text-sm text-gray-600">{result.questionAsked}</div>
                            </div>
                            <div className="mb-2">
                              <div className="text-sm font-medium text-gray-700">User Answer:</div>
                              <div className="text-sm text-gray-600">{result.userAnswer}</div>
                            </div>
                            <div className="mb-2">
                              <div className="text-sm font-medium text-gray-700">Expected Answer:</div>
                              <div className="text-sm text-gray-600">{result.correctAnswer}</div>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-700">Feedback:</div>
                              <div className="text-sm text-gray-600">{result.feedback}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {assessmentData.message && (
                    <div className="text-center py-4 text-orange-700">
                      {assessmentData.message}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}