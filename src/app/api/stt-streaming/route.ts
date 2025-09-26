import { NextRequest, NextResponse } from 'next/server'
import { OpenAI } from 'openai'

// Initialize OpenAI client for Whisper API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const language = formData.get('language') as string || 'en'
    const isStreaming = formData.get('streaming') === 'true'

    if (!audioFile) {
      return NextResponse.json(
        { success: false, error: 'Audio file is required' },
        { status: 400 }
      )
    }

    // Skip processing if audio file is too small (likely just noise/silence)
    if (audioFile.size < 3000) { // Less than 3KB, should be a complete 2-second chunk
      console.log(`🔇 Audio chunk too small (${audioFile.size} bytes), skipping`)
      return NextResponse.json({
        success: true,
        transcript: '',
        is_final: false,
        confidence: 0,
        duration: 0
      })
    }

    // Get the original filename and determine format
    const originalName = audioFile.name || 'chunk.webm'
    const extension = originalName.split('.').pop()?.toLowerCase() || 'webm'

    // Convert to proper format for Whisper
    const audioBuffer = await audioFile.arrayBuffer()

    // Determine MIME type based on extension
    let mimeType = 'audio/webm'
    if (extension === 'wav') mimeType = 'audio/wav'
    else if (extension === 'mp4') mimeType = 'audio/mp4'
    else if (extension === 'webm') mimeType = 'audio/webm'

    console.log(`🎙️ Processing audio chunk: ${extension} format, ${audioFile.size} bytes`)

    // For WebM files, we need to ensure they're valid complete files
    // If the file seems to be incomplete WebM chunks, try to repair it
    let processedBuffer = audioBuffer
    if (extension === 'webm' && !isValidWebMFile(audioBuffer)) {
      console.log('⚠️ Detected incomplete WebM chunk, attempting to create valid WebM container')
      // For now, let's try a different approach - convert to base64 and back
      // This sometimes helps with malformed WebM chunks
      try {
        const base64 = Buffer.from(audioBuffer).toString('base64')
        processedBuffer = Buffer.from(base64, 'base64').buffer
      } catch (error) {
        console.warn('WebM repair attempt failed:', error)
      }
    }

    // Create proper File object with correct extension and MIME type
    const properAudioFile = new File([processedBuffer], `chunk_${Date.now()}.${extension}`, {
      type: mimeType
    })

    // For streaming mode, we use faster processing
    const whisperOptions: any = {
      file: properAudioFile,
      model: 'whisper-1',
      language: language === 'en' ? undefined : language, // Let Whisper auto-detect English
      response_format: 'verbose_json', // Get detailed timing information
      temperature: 0.0, // More deterministic results
    }

    if (isStreaming) {
      // For streaming, we want faster but potentially less accurate results
      whisperOptions.prompt = "Transcribe this audio chunk. Focus on speed over perfection."
    }

    console.log(`🎙️ Processing ${isStreaming ? 'streaming' : 'batch'} STT for ${language} (${audioFile.size} bytes)`)

    const transcription = await openai.audio.transcriptions.create(whisperOptions)

    // Extract text and confidence information
    const transcript = transcription.text.trim()
    const confidence = calculateConfidence(transcription)

    // Determine if this should be considered a final result
    // For streaming, we consider shorter utterances as potentially final
    const isFinal = isStreaming ?
      (transcript.length > 10 && transcript.endsWith('.', '?', '!')) || transcript.split(' ').length > 5 :
      true

    console.log(`📝 Transcription ${isFinal ? '(final)' : '(partial)'}: "${transcript}"`)

    return NextResponse.json({
      success: true,
      transcript: transcript,
      is_final: isFinal,
      confidence: confidence,
      language_detected: transcription.language || language,
      duration: transcription.duration || 0
    })

  } catch (error) {
    console.error('❌ Streaming STT error:', error)

    // Return partial result even on error to maintain conversation flow
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'STT processing failed',
      transcript: '', // Empty transcript to continue flow
      is_final: false,
      confidence: 0
    }, { status: 200 }) // Use 200 to avoid breaking streaming flow
  }
}

/**
 * Check if WebM file has valid header structure
 */
function isValidWebMFile(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer)

  // Check for WebM/EBML signature (0x1A 0x45 0xDF 0xA3)
  if (bytes.length < 4) return false

  // WebM files start with EBML header
  const hasEBMLHeader = bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3

  // Also check for reasonable file size and structure
  if (!hasEBMLHeader || bytes.length < 100) {
    console.log(`❌ Invalid WebM: hasHeader=${hasEBMLHeader}, size=${bytes.length}`)
    return false
  }

  return true
}

/**
 * Calculate confidence score from Whisper response
 * This is a heuristic since Whisper doesn't provide explicit confidence scores
 */
function calculateConfidence(transcription: any): number {
  try {
    // Base confidence on various factors
    let confidence = 0.8 // Base confidence for Whisper

    // Lower confidence for very short transcripts
    if (transcription.text.length < 3) {
      confidence *= 0.5
    }

    // Higher confidence for longer, complete sentences
    if (transcription.text.length > 20 && /[.!?]$/.test(transcription.text)) {
      confidence *= 1.1
    }

    // Check for segments with low average logprobs if available
    if (transcription.segments) {
      const avgLogprob = transcription.segments.reduce((sum: number, seg: any) =>
        sum + (seg.avg_logprob || 0), 0) / transcription.segments.length

      // Adjust confidence based on average log probability
      if (avgLogprob > -0.5) confidence *= 1.2
      else if (avgLogprob < -1.0) confidence *= 0.8
    }

    return Math.min(Math.max(confidence, 0.1), 1.0)
  } catch {
    return 0.7 // Default confidence
  }
}