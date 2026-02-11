'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import TrackList from '@/components/Tracks/TrackList'
import TrackForm from '@/components/Tracks/TrackForm'
import ScenarioForm from '@/components/Scenarios/ScenarioForm'
import EditScenarioForm from '@/components/Scenarios/EditScenarioForm'
import AddScenariosDialog from '@/components/Scenarios/AddScenariosDialog'
import { SortableScenarioCard } from '@/components/Scenarios/SortableScenarioCard'
import UserHeader from '@/components/Shared/UserHeader'
import SessionFeed from '@/components/Manager/SessionFeed'
import EmployeeProgressList from '@/components/Manager/EmployeeProgressList'
import EmployeeDashboardView from '@/components/Manager/EmployeeDashboardView'
import ServicePracticeAnalyticsDashboard from '@/components/Manager/ServicePracticeAnalyticsDashboard'
import EmployeeSkillComparison from '@/components/Analytics/EmployeeSkillComparison'
import BatchAnalysisBar from '@/components/Manager/BatchAnalysisBar'
import { useAuth } from '@/contexts/AuthContext'
import { Track, Scenario, scenarioService } from '@/lib/scenarios'
import { employeeService, Employee } from '@/lib/employees'
import { SUPPORTED_LANGUAGES, getLanguageByCode } from '@/lib/languages'
import { getEmotionDisplay } from '@/lib/customer-emotions'
import { getVoiceName } from '@/lib/elevenlabs-voices'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Voice Badge Component - displays voice names from voice_ids array
function VoiceBadge({ voiceIds }: { voiceIds?: string[] | null }) {
  const t = useTranslations()
  const [voiceNames, setVoiceNames] = useState<string>(t('manager.tracks.loading'))

  useEffect(() => {
    const fetchVoiceNames = async () => {
      // Handle legacy voice_id or empty array
      if (!voiceIds || voiceIds.length === 0) {
        setVoiceNames(t('manager.tracks.randomVoice'))
        return
      }

      // If includes 'random' keyword
      if (voiceIds.includes('random')) {
        setVoiceNames(t('manager.tracks.randomVoice'))
        return
      }

      try {
        // Fetch voice metadata from API
        const response = await fetch('/api/settings/voice-settings')
        const data = await response.json()

        if (data.success && data.voices) {
          // Map voice IDs to names
          const names = voiceIds
            .map(id => {
              const voice = data.voices.find((v: any) => v.voice_id === id)
              return voice ? voice.voice_name : null
            })
            .filter(Boolean)

          if (names.length === 0) {
            setVoiceNames(t('manager.tracks.randomVoice'))
          } else if (names.length === 1) {
            setVoiceNames(names[0])
          } else {
            setVoiceNames(t('manager.tracks.voicesCount', { count: names.length }))
          }
        } else {
          setVoiceNames(t('manager.tracks.randomVoice'))
        }
      } catch (error) {
        console.error('Failed to fetch voice names:', error)
        setVoiceNames(t('manager.tracks.randomVoice'))
      }
    }

    fetchVoiceNames()
  }, [voiceIds, t])

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
      🎤 {voiceNames}
    </span>
  )
}

// TopicTag component to display topic information
interface TopicTagProps {
  topicId: string
  companyId: string
}

function TopicTag({ topicId, companyId }: TopicTagProps) {
  const t = useTranslations()
  const [topicData, setTopicData] = useState<{
    name: string
    questionCount: number
    category?: string
    difficulty_level?: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTopicData = async () => {
      try {
        const response = await fetch(`/api/knowledge-assessment/topics?company_id=${companyId}`)
        const data = await response.json()
        if (data.success) {
          const topic = data.topics.find((t: any) => t.id === topicId)
          if (topic) {
            setTopicData({
              name: topic.name,
              questionCount: topic.topic_questions?.length || 0,
              category: topic.category,
              difficulty_level: topic.difficulty_level
            })
          }
        }
      } catch (error) {
        console.error('Failed to fetch topic:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTopicData()
  }, [topicId, companyId])

  if (loading) {
    return (
      <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 animate-pulse">
        {t('manager.tracks.loading')}
      </div>
    )
  }

  if (!topicData) {
    return (
      <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        {t('manager.tracks.topicNotFound')}
      </div>
    )
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'menu': return 'bg-green-100 text-green-800'
      case 'procedures': return 'bg-blue-100 text-blue-800'
      case 'policies': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="inline-flex items-center space-x-1">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(topicData.category || 'general')}`}>
        {topicData.name}
      </span>
      <span className="text-xs text-gray-500">
        {topicData.questionCount} {t('manager.tracks.questions')}
      </span>
      {topicData.difficulty_level && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          L{topicData.difficulty_level}
        </span>
      )}
    </div>
  )
}

export default function ManagerDashboard() {
  const router = useRouter()
  const { user, clearAuthCache } = useAuth()
  const t = useTranslations()
  const [tracks, setTracks] = useState<Track[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [allScenarios, setAllScenarios] = useState<Scenario[]>([])
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)
  const [showTrackForm, setShowTrackForm] = useState(false)
  const [showScenarioForm, setShowScenarioForm] = useState(false)
  const [showEditScenarioForm, setShowEditScenarioForm] = useState(false)
  const [showAddScenariosDialog, setShowAddScenariosDialog] = useState(false)
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null)
  const [showEditTrackForm, setShowEditTrackForm] = useState(false)
  const [editingTrack, setEditingTrack] = useState<Track | null>(null)
  const [loading, setLoading] = useState(true)
  const [roleChecking, setRoleChecking] = useState(true)
  const [isEmployee, setIsEmployee] = useState(false)
  const [activeTab, setActiveTab] = useState<'feed' | 'progress' | 'training' | 'knowledge' | 'employees'>('feed')
  const [defaultLanguage, setDefaultLanguage] = useState('en')
  const [savingLanguage, setSavingLanguage] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [theoryRecordingOptions, setTheoryRecordingOptions] = useState<string[]>(['audio', 'audio_video'])
  const [servicePracticeRecordingOptions, setServicePracticeRecordingOptions] = useState<string[]>(['audio', 'audio_video'])
  const [savingRecordingOptions, setSavingRecordingOptions] = useState(false)
  const [selectedTrackFilter, setSelectedTrackFilter] = useState<string>('all')

  // Deduplication ref to prevent reload on tab switch
  const hasCheckedRoleRef = useRef(false)

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Helper function to get track name from track_id
  const getTrackName = (trackId: string): string => {
    const track = tracks.find(t => t.id === trackId)
    return track ? track.name : 'Unknown Track'
  }

  // Read tab from URL query parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const tab = urlParams.get('tab')
      if (tab && (tab === 'feed' || tab === 'progress' || tab === 'training' || tab === 'knowledge' || tab === 'employees')) {
        setActiveTab(tab as 'feed' | 'progress' | 'training' | 'knowledge' | 'employees')
      }
    }
  }, [])

  // Get company ID from authenticated user
  const companyId = user?.company_id

  const loadTracks = async () => {
    try {
      const response = await fetch(`/api/tracks?company_id=${companyId}`)
      const data = await response.json()
      if (data.success) {
        setTracks(data.data?.tracks || [])
      }
    } catch (error) {
      console.error('Failed to load tracks:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadScenarios = async (trackId: string) => {
    try {
      const response = await fetch(`/api/scenarios?track_id=${trackId}`)
      const data = await response.json()
      if (data.success) {
        setScenarios(data.data?.scenarios || [])
      }
    } catch (error) {
      console.error('Failed to load scenarios:', error)
      setScenarios([])
    }
  }

  const loadAllScenarios = async () => {
    try {
      const response = await fetch(`/api/scenarios?company_id=${companyId}`)
      const data = await response.json()
      if (data.success) {
        setAllScenarios(data.data?.scenarios || [])
      }
    } catch (error) {
      console.error('Failed to load all scenarios:', error)
      setAllScenarios([])
    }
  }

  const loadCompanySettings = async () => {
    try {
      const response = await fetch(`/api/settings/company-settings?company_id=${companyId}`)
      const data = await response.json()
      if (data.success && data.settings) {
        setDefaultLanguage(data.settings.default_training_language || 'en')
        setTheoryRecordingOptions(data.settings.theory_recording_options || ['audio', 'audio_video'])
        setServicePracticeRecordingOptions(data.settings.service_practice_recording_options || ['audio', 'audio_video'])
      }
    } catch (error) {
      console.error('Failed to load company settings:', error)
    }
  }

  const handleLanguageChange = async (languageCode: string) => {
    setSavingLanguage(true)
    try {
      const response = await fetch('/api/settings/company-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          default_training_language: languageCode
        })
      })

      const data = await response.json()
      if (data.success) {
        setDefaultLanguage(languageCode)
        console.log('✅ Default training language updated to:', languageCode)
      } else {
        alert('Failed to update default language')
      }
    } catch (error) {
      console.error('Failed to update default language:', error)
      alert('Failed to update default language')
    } finally {
      setSavingLanguage(false)
    }
  }

  const handleRecordingOptionsChange = async (scenarioType: 'theory' | 'service_practice', options: string[]) => {
    setSavingRecordingOptions(true)
    try {
      const settingKey = scenarioType === 'theory' ? 'theory_recording_options' : 'service_practice_recording_options'
      const response = await fetch('/api/settings/company-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          [settingKey]: options
        })
      })

      const data = await response.json()
      if (data.success) {
        if (scenarioType === 'theory') {
          setTheoryRecordingOptions(options)
        } else {
          setServicePracticeRecordingOptions(options)
        }
        console.log(`✅ ${scenarioType} recording options updated to:`, options)
      } else {
        alert('Failed to update recording options')
      }
    } catch (error) {
      console.error('Failed to update recording options:', error)
      alert('Failed to update recording options')
    } finally {
      setSavingRecordingOptions(false)
    }
  }

  // Check user role on mount
  useEffect(() => {
    console.log('🔄 Manager page useEffect - user ID:', user?.id, 'role:', user?.role)

    if (!user?.id) {
      console.log('⏸️ Waiting for user...')
      return
    }

    // Prevent duplicate checks when tab becomes visible again
    const userKey = `${user.id}-${user.role}`
    if (hasCheckedRoleRef.current === userKey) {
      console.log('⏭️ Role already checked - skipping duplicate check')
      return
    }

    hasCheckedRoleRef.current = userKey

    const checkUserRole = () => {
      if (user?.role) {
        // Check actual role from database
        const isEmp = user.role === 'employee'
        setIsEmployee(isEmp)
        if (isEmp) {
          console.log('Manager page: Employee detected by role, redirecting to /employee')
          router.push('/employee')
          return
        }
      }
      setRoleChecking(false)
    }

    checkUserRole()
  }, [user?.id, user?.role, router])

  useEffect(() => {
    if (!roleChecking && !isEmployee && companyId) {
      loadTracks()
      loadAllScenarios()
      loadCompanySettings()
    }
  }, [roleChecking, isEmployee, companyId])

  useEffect(() => {
    if (selectedTrack) {
      loadScenarios(selectedTrack.id)
    } else {
      setScenarios([])
    }
  }, [selectedTrack])

  const handleTrackCreated = () => {
    setShowTrackForm(false)
    loadTracks()
  }

  const handleScenarioCreated = () => {
    setShowScenarioForm(false)
    if (selectedTrack) {
      loadScenarios(selectedTrack.id)
    }
    // Always refresh the all scenarios list
    loadAllScenarios()
  }

  const handleEditScenario = (scenario: Scenario) => {
    setEditingScenario(scenario)
    setShowEditScenarioForm(true)
  }

  const handleScenarioUpdated = () => {
    setShowEditScenarioForm(false)
    setEditingScenario(null)
    loadAllScenarios() // Refresh all scenarios list
    if (selectedTrack) {
      loadScenarios(selectedTrack.id)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    // Get the filtered scenarios for the current track
    const filteredScenarios = selectedTrackFilter === 'all'
      ? allScenarios
      : allScenarios.filter(s => s.track_id === selectedTrackFilter)

    const oldIndex = filteredScenarios.findIndex(s => s.id === active.id)
    const newIndex = filteredScenarios.findIndex(s => s.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    // Reorder locally for instant feedback
    const reorderedScenarios = arrayMove(filteredScenarios, oldIndex, newIndex)

    // Update display_order for reordered scenarios
    const reorderedWithOrder = reorderedScenarios.map((scenario, index) => ({
      ...scenario,
      display_order: index
    }))

    // Merge with scenarios from other tracks
    const otherScenarios = allScenarios.filter(s => s.track_id !== selectedTrackFilter)
    const updatedAllScenarios = [...otherScenarios, ...reorderedWithOrder].sort((a, b) => {
      // Sort by track_id first, then by display_order
      if (a.track_id === b.track_id) {
        return (a.display_order || 0) - (b.display_order || 0)
      }
      return a.track_id.localeCompare(b.track_id)
    })

    setAllScenarios(updatedAllScenarios)

    // Save to backend
    try {
      const response = await fetch('/api/scenarios/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId: selectedTrackFilter,
          scenarioIds: reorderedScenarios.map(s => s.id)
        })
      })

      if (!response.ok) {
        throw new Error('Failed to reorder scenarios')
      }

      console.log('✅ Scenarios reordered successfully')
    } catch (error) {
      console.error('Failed to reorder scenarios:', error)
      // Revert on error
      loadAllScenarios()
      alert(t('manager.tracks.reorderFailed'))
    }
  }

  const handleEditTrack = (track: Track) => {
    setEditingTrack(track)
    setShowEditTrackForm(true)
  }

  const handleDeleteTrack = async (trackId: string) => {
    if (!confirm(t('manager.tracks.confirmDeleteTrack'))) {
      return
    }

    try {
      const response = await fetch(`/api/tracks/${trackId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        loadTracks()
        if (selectedTrack && selectedTrack.id === trackId) {
          setSelectedTrack(null)
        }
      } else {
        alert(t('manager.tracks.deleteTrackFailed'))
      }
    } catch (error) {
      console.error('Failed to delete track:', error)
      alert(t('manager.tracks.deleteTrackFailed'))
    }
  }

  const handleDeleteScenario = async (scenarioId: string) => {
    if (!confirm(t('manager.tracks.confirmDeleteScenario'))) {
      return
    }

    try {
      const response = await fetch(`/api/scenarios/${scenarioId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        loadAllScenarios() // Refresh all scenarios list
        if (selectedTrack) {
          loadScenarios(selectedTrack.id)
        }
      } else {
        alert(t('manager.tracks.deleteScenarioFailed'))
      }
    } catch (error) {
      console.error('Failed to delete scenario:', error)
      alert(t('manager.tracks.deleteScenarioFailed'))
    }
  }

  const handleRemoveFromTrack = async (scenarioId: string) => {
    if (!selectedTrack) {
      alert('No track selected')
      return
    }

    if (!confirm(t('manager.tracks.confirmRemoveFromTrack'))) {
      return
    }

    try {
      // Check if this is a scenario-track assignment or a direct track_id relationship
      const response = await fetch(`/api/scenarios/scenario-track-assignments?scenario_id=${scenarioId}&track_id=${selectedTrack.id}`)
      const result = await response.json()

      if (result.success && result.data.length > 0) {
        // Assignment exists - delete the assignment using query parameters
        const deleteResponse = await fetch(`/api/scenarios/scenario-track-assignments?scenario_id=${scenarioId}&track_id=${selectedTrack.id}`, {
          method: 'DELETE'
        })

        if (!deleteResponse.ok) {
          throw new Error('Failed to remove scenario assignment')
        }

        alert(t('manager.tracks.removeSuccess'))
      } else {
        // No assignment found - this scenario has a direct track_id
        // We need to clear the track_id from the scenario
        alert(t('manager.tracks.legacyTrackWarning'))
        return
      }

      // Refresh the scenarios list for this track
      loadScenarios(selectedTrack.id)

    } catch (error) {
      console.error('Failed to remove scenario from track:', error)
      alert('Failed to remove scenario from track: ' + (error as Error).message)
    }
  }

  const handleTrackUpdated = () => {
    setShowEditTrackForm(false)
    setEditingTrack(null)
    loadTracks()
  }

  const handleSelectTrack = (track: Track) => {
    setSelectedTrack(track)
  }

  const handleBackToTracks = () => {
    setSelectedTrack(null)
    setScenarios([])
  }

  const handleAddScenarios = async (selectedScenarioIds: string[]) => {
    if (!selectedTrack) return

    try {
      for (const scenarioId of selectedScenarioIds) {
        await scenarioService.assignScenarioToTrack(scenarioId, selectedTrack.id)
      }

      // Refresh scenarios list
      loadScenarios(selectedTrack.id)
      setShowAddScenariosDialog(false)

      const plural = selectedScenarioIds.length === 1 ? '' : 's'
      alert(t('manager.tracks.addScenariosSuccess', { count: selectedScenarioIds.length, plural }))
    } catch (error) {
      console.error('Failed to add scenarios:', error)
      alert(t('manager.tracks.addScenariosFailed') + ' ' + (error as Error).message)
    }
  }

  if (loading || roleChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // If employee was detected, don't render anything (redirect in progress)
  if (isEmployee) {
    return null
  }

  // Check if user is authenticated and authorized
  if (!user) {
    if (typeof window !== 'undefined') {
      window.location.href = '/signin'
    }
    return null
  }

  // Temporarily allow all authenticated users to access manager dashboard
  // TODO: Add proper role checking once user profiles are set up
  if (false) { // user.role !== 'manager'
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">This page is only accessible to managers.</p>
          <a
            href="/employee"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Go to Employee Dashboard
          </a>
        </div>
      </div>
    )
  }

  // Guard: Require company_id to be present (after all hooks)
  if (!companyId && !loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <UserHeader />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-red-800 mb-2">Company ID Missing</h2>
              <p className="text-red-700 mb-4">Your account is not associated with a company. Please contact your administrator.</p>
              <button
                onClick={() => {
                  clearAuthCache()
                  window.location.reload()
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Clear Cache and Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* User Header */}
        <UserHeader
          title={t('manager.dashboard.trainingManager')}
          subtitle={selectedTrack ? `${t('manager.dashboard.managingScenarios')}: ${selectedTrack.name}` : t('manager.dashboard.manageTrainings')}
        />

        {/* Action Buttons - Only show on training tab */}
        {activeTab === 'training' && (
          <div className="flex justify-between items-center mb-8">
            {selectedTrack && (
              <>
                <button
                  onClick={handleBackToTracks}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  {t('manager.tracks.backToTracks')}
                </button>
                <div></div>
              </>
            )}
            {!selectedTrack && (
              <>
                <div></div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowScenarioForm(true)}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    {t('manager.dashboard.addScenario')}
                  </button>
                  <button
                    onClick={() => setShowTrackForm(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {t('manager.dashboard.createTrack')}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Navigation Tabs - Always visible */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('feed')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'feed'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {t('manager.dashboard.tabFeed')}
              </button>
              <button
                onClick={() => setActiveTab('progress')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'progress'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {t('manager.dashboard.tabProgress')}
              </button>
              <button
                onClick={() => setActiveTab('training')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'training'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {t('manager.dashboard.tabTracks')}
              </button>
              <button
                onClick={() => router.push('/manager/knowledge-base')}
                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
              >
                {t('manager.dashboard.tabKnowledge')}
              </button>
              <button
                onClick={() => router.push('/manager/employees')}
                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
              >
                {t('manager.dashboard.tabEmployees')}
              </button>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        {activeTab === 'feed' ? (
          /* Feed View */
          <SessionFeed companyId={companyId} />
        ) : activeTab === 'training' ? (
          /* Scenarios View with Track Filters */
          <div>
            {/* Header */}
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">{t('manager.tracks.allScenarios')}</h2>
              <p className="text-gray-600">
                {t('manager.tracks.allScenariosDescription')}
              </p>
            </div>

            {/* Track Filter Tabs */}
            <div className="bg-white rounded-lg shadow mb-6">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-2 px-6 overflow-x-auto" aria-label="Track filters">
                  {/* All Tab */}
                  <button
                    onClick={() => setSelectedTrackFilter('all')}
                    className={`
                      whitespace-nowrap py-4 px-4 border-b-2 font-medium text-sm transition-colors
                      ${selectedTrackFilter === 'all'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    {t('common.all')} ({allScenarios.length})
                  </button>

                  {/* Track Tabs */}
                  {tracks.map((track) => {
                    const trackScenarioCount = allScenarios.filter(s => s.track_id === track.id).length
                    return (
                      <button
                        key={track.id}
                        onClick={() => setSelectedTrackFilter(track.id)}
                        className={`
                          whitespace-nowrap py-4 px-4 border-b-2 font-medium text-sm transition-colors
                          ${selectedTrackFilter === track.id
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }
                        `}
                      >
                        📚 {track.name} ({trackScenarioCount})
                      </button>
                    )
                  })}
                </nav>
              </div>
            </div>

            {/* Scenarios List */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="space-y-4">
                {(() => {
                  // Filter scenarios based on selected track
                  const filteredScenarios = selectedTrackFilter === 'all'
                    ? allScenarios
                    : allScenarios.filter(s => s.track_id === selectedTrackFilter)

                  if (filteredScenarios.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-1l-4 4z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">{t('manager.tracks.noScenariosYet')}</h3>
                        <p className="mt-1 text-sm text-gray-500">
                          {selectedTrackFilter === 'all'
                            ? t('manager.tracks.createTrackFirst')
                            : t('manager.tracks.noScenariosInTrack')}
                        </p>
                      </div>
                    )
                  }

                  // Check if drag-and-drop should be enabled (only when viewing a specific track)
                  const isDraggable = selectedTrackFilter !== 'all'
                  const scenarioIds = filteredScenarios.map(s => s.id)

                  return (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={scenarioIds}
                        strategy={verticalListSortingStrategy}
                      >
                        {filteredScenarios.map((scenario) => (
                          <SortableScenarioCard
                            key={scenario.id}
                            scenario={scenario}
                            isDraggable={isDraggable}
                          >
                            <div className="p-6">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">{scenario.title}</h3>
                          <p className="text-xs text-gray-400 font-mono mb-1">ID: {scenario.id}</p>
                          <div className="mt-3 flex items-center space-x-4 text-sm text-gray-500">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              {scenario.scenario_type === 'theory' ? t('manager.feed.theoryQA') :
                               scenario.scenario_type === 'recommendations' ? t('manager.feed.situationships') :
                               scenario.scenario_type === 'flipboard' ? 'Flipboard' : t('manager.feed.servicePractice')}
                            </span>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                              📚 {getTrackName(scenario.track_id)}
                            </span>
                            {scenario.scenario_type === 'service_practice' && scenario.customer_emotion_level && (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                scenario.customer_emotion_level === 'calm' ? 'bg-green-100 text-green-800' :
                                scenario.customer_emotion_level === 'frustrated' ? 'bg-yellow-100 text-yellow-800' :
                                scenario.customer_emotion_level === 'angry' ? 'bg-orange-100 text-orange-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {getEmotionDisplay(scenario.customer_emotion_level).icon} {getEmotionDisplay(scenario.customer_emotion_level).label}
                              </span>
                            )}
                            {(scenario.scenario_type === 'service_practice' || scenario.scenario_type === 'theory') && scenario.session_time_limit_minutes && (
                              <span>{scenario.session_time_limit_minutes} min</span>
                            )}
                            <VoiceBadge voiceIds={scenario.voice_ids} />
                          </div>

                          {scenario.scenario_type === 'theory' && (
                            <div className="mt-4">
                              <span className="text-sm font-medium text-gray-700">{t('manager.tracks.topics')}</span>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {scenario.topic_ids && scenario.topic_ids.length > 0 ? (
                                  scenario.topic_ids.map((topicId) => (
                                    <TopicTag key={topicId} topicId={topicId} companyId={user?.company_id || ''} />
                                  ))
                                ) : (
                                  <span className="text-sm text-gray-500 italic">{t('manager.tracks.noTopicsAssigned')}</span>
                                )}
                              </div>
                            </div>
                          )}

                          {scenario.scenario_type === 'recommendations' && (
                            <div className="mt-4 space-y-2">
                              <div>
                                <span className="text-sm font-medium text-gray-700">{t('manager.tracks.questionsLabel')}</span>
                                <div className="mt-1">
                                  {scenario.recommendation_question_ids && scenario.recommendation_question_ids.length > 0 ? (
                                    <span className="text-sm text-gray-600">
                                      {t('manager.tracks.recommendationQuestionsSelected', {
                                        count: scenario.recommendation_question_ids.length,
                                        plural: scenario.recommendation_question_ids.length === 1 ? '' : 's'
                                      })}
                                    </span>
                                  ) : (
                                    <span className="text-sm text-gray-500 italic">{t('manager.tracks.noQuestionsAssigned')}</span>
                                  )}
                                </div>
                              </div>
                              {scenario.instructions && (
                                <div>
                                  <span className="text-sm font-medium text-gray-700">{t('manager.tracks.instructions')}</span>
                                  <p className="text-sm text-gray-600 mt-1">{scenario.instructions}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="ml-4 flex-shrink-0 flex space-x-2">
                          <button
                            onClick={() => handleEditScenario(scenario)}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            {t('manager.tracks.edit')}
                          </button>
                          <button
                            onClick={() => handleDeleteScenario(scenario.id)}
                            className="inline-flex items-center px-3 py-2 border border-red-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            {t('manager.tracks.delete')}
                          </button>
                                </div>
                              </div>
                            </div>
                          </SortableScenarioCard>
                        ))}
                      </SortableContext>
                    </DndContext>
                  )
                })()}
              </div>
            </div>
          </div>
        ) : activeTab === 'progress' ? (
          /* Progress View - Employee Training Progress */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Employee List - Left Side */}
            <div className="lg:col-span-1">
              <EmployeeProgressList
                companyId={companyId}
                selectedEmployeeId={selectedEmployee?.id || null}
                onSelectEmployee={setSelectedEmployee}
              />
            </div>

            {/* Employee Dashboard OR Analytics - Right Side */}
            <div className="lg:col-span-2">
              {selectedEmployee ? (
                <EmployeeDashboardView employee={selectedEmployee} />
              ) : (
                <>
                  <EmployeeSkillComparison companyId={companyId} />
                  <ServicePracticeAnalyticsDashboard companyId={companyId} />
                </>
              )}
            </div>
          </div>
        ) : null}

        {/* Track Form Modal */}
        {showTrackForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900">{t('manager.tracks.createNewTrack')}</h3>
              </div>
              <TrackForm
                companyId={companyId}
                onSuccess={handleTrackCreated}
                onCancel={() => setShowTrackForm(false)}
              />
            </div>
          </div>
        )}

        {/* Scenario Form Modal */}
        {showScenarioForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900">{t('manager.tracks.createNewScenario')}</h3>
                {selectedTrack && (
                  <p className="text-sm text-gray-600">{t('manager.tracks.addingTo')} {selectedTrack.name}</p>
                )}
              </div>
              <ScenarioForm
                companyId={companyId}
                tracks={selectedTrack ? [selectedTrack] : tracks}
                onSuccess={handleScenarioCreated}
                onCancel={() => setShowScenarioForm(false)}
              />
            </div>
          </div>
        )}

        {/* Edit Scenario Form Modal */}
        {showEditScenarioForm && editingScenario && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900">{t('manager.tracks.editScenario')}</h3>
                <p className="text-sm text-gray-600">{t('manager.tracks.editing')} {editingScenario.title}</p>
              </div>
              <EditScenarioForm
                scenario={editingScenario}
                companyId={companyId}
                tracks={tracks}
                onSuccess={handleScenarioUpdated}
                onCancel={() => {
                  setShowEditScenarioForm(false)
                  setEditingScenario(null)
                }}
              />
            </div>
          </div>
        )}

        {/* Add Scenarios Dialog */}
        {showAddScenariosDialog && selectedTrack && (
          <AddScenariosDialog
            isOpen={showAddScenariosDialog}
            trackId={selectedTrack.id}
            companyId={companyId}
            onAdd={handleAddScenarios}
            onClose={() => setShowAddScenariosDialog(false)}
          />
        )}

        {/* Edit Track Form Modal */}
        {showEditTrackForm && editingTrack && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900">{t('manager.tracks.editTrack')}</h3>
                <p className="text-sm text-gray-600">{t('manager.tracks.editing')} {editingTrack.name}</p>
              </div>
              <TrackForm
                companyId={companyId}
                track={editingTrack}
                onSuccess={handleTrackUpdated}
                onCancel={() => {
                  setShowEditTrackForm(false)
                  setEditingTrack(null)
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Batch Analysis Bar */}
      {companyId && <BatchAnalysisBar companyId={companyId} />}
    </div>
  )
}