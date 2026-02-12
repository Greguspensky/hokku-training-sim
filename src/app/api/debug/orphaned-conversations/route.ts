/**
 * Debug endpoint to find orphaned ElevenLabs conversations
 * (conversations that exist in ElevenLabs but not in our database)
 *
 * GET /api/debug/orphaned-conversations?timeframe_hours=24
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY!

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeframeHours = parseInt(searchParams.get('timeframe_hours') || '24')
    const userId = searchParams.get('user_id') // Optional filter by user

    console.log(`🔍 Searching for orphaned conversations in last ${timeframeHours} hours`)

    // Step 1: Get all recent conversations from ElevenLabs
    const elevenLabsResponse = await fetch(
      'https://api.elevenlabs.io/v1/convai/conversations',
      {
        headers: {
          'xi-api-key': elevenLabsApiKey
        }
      }
    )

    if (!elevenLabsResponse.ok) {
      throw new Error(`ElevenLabs API error: ${elevenLabsResponse.status}`)
    }

    const elevenLabsData = await elevenLabsResponse.json()
    const allConversations = elevenLabsData.conversations || []

    console.log(`📞 Found ${allConversations.length} total conversations in ElevenLabs`)

    // Filter by timeframe
    const cutoffTime = new Date(Date.now() - timeframeHours * 60 * 60 * 1000)
    const recentConversations = allConversations.filter((conv: any) => {
      const convTime = new Date(conv.start_time_unix_secs * 1000)
      return convTime >= cutoffTime
    })

    console.log(`⏰ ${recentConversations.length} conversations in last ${timeframeHours} hours`)

    // Step 2: Get all sessions from our database
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let query = supabase
      .from('training_sessions')
      .select('elevenlabs_conversation_id, user_id, employee_id, scenario_id, started_at')
      .not('elevenlabs_conversation_id', 'is', null)

    if (userId) {
      query = query.or(`user_id.eq.${userId},employee_id.eq.${userId}`)
    }

    const { data: sessions, error: sessionsError } = await query

    if (sessionsError) {
      console.error('❌ Error fetching sessions:', sessionsError)
    }

    const linkedConversationIds = new Set(
      sessions?.map(s => s.elevenlabs_conversation_id) || []
    )

    console.log(`💾 Found ${linkedConversationIds.size} linked conversations in database`)

    // Step 3: Find orphaned conversations
    const orphanedConversations = recentConversations
      .filter((conv: any) => !linkedConversationIds.has(conv.conversation_id))
      .map((conv: any) => {
        const startTime = new Date(conv.start_time_unix_secs * 1000)
        const endTime = conv.end_time_unix_secs
          ? new Date(conv.end_time_unix_secs * 1000)
          : null
        const duration = conv.end_time_unix_secs
          ? conv.end_time_unix_secs - conv.start_time_unix_secs
          : null

        return {
          conversation_id: conv.conversation_id,
          agent_id: conv.agent_id,
          started_at: startTime.toISOString(),
          ended_at: endTime?.toISOString() || 'Still active',
          duration_seconds: duration,
          duration_formatted: duration ? `${Math.floor(duration / 60)}m ${duration % 60}s` : 'N/A',
          status: conv.status,
          metadata: conv.metadata || {}
        }
      })

    console.log(`🔓 Found ${orphanedConversations.length} orphaned conversations`)

    // Step 4: Try to match orphaned conversations to users based on timing
    const userMatches = []

    if (orphanedConversations.length > 0) {
      // Get all users to match potential conversations
      const { data: users } = await supabase
        .from('users')
        .select('id, email, name, created_at')

      for (const conv of orphanedConversations) {
        const convStartTime = new Date(conv.started_at)

        // Look for users created around the same time (within 1 hour)
        const potentialUsers = users?.filter(user => {
          const userCreatedTime = new Date(user.created_at)
          const timeDiff = Math.abs(convStartTime.getTime() - userCreatedTime.getTime())
          return timeDiff < 60 * 60 * 1000 // 1 hour window
        }) || []

        if (potentialUsers.length > 0) {
          userMatches.push({
            conversation_id: conv.conversation_id,
            potential_users: potentialUsers.map(u => ({
              user_id: u.id,
              email: u.email,
              name: u.name,
              created_at: u.created_at
            })),
            confidence: potentialUsers.length === 1 ? 'high' : 'low'
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      timeframe_hours: timeframeHours,
      summary: {
        total_elevenlabs_conversations: allConversations.length,
        recent_conversations: recentConversations.length,
        linked_in_database: linkedConversationIds.size,
        orphaned_conversations: orphanedConversations.length
      },
      orphaned_conversations: orphanedConversations,
      potential_user_matches: userMatches,
      recovery_instructions: orphanedConversations.length > 0
        ? 'Use POST /api/debug/recover-session endpoint to manually link these conversations to sessions'
        : null
    })

  } catch (error) {
    console.error('❌ Error checking orphaned conversations:', error)
    return NextResponse.json(
      {
        error: 'Failed to check orphaned conversations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
