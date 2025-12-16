'use client';

import { useState, useEffect } from 'react';
import SimpleFlipboardChat from '@/components/Training/SimpleFlipboardChat';
import { ElevenLabsAvatarSession } from '@/components/Training/ElevenLabsAvatarSession';
import { useAuth, getDemoSessionId } from '@/contexts/DemoContext';
import { Loader2, Mic, AlertCircle } from 'lucide-react';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '@/lib/languages';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface DemoScenario {
  id: string;
  title: string;
  description: string;
  scenario_type: string;
  employee_role: string;
  establishment_type: string;
  voice_ids?: string[];
  voice_id?: string;
}

const ELEVENLABS_AGENT_ID = 'agent_9301k5efjt1sf81vhzc3pjmw0fy9'; // Working agent (same as regular session)

const SUGGESTED_QUESTIONS = [
  "Wann öffnet das Spa?",
  "Possiamo avere il late checkout?",
  "What ski areas are best for beginners or kids?",
  "Where can we rent skis nearby?",
  "Is there a supermarket nearby?",
  "Which bus can i take to get to Carosello 3000? how far away is it from Mota?",
  "Can I book a massage for tomorrow?",
  "What time is breakfast?",
  "What time does the ski room open?",
  "The room feels a bit cold.",
];

export default function DemoFlipboardSession() {
  const { user } = useAuth();
  const [scenario, setScenario] = useState<DemoScenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [showVoiceSession, setShowVoiceSession] = useState(false);
  const [preChatMessages, setPreChatMessages] = useState<ConversationMessage[]>([
    {
      role: 'assistant',
      content: `Hi!
I'm the virtual receptionist at Hotel Mota here in Livigno.

You can message me or call me anytime for help with the hotel, ski areas, restaurants, or anything you need during your stay.

Try chatting with me in any language.

How can I help you today?`,
      timestamp: Date.now(),
    },
  ]);
  const [sessionId, setSessionId] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Load demo scenario on mount
  useEffect(() => {
    loadDemoScenario();
  }, []);

  // Start demo session when component mounts
  useEffect(() => {
    if (user && !sessionStarted) {
      startDemoSession();
    }
  }, [user, sessionStarted]);

  const loadDemoScenario = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/demo/load-scenario');

      if (!response.ok) {
        throw new Error('Failed to load demo scenario');
      }

      const data = await response.json();
      setScenario(data.scenario);
      setLoading(false);
    } catch (err: any) {
      console.error('❌ Error loading demo scenario:', err);
      setError(err.message || 'Failed to load demo. Please try again.');
      setLoading(false);
    }
  };

  const startDemoSession = async () => {
    try {
      const sessionUUID = getDemoSessionId(user);
      if (!sessionUUID) {
        throw new Error('Invalid demo session');
      }

      setSessionId(sessionUUID);

      const response = await fetch('/api/demo/start-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionUUID,
          language: 'en',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 429) {
          setError('You have reached the maximum number of demo sessions for this hour. Please try again later.');
          return;
        }
        throw new Error(data.error || 'Failed to start demo session');
      }

      const data = await response.json();
      console.log('✅ Demo session started:', data);
      setSessionStarted(true);
    } catch (err: any) {
      console.error('❌ Error starting demo session:', err);
      setError(err.message || 'Failed to start demo session');
    }
  };

  const handleStartVoiceSession = () => {
    setShowVoiceSession(true);
  };

  const handleSuggestionClick = async (question: string) => {
    // Add user question to messages
    const userMessage: ConversationMessage = {
      role: 'user',
      content: question,
      timestamp: Date.now(),
    };

    setPreChatMessages((prev) => [...prev, userMessage]);

    // Get AI response
    try {
      const response = await fetch('/api/demo/flipboard-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userMessage: question,
          conversationHistory: [...preChatMessages, userMessage],
          language: selectedLanguage,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      // Add AI response to messages
      const aiMessage: ConversationMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: Date.now(),
      };

      setPreChatMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error('❌ Error getting AI response:', err);
    }
  };

  const handleVoiceSessionEnd = async (sessionData: any) => {
    console.log('🏁 Voice session ended:', sessionData);

    // Save session data
    try {
      const allMessages = [...preChatMessages, ...(sessionData.conversationHistory || [])];

      await fetch('/api/demo/save-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          conversationTranscript: allMessages,
          sessionDurationSeconds: sessionData.durationSeconds || 0,
          messageCount: allMessages.length,
        }),
      });

      console.log('✅ Demo session saved');
    } catch (err) {
      console.error('❌ Error saving demo session:', err);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-lg shadow-lg p-12 text-center">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Loading Demo...</h3>
          <p className="text-gray-600">Preparing your Hotel Reception training experience</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-red-900 mb-2">Demo Unavailable</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-8 text-center">
          <p className="text-yellow-800">Demo scenario not found. Please contact support.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Demo Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <h1 className="text-xl sm:text-2xl md:text-4xl font-bold text-gray-900">
          Virtual receptionist demo
        </h1>
        <button
          onClick={handleStartVoiceSession}
          disabled={showVoiceSession}
          className="inline-flex items-center px-4 sm:px-6 py-2 sm:py-3 bg-green-600 text-white text-sm sm:text-lg font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
        >
          <Mic className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Call receptionist</span>
          <span className="inline sm:hidden">Call</span>
        </button>
      </div>

      {/* Main Content */}
      {!showVoiceSession ? (
        <div className="space-y-6">
          {/* Text Chat Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <SimpleFlipboardChat
              scenarioId={scenario.id}
              language={selectedLanguage}
              scenarioContext={{
                establishment_type: scenario.establishment_type,
                title: scenario.title,
                description: scenario.description,
              }}
              onMessagesChange={setPreChatMessages}
              initialMessages={preChatMessages}
            />

            {/* Suggested Questions */}
            {showSuggestions && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-3">💡 Try asking:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_QUESTIONS.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(question)}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 text-sm rounded-lg border border-indigo-200 hover:from-indigo-100 hover:to-purple-100 hover:border-indigo-300 transition-all shadow-sm hover:shadow-md"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        // Voice Session with Avatar
        <ElevenLabsAvatarSession
          companyId={user?.company_id || ''}
          scenarioId={scenario.id}
          scenarioContext={{
            type: 'flipboard',
            employee_role: scenario.employee_role,
            establishment_type: scenario.establishment_type,
            title: scenario.title,
            description: scenario.description,
          }}
          language={selectedLanguage}
          agentId={ELEVENLABS_AGENT_ID}
          voiceIds={scenario.voice_ids}
          voiceId={scenario.voice_id}
          avatarUrl="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face"
          recordingPreference="audio"
          hideStatusSections={true}
          onSessionEnd={handleVoiceSessionEnd}
        />
      )}
    </div>
  );
}
