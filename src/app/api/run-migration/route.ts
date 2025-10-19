import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { migration } = await request.json();

    if (!migration) {
      return NextResponse.json({ error: 'Migration SQL required' }, { status: 400 });
    }

    console.log('🔄 Running migration...');

    const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql: migration });

    if (error) {
      console.error('❌ Migration failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('✅ Migration completed successfully');
    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('❌ Migration error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
