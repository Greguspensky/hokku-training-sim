/**
 * VideoRecordingService
 *
 * Encapsulates all video recording logic including:
 * - Camera and microphone access
 * - Audio mixing (user voice + TTS audio)
 * - Cross-platform MIME type detection
 * - Recording chunk management
 * - Cleanup and error handling
 */

export interface VideoRecordingConfig {
  aspectRatio: '16:9' | '9:16' | '4:3' | '1:1'
  enableAudioMixing?: boolean
  videoBitrate?: number // bits per second
  tabAudioStream?: MediaStream // Optional tab audio for ElevenLabs conversation capture
}

export interface RecordingChunks {
  chunks: Blob[]
  mimeType: string
  duration: number
}

export interface AudioMixingNodes {
  audioContext: AudioContext
  micSource: MediaStreamAudioSourceNode
  destination: MediaStreamAudioDestinationNode
}

export class VideoRecordingService {
  private mediaRecorder: MediaRecorder | null = null
  private videoChunks: Blob[] = []
  private mimeType: string = 'video/webm'
  private startTime: number = 0
  private videoStream: MediaStream | null = null

  // Audio mixing nodes (if enabled)
  private audioContext: AudioContext | null = null
  private micSource: MediaStreamAudioSourceNode | null = null
  private recordingDestination: MediaStreamAudioDestinationNode | null = null

  // Stop promise resolver
  private stopResolver: (() => void) | null = null

  /**
   * Start video recording with optional audio mixing capability
   */
  async startRecording(config: VideoRecordingConfig): Promise<AudioMixingNodes | null> {
    console.log('🎬 VideoRecordingService: Starting recording', config)

    try {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      const dimensions = this.getVideoDimensions(config.aspectRatio)

      console.log('📱 Device type:', isMobile ? 'Mobile' : 'Desktop')
      console.log('📐 Requested dimensions:', `${dimensions.width}x${dimensions.height}`)

      // Get camera and microphone streams
      const micStream = await this.getUserMedia(isMobile, dimensions)
      this.videoStream = micStream

      // Log actual stream settings
      const videoTrack = micStream.getVideoTracks()[0]
      const settings = videoTrack.getSettings()
      console.log('✅ Actual stream dimensions:')
      console.log(`   Width: ${settings.width}`)
      console.log(`   Height: ${settings.height}`)
      console.log(`   Facing Mode: ${settings.facingMode}`)

      let mixingNodes: AudioMixingNodes | null = null
      let finalStream: MediaStream

      if (config.enableAudioMixing) {
        // Create audio mixing setup (with optional tab audio)
        mixingNodes = await this.setupAudioMixing(micStream, config.tabAudioStream)

        // Combine video with mixed audio
        const mixedAudioTrack = mixingNodes.destination.stream.getAudioTracks()[0]
        finalStream = new MediaStream([videoTrack, mixedAudioTrack])

        if (config.tabAudioStream) {
          console.log('🎵 Audio mixing enabled - microphone + tab audio (ElevenLabs)')
        } else {
          console.log('🎵 Audio mixing enabled - microphone + TTS audio (URLs)')
        }
      } else {
        // Use original stream without mixing
        finalStream = micStream
        console.log('🎤 Standard recording - microphone only')
      }

      // Detect supported MIME type
      this.mimeType = this.getSupportedMimeType()

      // Configure MediaRecorder
      const videoBitrate = config.videoBitrate || (isMobile ? 1000000 : 2500000)
      console.log(`📹 Bitrate: ${videoBitrate / 1000000} Mbps`)

      this.mediaRecorder = new MediaRecorder(finalStream, {
        mimeType: this.mimeType,
        videoBitsPerSecond: videoBitrate
      })

      // Clear previous chunks
      this.videoChunks = []
      this.startTime = Date.now()

      // Setup event handlers
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.videoChunks.push(event.data)
          console.log(`📹 Chunk recorded: ${event.data.size} bytes, total: ${this.videoChunks.length}`)
        }
      }

      this.mediaRecorder.onstop = () => {
        console.log(`🔄 Recording stopped, ${this.videoChunks.length} chunks collected`)
        this.cleanup()

        if (this.stopResolver) {
          this.stopResolver()
          this.stopResolver = null
        }
      }

      this.mediaRecorder.onerror = (event: any) => {
        console.error('❌ MediaRecorder error:', event.error)
      }

      // Start recording (collect chunks every second)
      this.mediaRecorder.start(1000)
      console.log('✅ VideoRecordingService: Recording started')

      return mixingNodes

    } catch (error) {
      console.error('❌ VideoRecordingService: Failed to start recording', error)
      this.cleanup()
      throw error
    }
  }

  /**
   * Stop recording and return all collected chunks
   */
  async stopRecording(): Promise<RecordingChunks> {
    console.log('🛑 VideoRecordingService: Stopping recording')

    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      console.warn('⚠️ MediaRecorder not active')
      return {
        chunks: this.videoChunks,
        mimeType: this.mimeType,
        duration: 0
      }
    }

    // Create promise to wait for recording to fully stop
    const stopPromise = new Promise<void>((resolve) => {
      this.stopResolver = resolve
    })

    // Stop the recorder (will trigger onstop handler)
    this.mediaRecorder.stop()

    // Wait for cleanup to complete
    await stopPromise

    const duration = Math.round((Date.now() - this.startTime) / 1000)

    console.log('✅ VideoRecordingService: Recording stopped')
    console.log(`📊 Final stats: ${this.videoChunks.length} chunks, ${duration}s duration`)

    return {
      chunks: [...this.videoChunks],
      mimeType: this.mimeType,
      duration
    }
  }

  /**
   * Mix TTS audio into the recording stream
   * Must be called AFTER startRecording if audio mixing is enabled
   */
  async mixTTSAudio(audioUrl: string): Promise<void> {
    if (!this.audioContext || !this.recordingDestination) {
      console.warn('⚠️ Audio mixing not enabled - call startRecording with enableAudioMixing: true')
      return
    }

    try {
      console.log('🎵 Starting non-blocking TTS audio mix...')
      const startTime = Date.now()

      // Fetch audio data
      const response = await fetch(audioUrl)
      const arrayBuffer = await response.arrayBuffer()
      console.log(`📥 Fetched audio: ${(arrayBuffer.byteLength / 1024).toFixed(1)}KB`)

      // Start decoding in BACKGROUND (don't await yet)
      // This allows the function to return immediately while decode happens async
      const decodePromise = this.audioContext.decodeAudioData(arrayBuffer)
        .then(audioBuffer => {
          console.log(`🎵 Decoded audio in background: ${audioBuffer.duration.toFixed(2)}s (took ${Date.now() - startTime}ms)`)

          // Mix into recording when ready
          const bufferSource = this.audioContext!.createBufferSource()
          bufferSource.buffer = audioBuffer
          bufferSource.connect(this.recordingDestination!)
          bufferSource.start()

          console.log('✅ TTS audio mixed into recording')
          return audioBuffer
        })
        .catch(error => {
          console.error('❌ Background decode failed:', error)
          // Don't throw - this is background work, shouldn't break main flow
        })

      // Return immediately without waiting for decode
      // The decode will finish in background and mix when ready
      console.log(`⚡ mixTTSAudio returning immediately (decode in progress...)`)

    } catch (error) {
      console.error('❌ Failed to start TTS audio mix:', error)
      throw error
    }
  }

  /**
   * Dynamically add live audio stream to recording (e.g., ElevenLabs agent speech)
   * Can be called AFTER recording has started when agent begins speaking
   * Works on all platforms: Desktop + Mobile
   */
  addLiveAudioStream(audioStream: MediaStream): void {
    if (!this.audioContext || !this.recordingDestination) {
      console.warn('⚠️ Audio mixing not enabled - cannot add live audio')
      return
    }

    try {
      console.log('🎵 Adding live audio stream to recording (cross-platform)...')

      // Create audio source from the live stream
      const liveAudioSource = this.audioContext.createMediaStreamSource(audioStream)

      // Connect to recording destination
      liveAudioSource.connect(this.recordingDestination)

      console.log('✅ Live audio stream connected to recording')
      console.log('   Platform: Works on Desktop (Chrome/Safari) + Mobile (iOS/Android)')

    } catch (error) {
      console.error('❌ Failed to add live audio stream:', error)
    }
  }

  /**
   * Get the video preview stream for displaying in UI
   */
  getPreviewStream(): MediaStream | null {
    return this.videoStream
  }

  /**
   * Check if recording is currently active
   */
  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }

  // ==================== Private Helper Methods ====================

  private getVideoDimensions(ratio: string) {
    switch (ratio) {
      case '16:9':
        return { width: 1280, height: 720 }
      case '9:16':
        return { width: 720, height: 1280 }
      case '4:3':
        return { width: 640, height: 480 }
      case '1:1':
        return { width: 720, height: 720 }
      default:
        return { width: 1280, height: 720 }
    }
  }

  private async getUserMedia(isMobile: boolean, dimensions: { width: number, height: number }): Promise<MediaStream> {
    const videoConstraints: MediaTrackConstraints = {
      facingMode: 'user'
    }

    // Only add dimension hints for desktop
    if (!isMobile) {
      videoConstraints.width = { ideal: dimensions.width }
      videoConstraints.height = { ideal: dimensions.height }
      videoConstraints.aspectRatio = { ideal: dimensions.width / dimensions.height }
    }

    if (isMobile) {
      // iOS workaround: Request video and audio separately
      console.log('📱 Mobile: Requesting video and audio separately')

      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints
      })

      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true
      })

      const videoTrack = videoStream.getVideoTracks()[0]
      const audioTrack = audioStream.getAudioTracks()[0]

      return new MediaStream([videoTrack, audioTrack])
    } else {
      // Desktop: Request both together
      return navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: true
      })
    }
  }

  private async setupAudioMixing(micStream: MediaStream, tabAudioStream?: MediaStream): Promise<AudioMixingNodes> {
    console.log('🎵 Setting up audio mixing...')

    // Create audio context
    const audioContext = new AudioContext()
    this.audioContext = audioContext

    // Resume if suspended
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
      console.log('🎵 AudioContext resumed')
    }

    // Create audio sources and destination
    const micSource = audioContext.createMediaStreamSource(micStream)
    const destination = audioContext.createMediaStreamDestination()

    // Connect microphone to destination
    micSource.connect(destination)
    console.log('✅ Microphone connected to recording destination')

    // Mix in tab audio if provided (for ElevenLabs conversation capture)
    if (tabAudioStream && tabAudioStream.getAudioTracks().length > 0) {
      const tabAudioSource = audioContext.createMediaStreamSource(tabAudioStream)
      tabAudioSource.connect(destination)
      console.log('✅ Tab audio (ElevenLabs) connected to recording destination')
    }

    // Store references
    this.micSource = micSource
    this.recordingDestination = destination

    console.log('✅ Audio mixing setup complete')

    return {
      audioContext,
      micSource,
      destination
    }
  }

  private getSupportedMimeType(): string {
    const types = [
      'video/mp4',                    // iOS Safari requirement
      'video/webm;codecs=vp8,opus',  // Modern browsers with audio
      'video/webm;codecs=vp8',       // Fallback without audio codec
      'video/webm'                   // Legacy fallback
    ]

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log(`📹 Using MIME type: ${type}`)
        return type
      }
    }

    console.warn('⚠️ No supported video MIME type found, using video/webm')
    return 'video/webm'
  }

  private cleanup() {
    console.log('🧹 Cleaning up video recording resources...')

    // Stop all tracks in the video stream
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop())
      this.videoStream = null
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close()
      this.audioContext = null
    }

    // Clear references
    this.micSource = null
    this.recordingDestination = null

    console.log('✅ Cleanup complete')
  }
}
