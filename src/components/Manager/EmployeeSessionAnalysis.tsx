'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, BarChart3, Lightbulb, Target, Sparkles, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { SUPPORTED_LANGUAGES, type LanguageCode } from '@/lib/languages'
import KnowledgeAnalysisSection from '@/components/Manager/KnowledgeAnalysisSection'
import { useTranslations } from 'next-intl'

interface MetricSummary {
  empathy: number
  professionalism: number
  problem_resolution: number
  clarity: number
  deescalation?: number
  product_knowledge_accuracy: number
  milestone_completion_rate: number
}

interface StrengthWeakness {
  point: string
  frequency: number
  examples: string[]
}

interface EmployeeSessionAnalysisProps {
  employeeId: string
  employeeName: string
  companyId: string
}

export default function EmployeeSessionAnalysis({ employeeId, employeeName, companyId }: EmployeeSessionAnalysisProps) {
  const t = useTranslations()
  const [loading, setLoading] = useState(true)
  const [hasData, setHasData] = useState(false)
  const [summary, setSummary] = useState<any>(null)
  const [patterns, setPatterns] = useState<any>(null)
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [analysisMetadata, setAnalysisMetadata] = useState<any>(null)
  const [generatingAi, setGeneratingAi] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(() => {
    // Load from localStorage or default to 'en'
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('manager_analysis_language')
      return (saved as LanguageCode) || 'en'
    }
    return 'en'
  })

  useEffect(() => {
    // Clear analysis state when employee changes
    setAiAnalysis(null)
    setAnalysisMetadata(null)
    setError(null)

    loadSummary()
  }, [employeeId])

  useEffect(() => {
    loadCachedAnalysis()
  }, [employeeId, selectedLanguage])

  const loadSummary = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/employees/employee-service-practice-summary?employee_id=${employeeId}`)
      const result = await response.json()

      if (result.success && result.has_data) {
        setHasData(true)
        setSummary(result.summary)
        setPatterns(result.patterns)
      } else {
        setHasData(false)
      }
    } catch (err) {
      console.error('Error loading summary:', err)
      setError('Failed to load session analysis')
    } finally {
      setLoading(false)
    }
  }

  const loadCachedAnalysis = async () => {
    try {
      // TODO: Endpoint not implemented yet - skip for now
      console.log('ℹ️ AI Analysis feature coming soon')
      return

      // Try to load cached analysis - cache_only mode to avoid generating
      const response = await fetch('/api/generate-employee-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          employee_name: employeeName,
          language: selectedLanguage,
          force_reanalysis: false,
          cache_only: true  // Don't generate if no cache exists
        })
      })

      const result = await response.json()

      // ONLY load if it came from cache - do NOT load freshly generated analysis
      if (result.success && result.from_cache) {
        setAiAnalysis(result.analysis)
        setAnalysisMetadata(result.metadata)
        console.log('✅ Loaded cached analysis')
      } else if (result.success && !result.from_cache) {
        // Fresh analysis was generated but we ignore it - user must click button
        console.log('📭 No cache found - user must click Generate Analysis button')
      } else if (result.error && !result.error.includes('At least 2 completed sessions')) {
        // Only log errors that aren't about insufficient sessions
        console.log('⚠️ Could not load analysis:', result.error)
      }
    } catch (err) {
      console.error('Error loading cached analysis:', err)
      // Don't show error - this is just a cache check
    }
  }

  const generateAiAnalysis = async (forceReAnalysis: boolean = false) => {
    try {
      setGeneratingAi(true)
      setError(null)

      // TODO: Feature not implemented yet
      setError('AI Analysis feature coming soon! This will generate personalized insights.')
      setGeneratingAi(false)
      return

      const response = await fetch('/api/generate-employee-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId,
          employee_name: employeeName,
          language: selectedLanguage,
          force_reanalysis: forceReAnalysis
        })
      })

      const result = await response.json()

      if (result.success) {
        setAiAnalysis(result.analysis)
        setAnalysisMetadata(result.metadata)
      } else {
        setError(result.error || 'Failed to generate AI analysis')
      }
    } catch (err) {
      console.error('Error generating AI analysis:', err)
      setError('Failed to generate AI analysis')
    } finally {
      setGeneratingAi(false)
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-5 h-5 text-green-600" />
      case 'declining':
        return <TrendingDown className="w-5 h-5 text-red-600" />
      default:
        return <Minus className="w-5 h-5 text-gray-600" />
    }
  }

  const getTrendText = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <span className="text-green-700 font-medium">{t('sessionAnalysis.improving')}</span>
      case 'declining':
        return <span className="text-red-700 font-medium">{t('sessionAnalysis.declining')}</span>
      default:
        return <span className="text-gray-700 font-medium">{t('sessionAnalysis.stable')}</span>
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-700 bg-green-50'
    if (score >= 60) return 'text-yellow-700 bg-yellow-50'
    return 'text-red-700 bg-red-50'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('sessionAnalysis.noDataTitle')}</h3>
        <p className="text-gray-600">
          {t('sessionAnalysis.noDataDescription', { employeeName })}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Summary Stats */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <h2 className="text-xl font-bold">{t('sessionAnalysis.overallSummary')}</h2>
          <p className="text-blue-100 text-sm mt-1">{t('sessionAnalysis.servicePracticeAnalysis')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
          {/* Total Sessions */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 font-medium">{t('sessionAnalysis.totalSessions')}</p>
                <p className="text-3xl font-bold text-blue-900">{summary.total_sessions}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          {/* Average Score */}
          <div className={`rounded-lg p-4 ${getScoreColor(summary.average_overall_score)}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium opacity-75">{t('sessionAnalysis.averageScore')}</p>
                <p className="text-3xl font-bold">{summary.average_overall_score}/100</p>
              </div>
              <Target className="w-8 h-8 opacity-50" />
            </div>
          </div>

          {/* Trend */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">{t('sessionAnalysis.performanceTrend')}</p>
                <div className="text-2xl font-bold mt-1">{getTrendText(summary.trend)}</div>
              </div>
              {getTrendIcon(summary.trend)}
            </div>
          </div>
        </div>
      </div>

      {/* Average Metrics */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          {t('sessionAnalysis.averageMetrics')}
        </h3>
        <div className="space-y-3">
          {Object.entries(summary.average_metrics).map(([key, value]) => {
            if (key === 'deescalation' && value === undefined) return null

            // Map metric keys to translation keys (snake_case to camelCase)
            const metricTranslationKey = key === 'product_knowledge_accuracy'
              ? 'productKnowledge'
              : key === 'milestone_completion_rate'
              ? 'milestoneCompletion'
              : key === 'problem_resolution'
              ? 'problemResolution'
              : key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()).replace(/_/g, '')

            const label = t(`assessment.metrics.${metricTranslationKey}`)
            const score = value as number
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                  <span className={`text-sm font-semibold px-2 py-0.5 rounded ${getScoreColor(score)}`}>
                    {score}/100
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Patterns: Strengths and Improvements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Strengths */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-green-600" />
            {t('sessionAnalysis.consistentStrengths')}
          </h3>
          {patterns.top_strengths.length > 0 ? (
            <ul className="space-y-3">
              {patterns.top_strengths.map((strength: StrengthWeakness, index: number) => (
                <li key={index} className="flex items-start gap-3 bg-green-50 rounded-lg p-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {strength.frequency}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{strength.point}</p>
                    {strength.examples.length > 0 && (
                      <p className="text-xs text-gray-600 mt-1 italic">"{strength.examples[0].substring(0, 80)}..."</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">{t('sessionAnalysis.noStrengths')}</p>
          )}
        </div>

        {/* Top Improvements */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-orange-600" />
            {t('sessionAnalysis.areasForDevelopment')}
          </h3>
          {patterns.top_improvements.length > 0 ? (
            <ul className="space-y-3">
              {patterns.top_improvements.map((improvement: StrengthWeakness, index: number) => (
                <li key={index} className="flex items-start gap-3 bg-orange-50 rounded-lg p-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-orange-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {improvement.frequency}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{improvement.point}</p>
                    {improvement.examples.length > 0 && (
                      <p className="text-xs text-gray-600 mt-1 italic">"{improvement.examples[0].substring(0, 80)}..."</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">{t('sessionAnalysis.noImprovements')}</p>
          )}
        </div>
      </div>

      {/* Knowledge Analysis Section */}
      <KnowledgeAnalysisSection
        employeeId={employeeId}
        companyId={companyId}
        employeeName={employeeName}
      />

      {/* AI Analysis Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <h3 className="text-lg font-semibold">{t('sessionAnalysis.aiCoachingAnalysis')}</h3>
          </div>
          {!generatingAi && (
            <div className="flex items-center gap-3">
              {/* Language Selector */}
              <select
                value={selectedLanguage}
                onChange={(e) => {
                  const newLang = e.target.value as LanguageCode
                  setSelectedLanguage(newLang)
                  localStorage.setItem('manager_analysis_language', newLang)
                }}
                className="bg-purple-500 text-white border border-purple-400 rounded-lg px-3 py-2 text-sm font-medium hover:bg-purple-600 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>

              {/* Generate / Redo Button */}
              <button
                onClick={() => generateAiAnalysis(!!aiAnalysis)}
                className="bg-white text-purple-700 px-4 py-2 rounded-lg font-medium hover:bg-purple-50 transition-colors text-sm"
              >
                {aiAnalysis ? t('sessionAnalysis.redoAnalysis') : t('sessionAnalysis.generateAnalysis')}
              </button>
            </div>
          )}
        </div>

        <div className="p-6">
          {generatingAi ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-purple-600 mb-4" />
              <p className="text-gray-700 font-medium">{t('sessionAnalysis.analyzingSessions', { count: summary.total_sessions })}</p>
              <p className="text-gray-500 text-sm mt-1">{t('sessionAnalysis.analysisWait')}</p>
            </div>
          ) : aiAnalysis ? (
            <>
              {/* Metadata */}
              {analysisMetadata && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-gray-600">{t('sessionAnalysis.sessionsAnalyzed')}</span>{' '}
                      <span className="font-semibold text-gray-900">{analysisMetadata.sessions_analyzed}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">{t('sessionAnalysis.generated')}</span>{' '}
                      <span className="font-semibold text-gray-900">
                        {new Date(analysisMetadata.generated_at).toLocaleDateString()} at{' '}
                        {new Date(analysisMetadata.generated_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">{t('sessionAnalysis.language')}</span>{' '}
                      <span className="font-semibold text-gray-900">
                        {SUPPORTED_LANGUAGES.find(l => l.code === analysisMetadata.language)?.flag}{' '}
                        {SUPPORTED_LANGUAGES.find(l => l.code === analysisMetadata.language)?.name}
                      </span>
                    </div>
                  </div>
                  {summary && analysisMetadata.sessions_analyzed < summary.total_sessions && (
                    <div className="text-sm text-orange-700 bg-orange-100 px-3 py-1 rounded-lg">
                      {t('sessionAnalysis.newSessionsAvailable')}
                    </div>
                  )}
                </div>
              )}

              {/* Analysis Content */}
              <div className="prose prose-sm max-w-none
                prose-headings:font-bold prose-headings:text-gray-900
                prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-gray-200
                prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4
                prose-ul:my-4 prose-li:text-gray-700 prose-li:mb-2
                prose-ol:my-4 prose-ol:space-y-2
                prose-strong:text-gray-900 prose-strong:font-semibold
                first:prose-h2:mt-0">
                <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Sparkles className="w-12 h-12 mx-auto mb-3 text-purple-300" />
              <p className="text-gray-600">
                {t('sessionAnalysis.clickToGenerate')}
              </p>
              <p className="text-gray-500 text-sm mt-2">
                {t('sessionAnalysis.aiWillAnalyze', { count: summary.total_sessions })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
