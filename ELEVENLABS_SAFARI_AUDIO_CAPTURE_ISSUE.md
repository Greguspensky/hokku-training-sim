# Prompt for ElevenLabs AI Assistant

Hi! I'm building a training platform using the ElevenLabs Conversational AI SDK and I have a critical technical challenge I need help with.

## The Problem
I need to record training sessions as videos that include both the trainee's voice (microphone) and the ElevenLabs AI agent's voice. I have this working perfectly in Chrome/Edge using `getDisplayMedia` for tab audio capture, but **Safari blocks this approach** due to its security restrictions around calling `getDisplayMedia` from async contexts.

## Current Implementation

### What Works (Chrome/Edge)
```javascript
// 1. Get microphone + camera
const micStream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
})

// 2. Create Web Audio API context for mixing
const audioContext = new AudioContext()
const micSource = audioContext.createMediaStreamSource(micStream)
const destination = audioContext.createMediaStreamDestination()
micSource.connect(destination)

// 3. Capture tab audio for ElevenLabs voice
const displayStream = await navigator.mediaDevices.getDisplayMedia({
  video: false,
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false
  }
})

// 4. Mix tab audio with microphone
const tabAudioSource = audioContext.createMediaStreamSource(displayStream.getAudioTracks()[0])
tabAudioSource.connect(destination)

// 5. Create combined video stream
const combinedStream = new MediaStream([
  micStream.getVideoTracks()[0],
  destination.stream.getAudioTracks()[0]
])

// 6. Record with MediaRecorder
const recorder = new MediaRecorder(combinedStream)
// Result: Video contains both microphone AND ElevenLabs AI voice ✅
```

### What Fails (Safari)
Safari throws error: **"getDisplayMedia must be called from a user gesture handler"**

The issue is that `getDisplayMedia` is called inside the ElevenLabs `onConnect` event handler (async), which Safari doesn't consider a valid "user gesture context."

## My Questions

### Question 1: Can I access the agent's audio output stream directly?
Does the ElevenLabs Conversational AI SDK expose the **outgoing audio stream** (the AI agent's voice) programmatically? What I'm looking for is something like:
```javascript
const conversation = await Conversation.startSession({
  agentId: 'agent_xxx',
  // ... other config
})

// Desired API:
const elevenLabsAudioStream = conversation.getOutputMediaStream()
// or
const elevenLabsAudioStream = conversation.getAudioOutputStream()

// Then we could mix it directly:
const elevenLabsSource = audioContext.createMediaStreamSource(elevenLabsAudioStream)
elevenLabsSource.connect(destination) // Mix with microphone
```

This would work in Safari without requiring `getDisplayMedia`, and would be more reliable than screen capture.

### Question 2: Is there a built-in recording feature?
Does the ElevenLabs SDK have a way to record conversations that includes both user and agent audio? Something like:
```javascript
const conversation = await Conversation.startSession({
  agentId: 'agent_xxx',
  recording: {
    enabled: true,
    includeVideo: true,  // Capture user's camera
    includeAgentAudio: true,
    includeUserAudio: true
  }
})

// After conversation ends:
const recordingBlob = await conversation.getRecording()
```

### Question 3: Can I control the audio output destination?
Can I route the ElevenLabs audio output through a specific audio element or audio node that I control? For example:
```javascript
const audioElement = document.createElement('audio')
audioElement.srcObject = // somehow get ElevenLabs stream

const conversation = await Conversation.startSession({
  agentId: 'agent_xxx',
  audioOutput: audioElement  // Use our controlled element
})

// Then we could capture it:
const stream = audioElement.captureStream()
const source = audioContext.createMediaStreamSource(stream)
source.connect(destination)
```

## Why This Matters for My Use Case

I'm building a training simulation platform where:
- Employees practice customer service scenarios
- The ElevenLabs AI agent plays the customer role
- Managers need to review video recordings that include BOTH the employee's responses AND the AI customer's dialogue

**Safari is critical because**:
- Many employees use MacBooks (Safari is default browser)
- iOS mobile training requires Safari (only browser option)
- Enterprise environments often mandate Safari usage
- Currently this limitation blocks ~30% of our users

## What I've Already Tried

✅ **Working in Chrome/Edge**:
- Using `getDisplayMedia` with tab audio sharing
- Web Audio API mixing
- MediaRecorder with combined streams
- Result: Perfect video recordings with both voices

❌ **Attempted in Safari**:
- Pre-requesting `getDisplayMedia` before session start → fails (no active conversation to capture yet)
- Calling from button click handlers → timing issues with async session initialization
- Using `getUserMedia` with echo cancellation disabled → only captures user, not AI voice

## Technical Details

**SDK Version**: `@elevenlabs/client` v0.6.2
**Connection Type**: WebRTC
**Framework**: Next.js 15.5.2 / React 19
**Target**: Chrome, Safari (Desktop + Mobile), Edge

**Current agent configuration**:
```javascript
{
  agentId: 'agent_xxx',
  language: 'en',
  connectionType: 'webrtc',
  dynamicVariables: { /* training context */ },
  overrides: {
    agent: {
      firstMessage: "...",
      language: "en"
    }
  }
}
```

## What I Need
1. Am I on the right track to solve this issue to capture video, my voice and eleven labs voice? 

2. **Bottom line**: I need a Safari-compatible way to capture the ElevenLabs AI agent's audio output for video recording purposes.

Direct audio stream access from the SDK would solve this problem completely. If that's not available, I'd appreciate any workarounds, alternative approaches, or roadmap information about this feature.

Can you help me find a solution? 

Thank you!
