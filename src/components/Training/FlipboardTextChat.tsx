'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { useConversation } from '@elevenlabs/react';
import { supabase } from '@/lib/supabase';

// Message interface for chat messages
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface FlipboardTextChatProps {
  scenarioId: string;
  companyId: string;
  language: string;
  scenarioContext: {
    employee_role?: string;
    establishment_type?: string;
    first_message?: string;
    title?: string;
    description?: string;
  };
  onMessagesChange: (messages: ConversationMessage[]) => void;
  initialMessages?: ConversationMessage[];
  readOnly?: boolean;
}

export interface FlipboardTextChatRef {
  cleanup: () => void;
}

const AGENT_ID = 'agent_2801kbnwsg3vfekb430fw67th84d'; // Text-only agent for Flipboard mode

const FlipboardTextChat = forwardRef<FlipboardTextChatRef, FlipboardTextChatProps>(
  (
    {
      scenarioId,
      companyId,
      language,
      scenarioContext,
      onMessagesChange,
      initialMessages = [],
      readOnly = false
    },
    ref
  ) => {
    const [messages, setMessages] = useState<ConversationMessage[]>(initialMessages);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isInitializing, setIsInitializing] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const initializationAttempted = useRef(false);
    const mountedRef = useRef(true);
    const shouldCleanup = useRef(false);
    const endSessionRef = useRef<(() => void) | null>(null);
    const initialMessageSent = useRef(false);

    // Use the React SDK's useConversation hook with proper text-only support
    const conversation = useConversation({
      textOnly: true, // ✅ Properly disables all audio infrastructure
      onConnect: () => {
        console.log('✅ Text chat connected (React SDK)');
        setError(null);
        setIsInitializing(false);
        shouldCleanup.current = true; // Mark that we need to cleanup on unmount
      },
      onDisconnect: () => {
        console.log('🔌 Text chat disconnected (React SDK)');
        setIsInitializing(false);
        initializationAttempted.current = false;
        shouldCleanup.current = false; // No longer need to cleanup
      },
      onMessage: (message) => {
        console.log('📨 Message received:', message);
        console.log('📨 Message type:', message.type);
        console.log('📨 Message text:', message.text);
        console.log('📨 Full message object:', JSON.stringify(message, null, 2));

        // CRITICAL: Handle agent responses - required for text-only mode
        if (message.type === 'agent_response') {
          const text = message.text || '';
          console.log('🤖 Agent response:', text);

          const assistantMessage: ConversationMessage = {
            role: 'assistant',
            content: text,
            timestamp: Date.now()
          };

          setMessages((prevMessages) => {
            const updatedMessages = [...prevMessages, assistantMessage];
            onMessagesChange(updatedMessages);
            return updatedMessages;
          });
          setIsTyping(false);
        }

        // Handle user transcripts (if any)
        if (message.type === 'user_transcript') {
          const text = message.text || '';
          console.log('👤 User transcript:', text);
        }

        // Log any other message types for debugging
        if (!['agent_response', 'user_transcript'].includes(message.type)) {
          console.log('🔍 Other message type received:', message.type, message);
        }
      },
      onError: (error) => {
        console.error('❌ Text chat error:', error);
        setError('Connection error. Please try again.');
        setIsTyping(false);
        setIsInitializing(false);
        initializationAttempted.current = false;
      },
    });

    const { status, startSession, endSession, sendUserMessage } = conversation;

    // Keep endSession ref updated for cleanup
    endSessionRef.current = endSession;

    // Expose cleanup method to parent
    useImperativeHandle(ref, () => ({
      cleanup: async () => {
        if (status === 'connected') {
          await endSession();
          console.log('🔌 Text chat connection closed');
        }
      }
    }));

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    // Initialize text-only conversation with proper state guards
    const initializeConversation = useCallback(async () => {
      // Prevent multiple initialization attempts
      if (isInitializing || initializationAttempted.current) {
        console.log('🚫 Initialization already in progress or completed');
        return;
      }

      // Check if already connected
      if (status === 'connected') {
        console.log('✅ Already connected');
        return;
      }

      try {
        setIsInitializing(true);
        initializationAttempted.current = true;
        setError(null);

        console.log('🔄 Starting text-only conversation for Flipboard...');

        // Fetch scenario data
        const { data: scenario, error: scenarioError } = await supabase
          .from('scenarios')
          .select('*')
          .eq('id', scenarioId)
          .single();

        if (scenarioError || !scenario) {
          throw new Error('Failed to load scenario');
        }

        console.log('📚 Using agent\'s built-in knowledge for text chat');

        // Start session with the React SDK
        // Note: Removed conversation override - textOnly in useConversation should handle it
        await startSession({
          agentId: AGENT_ID,
          overrides: {
            agent: {
              language: {
                code: language
              },
              prompt: {
                prompt: `You are a training assistant for ${scenarioContext.establishment_type || 'our establishment'}. ${scenarioContext.description || ''}`,
              }
            }
            // Removed: conversation: { text_only: true } - may conflict with textOnly: true in useConversation
          }
        });

        console.log('✅ Text-only conversation started successfully');
      } catch (err: any) {
        console.error('❌ Failed to start conversation:', err);
        setError('Failed to connect to chat. Please try again.');
        setIsInitializing(false);
        initializationAttempted.current = false;
      }
    }, [scenarioId, language, status, isInitializing, startSession, scenarioContext.establishment_type, scenarioContext.description]);

    // Initialize conversation on mount (only once)
    useEffect(() => {
      mountedRef.current = true;

      // Only initialize if we haven't attempted yet and we're not connected
      if (!initializationAttempted.current && status !== 'connected') {
        // Small delay to handle React Strict Mode
        const timer = setTimeout(() => {
          if (mountedRef.current) {
            initializeConversation();
          }
        }, 100);

        return () => clearTimeout(timer);
      }
    }, [scenarioId, status, initializeConversation]);

    // Separate cleanup effect (only on unmount)
    useEffect(() => {
      return () => {
        mountedRef.current = false;
        // Only cleanup if we successfully connected
        if (shouldCleanup.current && endSessionRef.current) {
          console.log('🧹 Cleaning up connection on unmount...');
          endSessionRef.current();
          shouldCleanup.current = false;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty array = only runs on mount/unmount

    // EXPERIMENT: Send initial message when connected to keep session alive
    useEffect(() => {
      if (status === 'connected' && !initialMessageSent.current && !isInitializing) {
        console.log('💬 Preparing to send initial greeting...');
        initialMessageSent.current = true;

        // Add a small delay to ensure connection is fully established
        const timer = setTimeout(() => {
          console.log('💬 Sending initial greeting now...');
          try {
            const result = sendUserMessage({ text: 'Hello' });
            console.log('✅ Initial greeting sent, result:', result);
          } catch (err) {
            console.error('❌ Failed to send initial greeting:', err);
            initialMessageSent.current = false; // Allow retry
          }
        }, 500); // 500ms delay to ensure connection is fully established

        return () => clearTimeout(timer);
      }

      // Reset flag when disconnected
      if (status === 'disconnected') {
        initialMessageSent.current = false;
      }
    }, [status, isInitializing, sendUserMessage]);

    // Send message handler
    const handleSendMessage = async () => {
      if (!inputText.trim() || status !== 'connected') return;

      const userMessage: ConversationMessage = {
        role: 'user',
        content: inputText.trim(),
        timestamp: Date.now()
      };

      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages, userMessage];
        onMessagesChange(updatedMessages);
        return updatedMessages;
      });
      setInputText('');
      setIsTyping(true);

      console.log('👤 User:', userMessage.content);

      try {
        // Use React SDK method for sending text messages
        await sendUserMessage({ text: userMessage.content });
      } catch (err: any) {
        console.error('❌ Failed to send message:', err);
        setError('Failed to send message. Please try again.');
        setIsTyping(false);
      }
    };

    // Handle Enter key press
    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    };

    const isConnected = status === 'connected';
    // isInitializing is now managed as state (line 53), not derived from status

    return (
      <div className="bg-white rounded-lg shadow-md p-4 h-[500px] md:h-[60vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b">
          <h3 className="text-lg font-semibold text-indigo-900">
            💬 Text Chat Warm-up
          </h3>
          <span
            className={`text-xs px-2 py-1 rounded ${
              isConnected
                ? 'bg-green-100 text-green-800'
                : isInitializing
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {isConnected ? '● Connected' : isInitializing ? '○ Connecting...' : '○ Disconnected'}
          </span>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-xs text-red-600 underline hover:text-red-800"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-4 px-2">
          {messages.length === 0 && isConnected && !isInitializing && (
            <div className="text-center text-gray-500 text-sm py-8">
              Start by asking a question about the business!
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p
                  className={`text-xs mt-1 ${
                    msg.role === 'user' ? 'text-indigo-200' : 'text-gray-500'
                  }`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              readOnly
                ? 'Voice session active...'
                : !isConnected
                ? 'Connecting...'
                : 'Ask a question...'
            }
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            disabled={!isConnected || readOnly || isInitializing}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || !isConnected || readOnly || isInitializing}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>

        {readOnly && (
          <div className="mt-2 text-xs text-gray-500 text-center">
            🎤 Voice session active - text chat is now read-only
          </div>
        )}
      </div>
    );
  }
);

FlipboardTextChat.displayName = 'FlipboardTextChat';

export default FlipboardTextChat;
