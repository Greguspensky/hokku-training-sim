'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';

// Import the real AuthContext to provide to it
const AuthContext = createContext<any>(undefined);

// Demo company/scenario IDs
const DEMO_COMPANY_ID = '9deb2165-32b1-4287-be9d-788a0726408e'; // Hotel Mota
const DEMO_SCENARIO_ID = '13a2c2f3-24fc-4f20-abd6-f3ab2a7abc01'; // Reception

/**
 * Demo User type - extends Supabase User to match AuthContext
 * Provides mock authentication for public demo
 */
interface DemoUser extends User {
  role: 'demo';
  company_id: string;
  company_name: string;
  business_type: string;
  employee_record_id: string;
  isDemoMode: true;
}

/**
 * Demo Auth Provider
 * Provides mock authentication context for public demo
 * Bypasses all auth checks while maintaining compatibility with existing components
 */
export function DemoAuthProvider({ children }: { children: ReactNode }) {
  // Generate a unique session ID for this demo user
  const [sessionId] = useState(() => crypto.randomUUID());

  // Create mock demo user that matches the real User type
  const demoUser: DemoUser = {
    id: sessionId, // Use plain UUID (not demo- prefix to avoid format issues)
    email: 'demo@hokku.ai',
    role: 'demo',
    company_id: DEMO_COMPANY_ID,
    company_name: 'Hotel Mota (Demo)',
    business_type: 'hotel',
    employee_record_id: sessionId,
    isDemoMode: true,
    // Required Supabase User fields
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
  } as DemoUser;

  // Mock signOut function (does nothing in demo mode)
  const signOut = async () => {
    console.log('Demo mode: signOut called (no-op)');
  };

  // Mock setUser function (does nothing in demo mode)
  const setUser = (user: any) => {
    console.log('Demo mode: setUser called (no-op)');
  };

  const contextValue = {
    user: demoUser,
    loading: false,
    signOut,
    setUser,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access demo auth context
 * Uses the same hook name as production for compatibility
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within DemoAuthProvider');
  }
  return context;
}

/**
 * Type guard to check if user is in demo mode
 */
export function isDemoUser(user: any): user is DemoUser {
  return user && user.isDemoMode === true && user.role === 'demo';
}

/**
 * Get demo session ID from user
 */
export function getDemoSessionId(user: any): string | null {
  if (!user || !isDemoUser(user)) {
    return null;
  }
  // Return the user ID directly (it's already a plain UUID)
  return user.id;
}
