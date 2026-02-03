import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Finding users "Test" and "Lena Admin"...');

    // Find users by name
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email')
      .or('name.eq.Test,name.eq.Lena Admin');

    if (usersError) {
      console.error('❌ Error finding users:', usersError);
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        message: 'No users found with names "Test" or "Lena Admin"',
        deleted: 0
      });
    }

    console.log(`✅ Found ${users.length} user(s):`);
    users.forEach(user => {
      console.log(`   - ${user.name} (${user.email})`);
    });

    const userIds = users.map(u => u.id);

    // Count sessions for these users
    const { count, error: countError } = await supabase
      .from('training_sessions')
      .select('*', { count: 'exact', head: true })
      .in('employee_id', userIds);

    if (countError) {
      console.error('❌ Error counting sessions:', countError);
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    console.log(`📊 Total sessions to delete: ${count}`);

    if (count === 0) {
      return NextResponse.json({
        message: 'No sessions to delete',
        users: users.map(u => ({ name: u.name, email: u.email })),
        deleted: 0
      });
    }

    // Delete sessions
    console.log('🗑️  Deleting sessions...');
    const { data, error: deleteError } = await supabase
      .from('training_sessions')
      .delete()
      .in('employee_id', userIds)
      .select();

    if (deleteError) {
      console.error('❌ Error deleting sessions:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    console.log(`✅ Successfully deleted ${data.length} sessions`);

    // Show breakdown by user
    const breakdown = users.map(user => {
      const userSessions = data.filter((s: any) => s.employee_id === user.id);
      return {
        name: user.name,
        email: user.email,
        sessionsDeleted: userSessions.length
      };
    });

    return NextResponse.json({
      success: true,
      deleted: data.length,
      users: breakdown
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
