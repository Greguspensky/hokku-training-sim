# Session Saving UX Improvements
**Priority: CRITICAL** - Users losing sessions by closing page too early

## Problem Statement
Users are closing the page immediately after clicking "Finish Session", causing data loss because:
1. No visual feedback that save is in progress
2. No warning when closing page during save
3. Users don't understand they need to wait
4. Sessions are lost forever (only ElevenLabs conversation remains)

## Current Flow Issues
```
User clicks "Finish Session"
  ↓
🔴 NO VISUAL FEEDBACK (user thinks it's done)
  ↓
Save to database (2-3 seconds)
  ↓
Upload video (10-30 seconds)
  ↓
Redirect to transcript page

❌ If user closes before redirect = DATA LOSS
```

## Required Fixes

### Fix 1: Add Loading Overlay (CRITICAL)
**File**: `src/components/ElevenLabsAvatarSession.tsx`

Add state for save progress:
```typescript
const [saveProgress, setSaveProgress] = useState<{
  isActive: boolean;
  step: 'saving' | 'uploading' | 'completing' | 'done';
  message: string;
  canClose: boolean;
}>({
  isActive: false,
  step: 'saving',
  message: '',
  canClose: true
});
```

Add overlay component:
```tsx
{saveProgress.isActive && (
  <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
    <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
      <div className="text-center">
        {/* Spinner */}
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4" />

        {/* Progress Steps */}
        <div className="space-y-2 mb-6">
          <div className={`flex items-center justify-center gap-2 ${
            saveProgress.step === 'saving' ? 'text-blue-600 font-semibold' : 'text-gray-400'
          }`}>
            {saveProgress.step !== 'saving' && '✓'} Saving session...
          </div>
          <div className={`flex items-center justify-center gap-2 ${
            saveProgress.step === 'uploading' ? 'text-blue-600 font-semibold' : 'text-gray-400'
          }`}>
            {['completing', 'done'].includes(saveProgress.step) && '✓'} Uploading recording...
          </div>
          <div className={`flex items-center justify-center gap-2 ${
            saveProgress.step === 'completing' ? 'text-blue-600 font-semibold' : 'text-gray-400'
          }`}>
            {saveProgress.step === 'done' && '✓'} Finalizing...
          </div>
        </div>

        {/* Message */}
        <p className="text-gray-600 mb-4">{saveProgress.message}</p>

        {/* Warning */}
        {!saveProgress.canClose && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              ⚠️ Please do not close this page
            </p>
          </div>
        )}
      </div>
    </div>
  </div>
)}
```

### Fix 2: Update stopSession Function
**File**: `src/hooks/useElevenLabsConversation.ts`

Add progress callback parameter:
```typescript
const stopSession = useCallback(async (
  onProgress?: (step: string, message: string, canClose: boolean) => void
) => {
  try {
    onProgress?.('saving', 'Saving your session...', false);

    // ... existing code ...

    // After line 934 (session saved)
    onProgress?.('uploading', 'Uploading video recording...', false);

    // After line 947 (recording saved)
    onProgress?.('completing', 'Almost done...', false);

    // Before line 960 (redirect)
    onProgress?.('done', 'Redirecting to results...', true);

    // ... existing code ...
  } catch (error) {
    onProgress?.('done', '', true); // Allow close on error
    // ... existing error handling ...
  }
}, [/* dependencies */]);
```

### Fix 3: Add beforeunload Warning (CRITICAL)
**File**: `src/hooks/useElevenLabsConversation.ts`

Add effect to prevent accidental close:
```typescript
// Add state
const [isSaving, setIsSaving] = useState(false);

// Add effect
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (isSaving || session.isSavingRef.current) {
      e.preventDefault();
      e.returnValue = 'Your session is still being saved. Are you sure you want to leave?';
      return e.returnValue;
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [isSaving]);

// Update stopSession to set isSaving
const stopSession = useCallback(async () => {
  setIsSaving(true);
  try {
    // ... existing code ...
  } finally {
    setIsSaving(false);
  }
}, []);
```

### Fix 4: Add Progress Bar Component
**New File**: `src/components/Training/SessionSaveProgress.tsx`

```typescript
interface SessionSaveProgressProps {
  isActive: boolean;
  step: 'saving' | 'uploading' | 'completing' | 'done';
}

export function SessionSaveProgress({ isActive, step }: SessionSaveProgressProps) {
  if (!isActive) return null;

  const steps = [
    { id: 'saving', label: 'Saving session', duration: 3000 },
    { id: 'uploading', label: 'Uploading recording', duration: 20000 },
    { id: 'completing', label: 'Finalizing', duration: 2000 }
  ];

  const currentStepIndex = steps.findIndex(s => s.id === step);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-xl font-semibold mb-4 text-center">
          Saving Your Session
        </h2>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Steps */}
        <div className="space-y-3 mb-6">
          {steps.map((s, i) => (
            <div
              key={s.id}
              className={`flex items-center gap-3 ${
                i < currentStepIndex ? 'text-green-600' :
                i === currentStepIndex ? 'text-blue-600 font-semibold' :
                'text-gray-400'
              }`}
            >
              <div className="w-6 h-6 flex items-center justify-center">
                {i < currentStepIndex ? '✓' :
                 i === currentStepIndex ? '⟳' : '○'}
              </div>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Warning */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex items-start">
            <span className="text-2xl mr-2">⚠️</span>
            <div>
              <p className="text-sm font-medium text-yellow-800">
                Please wait
              </p>
              <p className="text-sm text-yellow-700">
                Do not close this page or refresh the browser
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Fix 5: Auto-Save Transcript During Session
**Enhancement**: Save transcript to database in real-time, not just at the end

Add to `useElevenLabsConversation.ts`:
```typescript
// Auto-save transcript every 30 seconds during active session
useEffect(() => {
  if (!isSessionActive || !session.sessionId) return;

  const interval = setInterval(async () => {
    const conversationId = conversationService?.getConversationId();
    if (!conversationId) return;

    try {
      // Fetch latest transcript from ElevenLabs
      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/transcript`,
        { headers: { 'xi-api-key': process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY! } }
      );

      if (response.ok) {
        const data = await response.json();
        // Save to database (upsert)
        await fetch('/api/training/auto-save-transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: session.sessionId,
            transcript: data.transcript
          })
        });
        console.log('💾 Auto-saved transcript');
      }
    } catch (error) {
      console.warn('⚠️ Auto-save transcript failed:', error);
    }
  }, 30000); // Every 30 seconds

  return () => clearInterval(interval);
}, [isSessionActive, session.sessionId, conversationService]);
```

## Implementation Priority

### Phase 1: Immediate (Prevent Data Loss) - Do This Now
1. ✅ beforeunload warning (Fix 3)
2. ✅ Loading overlay (Fix 1)
3. ✅ Progress callback (Fix 2)

### Phase 2: Short-term (Better UX)
4. ✅ Progress bar component (Fix 4)
5. ✅ Auto-save transcript (Fix 5)

### Phase 3: Long-term (Robustness)
6. Add retry logic for failed uploads
7. Store video locally in IndexedDB as backup
8. Add "Resume upload" feature for failed sessions

## Testing Checklist

After implementing fixes, test these scenarios:
- [ ] User clicks Finish → sees loading overlay
- [ ] User tries to close tab → sees browser warning
- [ ] User closes tab during upload → session still saves (without video)
- [ ] Slow connection → progress bar shows accurate state
- [ ] Upload fails → user sees error but session is saved
- [ ] Upload succeeds → smooth redirect to transcript

## Success Metrics

After implementation, we should see:
- **0% session loss** (currently unknown, but likely 10-20%)
- **0 orphaned ElevenLabs conversations** (sessions without database records)
- **100% session completion rate** (for started sessions)
- **Reduced support tickets** about missing sessions

## Related Documentation
- See `MANUAL_SESSION_RECOVERY.md` for recovering lost sessions
- See `VIDEO_RECORDING_FAILURE_THEORY_SERVICEPRACTICE_2026-02-08.md` for Safari iOS issues
