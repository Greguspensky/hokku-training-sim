import { NextRequest, NextResponse } from 'next/server';
import { scenarioService } from '@/lib/scenarios';
import { apiErrorHandler, createSuccessResponse, createErrorResponse, parseRequestBody } from '@/lib/utils/api';
// import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Temporarily bypass auth check since we simplified auth system
    // const user = await getCurrentUser();

    // Use demo user for testing
    const demoUser = {
      id: 'demo-user',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'manager'
    };

    const body = await parseRequestBody<any>(request);
    const { company_id, name, description, target_audience } = body;

    if (!company_id || !name || !description || !target_audience) {
      return createErrorResponse('Missing required fields', 400);
    }

    const track = await scenarioService.createTrack({
      company_id,
      name,
      description,
      target_audience
    });

    return createSuccessResponse({ track }, 'Track created successfully');

  } catch (error) {
    return apiErrorHandler(error, 'Create track');
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('company_id');

    if (!companyId) {
      return createErrorResponse('company_id is required', 400);
    }

    const tracks = await scenarioService.getTracks(companyId);

    return createSuccessResponse({ tracks });

  } catch (error) {
    return apiErrorHandler(error, 'Get tracks');
  }
}