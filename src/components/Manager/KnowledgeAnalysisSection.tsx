'use client'

import { useState, useEffect } from 'react'
import { BookOpen, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronRight, Loader2, RefreshCw, Brain } from 'lucide-react'

interface TopicMastery {
  topic: string
  score: number
  total_questions: number
  correct: number
  incorrect: number
  unanswered: number
  issues: string[]
}

interface AnswerQualityTheme {
  theme: string
  frequency: number
  severity: 'low' | 'medium' | 'high'
  examples: Array<{
    question: string
    answer: string
    issue: string
  }>
}

interface ProductKnowledge {
  product: string
  mentioned_in_theory: boolean
  applied_in_practice: boolean
  accuracy_notes: string
  evidence?: string
}

interface TheoryVsPracticeGap {
  gap: string
  evidence: string
  severity: 'low' | 'medium' | 'high'
}

interface KnowledgeAnalysisData {
  overall_knowledge_score: number
  topic_mastery: TopicMastery[]
  answer_quality_themes: AnswerQualityTheme[]
  product_knowledge: ProductKnowledge[]
  theory_vs_practice_gaps: TheoryVsPracticeGap[]
  summary: string
}

interface KnowledgeAnalysisSectionProps {
  employeeId: string
  companyId: string
  employeeName: string
}

export default function KnowledgeAnalysisSection({ employeeId, companyId, employeeName }: KnowledgeAnalysisSectionProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<KnowledgeAnalysisData | null>(null)
  const [metadata, setMetadata] = useState<any>(null)
  const [expandedTheme, setExpandedTheme] = useState<number | null>(null)
  const [expandedTopic, setExpandedTopic] = useState<number | null>(null)

  const loadAnalysis = async (forceReAnalysis: boolean = false) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/employee-knowledge-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          companyId,
          forceReAnalysis
        })
      })

      const result = await response.json()

      if (result.success) {
        setAnalysis(result.analysis)
        setMetadata({
          cached: result.cached,
          analyzedAt: result.analyzedAt,
          sessionsAnalyzed: result.sessionsAnalyzed
        })
      } else {
        setError(result.error || 'Failed to load knowledge analysis')
      }
    } catch (err) {
      console.error('Error loading knowledge analysis:', err)
      setError('Failed to load knowledge analysis')
    } finally {
      setLoading(false)
    }
  }

  // Load cached analysis on component mount
  useEffect(() => {
    loadAnalysis(false)
  }, [employeeId, companyId])

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-700 bg-green-50 border-green-200'
    if (score >= 60) return 'text-yellow-700 bg-yellow-50 border-yellow-200'
    return 'text-red-700 bg-red-50 border-red-200'
  }

  const getProgressBarColor = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getSeverityBadge = (severity: 'low' | 'medium' | 'high') => {
    const colors = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800'
    }
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors[severity]}`}>
        {severity.toUpperCase()}
      </span>
    )
  }

  if (!analysis && !loading) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <div className="text-center">
          <Brain className="w-12 h-12 mx-auto mb-4 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Knowledge Analysis</h3>
          <p className="text-gray-600 mb-4">
            Analyze {employeeName}'s knowledge mastery across Theory Q&A and Service Practice sessions.
          </p>
          <button
            onClick={() => loadAnalysis(false)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Generate Analysis
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-12">
        <div className="flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
          <p className="text-gray-600">Analyzing knowledge patterns...</p>
          <p className="text-sm text-gray-500 mt-2">This may take 10-20 seconds</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">{error}</p>
      </div>
    )
  }

  if (!analysis) return null

  return (
    <div className="space-y-6">
      {/* Header with Overall Score */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <BookOpen className="w-6 h-6" />
                Knowledge Analysis
              </h2>
              <p className="text-purple-100 text-sm mt-1">
                Comprehensive knowledge mastery evaluation
              </p>
            </div>
            <button
              onClick={() => loadAnalysis(true)}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2 text-sm"
              title="Regenerate analysis"
            >
              <RefreshCw className="w-4 h-4" />
              Redo Analysis
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
          {/* Overall Knowledge Score */}
          <div className={`rounded-lg p-4 border-2 ${getScoreColor(analysis.overall_knowledge_score)}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium opacity-75">Overall Knowledge Score</p>
                <p className="text-3xl font-bold">{analysis.overall_knowledge_score}/100</p>
              </div>
              <Brain className="w-8 h-8 opacity-50" />
            </div>
          </div>

          {/* Topics Analyzed */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">Topics Analyzed</p>
                <p className="text-3xl font-bold text-blue-900">{analysis.topic_mastery.length}</p>
              </div>
              <BookOpen className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          {/* Issues Found */}
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-600 font-medium">Quality Issues</p>
                <p className="text-3xl font-bold text-orange-900">{analysis.answer_quality_themes.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-400" />
            </div>
          </div>
        </div>

        {/* Summary Text */}
        {analysis.summary && (
          <div className="px-6 pb-6">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-gray-800 leading-relaxed">{analysis.summary}</p>
            </div>
          </div>
        )}

        {/* Metadata */}
        {metadata && (
          <div className="px-6 pb-4 flex items-center gap-4 text-sm text-gray-500">
            <span>Sessions analyzed: {metadata.sessionsAnalyzed}</span>
            <span>•</span>
            <span>
              {metadata.cached ? '📦 Cached' : '✨ Fresh'} analysis from{' '}
              {new Date(metadata.analyzedAt).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Topic Mastery */}
      {analysis.topic_mastery.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            Topic-Level Mastery
          </h3>
          <div className="space-y-4">
            {analysis.topic_mastery.map((topic, index) => (
              <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedTopic(expandedTopic === index ? null : index)}
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{topic.topic}</h4>
                      <div className="flex items-center gap-3">
                        <span className={`text-lg font-bold ${topic.score >= 80 ? 'text-green-600' : topic.score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {topic.score}/100
                        </span>
                        {expandedTopic === index ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div
                        className={`h-2 rounded-full transition-all ${getProgressBarColor(topic.score)}`}
                        style={{ width: `${topic.score}%` }}
                      />
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        {topic.correct} correct
                      </span>
                      <span className="text-red-600 flex items-center gap-1">
                        <XCircle className="w-4 h-4" />
                        {topic.incorrect} incorrect
                      </span>
                      <span className="text-gray-500">
                        {topic.unanswered} unanswered
                      </span>
                    </div>
                  </div>
                </div>
                {expandedTopic === index && topic.issues.length > 0 && (
                  <div className="bg-red-50 p-4 border-t border-red-100">
                    <p className="text-sm font-semibold text-red-900 mb-2">Identified Issues:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {topic.issues.map((issue, issueIndex) => (
                        <li key={issueIndex} className="text-sm text-red-800">{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Answer Quality Themes */}
      {analysis.answer_quality_themes.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            Answer Quality Themes
          </h3>
          <div className="space-y-4">
            {analysis.answer_quality_themes.map((theme, index) => (
              <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedTheme(expandedTheme === index ? null : index)}
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold text-gray-900">{theme.theme}</h4>
                        {getSeverityBadge(theme.severity)}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">
                          {theme.frequency} {theme.frequency === 1 ? 'instance' : 'instances'}
                        </span>
                        {expandedTheme === index ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {expandedTheme === index && theme.examples.length > 0 && (
                  <div className="bg-gray-50 p-4 border-t border-gray-200">
                    <p className="text-sm font-semibold text-gray-900 mb-3">Examples:</p>
                    <div className="space-y-3">
                      {theme.examples.map((example, exampleIndex) => (
                        <div key={exampleIndex} className="bg-white p-3 rounded-lg border border-gray-200">
                          <p className="text-sm font-medium text-gray-900 mb-1">
                            Q: {example.question}
                          </p>
                          <p className="text-sm text-gray-700 mb-2">
                            A: "{example.answer}"
                          </p>
                          <p className="text-sm text-red-600">
                            <span className="font-semibold">Issue:</span> {example.issue}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product Knowledge */}
      {analysis.product_knowledge.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Product Knowledge Application</h3>
          <div className="space-y-3">
            {analysis.product_knowledge.map((product, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">{product.product}</h4>
                  <div className="flex gap-2">
                    {product.mentioned_in_theory && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        Theory ✓
                      </span>
                    )}
                    {product.applied_in_practice && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Practice ✓
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-700 mb-1">{product.accuracy_notes}</p>
                {product.evidence && (
                  <p className="text-xs text-gray-500 italic mt-2">"{product.evidence}"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Theory vs Practice Gaps */}
      {analysis.theory_vs_practice_gaps.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Theory vs Practice Gaps
          </h3>
          <div className="space-y-3">
            {analysis.theory_vs_practice_gaps.map((gap, index) => (
              <div key={index} className="border-l-4 border-red-500 bg-red-50 p-4 rounded-r-lg">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-red-900">{gap.gap}</h4>
                  {getSeverityBadge(gap.severity)}
                </div>
                <p className="text-sm text-red-800">{gap.evidence}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
