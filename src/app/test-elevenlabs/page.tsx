'use client'

import React, { useState } from 'react'
import { ElevenLabsAvatarSession } from '@/components/ElevenLabsAvatarSession'
import { SUPPORTED_LANGUAGES, SupportedLanguageCode } from '@/lib/avatar-types'

export default function TestElevenLabsPage() {
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguageCode>('en')
  const [selectedScenario, setSelectedScenario] = useState<string>('demo-scenario-theory')

  const handleSessionEnd = (sessionData: any) => {
    console.log('🏁 Test session completed:', sessionData)
    alert('Test session completed! Check console for details.')
  }

  const handleLanguageChange = (languageCode: SupportedLanguageCode) => {
    setSelectedLanguage(languageCode)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ElevenLabs Conversational AI Test
          </h1>
          <p className="text-gray-600">
            Test the new ElevenLabs Conversational AI integration for avatar training sessions.
            This replaces the previous streaming conversation system.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Integration Status</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>✅ ElevenLabs SDK installed (@elevenlabs/client)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>✅ Token endpoint created (/api/elevenlabs-token)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>✅ ElevenLabsConversationService implemented</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>✅ ElevenLabsAvatarSession component created</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span>⚠️ Need to create ElevenLabs agent and configure custom LLM</span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <h3 className="font-semibold text-blue-900 mb-2">Next Steps Required:</h3>
          <ol className="list-decimal list-inside space-y-1 text-blue-800 text-sm">
            <li>Create an ElevenLabs Conversational AI Agent in the ElevenLabs dashboard</li>
            <li>Configure the agent to use ChatGPT as custom LLM with knowledge base context</li>
            <li>Get the Agent ID and update the test below</li>
            <li>Test the end-to-end conversation flow</li>
            <li>Integrate with the existing training system</li>
          </ol>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
          <h3 className="font-semibold text-green-900 mb-2">✅ Real Agent ID Configured</h3>
          <p className="text-green-800 text-sm">
            Using real ElevenLabs Agent ID: <code>agent_9301k5efjt1sf81vhzc3pjmw0fy9</code>
            <br />The integration is now ready to test with your configured agent.
          </p>
        </div>

        {/* Language Selection */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Language Selection</h2>
          <p className="text-gray-600 mb-4">
            Choose the language for your conversation with the AI trainer. The agent will respond in the selected language.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {SUPPORTED_LANGUAGES.map((language) => (
              <button
                key={language.code}
                onClick={() => handleLanguageChange(language.code)}
                className={`
                  flex items-center gap-2 p-3 rounded-lg border-2 transition-all duration-200 hover:shadow-md
                  ${selectedLanguage === language.code
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <span className="text-xl">{language.flag}</span>
                <div className="text-left">
                  <div className="font-medium text-sm">{language.name}</div>
                  <div className="text-xs opacity-75">{language.code.toUpperCase()}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Selected:</strong> {SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage)?.flag} {SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage)?.name} ({selectedLanguage.toUpperCase()})
            </p>
          </div>
        </div>

        {/* Scenario Selection */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Test Scenario Selection</h2>
          <p className="text-gray-600 mb-4">
            Choose a test scenario to see how knowledge-specific training works. Each scenario type uses different knowledge scoping.
          </p>

          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="scenario"
                value="demo-scenario-theory"
                checked={selectedScenario === 'demo-scenario-theory'}
                onChange={(e) => setSelectedScenario(e.target.value)}
                className="text-blue-600"
              />
              <div>
                <div className="font-medium">📖 Theory Q&A Scenario</div>
                <div className="text-sm text-gray-600">
                  Tests knowledge from assigned documents only (restricted scope)
                </div>
              </div>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="scenario"
                value="demo-scenario-service"
                checked={selectedScenario === 'demo-scenario-service'}
                onChange={(e) => setSelectedScenario(e.target.value)}
                className="text-blue-600"
              />
              <div>
                <div className="font-medium">🗣️ Service Practice Scenario</div>
                <div className="text-sm text-gray-600">
                  Customer roleplay with comprehensive company knowledge (broad scope)
                </div>
              </div>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="scenario"
                value=""
                checked={selectedScenario === ''}
                onChange={(e) => setSelectedScenario(e.target.value)}
                className="text-blue-600"
              />
              <div>
                <div className="font-medium">🔧 General Test (No Scenario)</div>
                <div className="text-sm text-gray-600">
                  Fallback to general company knowledge (for comparison)
                </div>
              </div>
            </label>
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Selected:</strong> {
                selectedScenario === 'demo-scenario-theory' ? '📖 Theory Q&A - Focused knowledge testing' :
                selectedScenario === 'demo-scenario-service' ? '🗣️ Service Practice - Comprehensive roleplay' :
                '🔧 General Test - Fallback mode'
              }
            </p>
          </div>
        </div>

        {/* Test ElevenLabs Avatar Session */}
        <ElevenLabsAvatarSession
          companyId="demo-company-1"
          scenarioId={selectedScenario || undefined}
          scenarioContext={{
            title: selectedScenario === 'demo-scenario-theory' ? "Theory Knowledge Test" :
                   selectedScenario === 'demo-scenario-service' ? "Customer Service Practice" :
                   "General Test Session",
            type: selectedScenario === 'demo-scenario-theory' ? "theory" : "service_practice",
            difficulty: "beginner"
          }}
          language={selectedLanguage}
          agentId="agent_9301k5efjt1sf81vhzc3pjmw0fy9" // Updated ElevenLabs agent ID
          onSessionEnd={handleSessionEnd}
          className="mb-8"
        />

        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold mb-4">Architecture Comparison</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-red-700 mb-2">❌ Old Streaming System (Broken)</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Manual MediaRecorder chunks</li>
                <li>• Whisper API for STT</li>
                <li>• Custom streaming conversation logic</li>
                <li>• ElevenLabs TTS API separately</li>
                <li>• Complex chunk accumulation</li>
                <li>• WebM format issues</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-green-700 mb-2">✅ New ElevenLabs Platform</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Integrated STT, LLM, and TTS</li>
                <li>• ElevenLabs Conversational AI SDK</li>
                <li>• WebRTC/WebSocket connection</li>
                <li>• ChatGPT as custom LLM</li>
                <li>• Sub-100ms latency</li>
                <li>• Built-in voice activity detection</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}