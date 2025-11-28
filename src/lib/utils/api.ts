/**
 * API Utilities
 * Standardized error handling and response builders for API routes
 */

import { NextResponse } from 'next/server';

/**
 * Standardized error handler for API routes
 * Logs the error and returns a consistent error response
 *
 * @param error - The error object (unknown type)
 * @param operation - Description of the operation that failed
 * @param status - HTTP status code (default: 500)
 * @returns NextResponse with error details
 */
export function apiErrorHandler(
  error: unknown,
  operation: string,
  status: number = 500
): NextResponse {
  console.error(`${operation} error:`, error);

  const errorMessage = error instanceof Error
    ? error.message
    : `Failed to ${operation}`;

  return NextResponse.json(
    {
      success: false,
      error: errorMessage
    },
    { status }
  );
}

/**
 * Create a standardized success response
 *
 * @param data - The data to return
 * @param message - Optional success message
 * @param status - HTTP status code (default: 200)
 * @returns NextResponse with success data
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(message && { message })
    },
    { status }
  );
}

/**
 * Create a standardized error response
 *
 * @param error - Error message
 * @param status - HTTP status code (default: 400)
 * @param details - Optional additional error details
 * @returns NextResponse with error
 */
export function createErrorResponse(
  error: string,
  status: number = 400,
  details?: any
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(details && { details })
    },
    { status }
  );
}

/**
 * Validate required parameters
 * Throws an error if any required parameters are missing
 *
 * @param params - Object with parameter name and value pairs
 * @throws Error if any parameter is missing or invalid
 */
export function validateRequiredParams(
  params: Record<string, any>
): void {
  const missingParams = Object.entries(params)
    .filter(([_, value]) => !value || value === '')
    .map(([key, _]) => key);

  if (missingParams.length > 0) {
    throw new Error(
      `Missing required parameter${missingParams.length > 1 ? 's' : ''}: ${missingParams.join(', ')}`
    );
  }
}

/**
 * Extract and validate query parameter
 *
 * @param request - Next.js request object
 * @param paramName - Name of the query parameter
 * @param required - Whether the parameter is required (default: true)
 * @returns The parameter value or null if not required and not found
 * @throws Error if required parameter is missing
 */
export function getQueryParam(
  request: Request,
  paramName: string,
  required: boolean = true
): string | null {
  const { searchParams } = new URL(request.url);
  const value = searchParams.get(paramName);

  if (required && !value) {
    throw new Error(`${paramName} is required`);
  }

  return value;
}

/**
 * Parse and validate JSON request body
 *
 * @param request - Next.js request object
 * @returns Parsed JSON object
 * @throws Error if body is invalid JSON
 */
export async function parseRequestBody<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }
}
