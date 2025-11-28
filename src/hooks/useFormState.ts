/**
 * useFormState Hook
 * Consolidates form state management patterns
 * Provides type-safe form data, error handling, and submission state
 */

'use client';

import { useState, useCallback } from 'react';

export interface UseFormStateResult<T> {
  formData: T;
  setFormData: React.Dispatch<React.SetStateAction<T>>;
  updateField: <K extends keyof T>(field: K, value: T[K]) => void;
  updateFields: (updates: Partial<T>) => void;
  resetForm: () => void;
  isSubmitting: boolean;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  clearError: () => void;
}

/**
 * Hook for managing form state with type safety
 *
 * @param initialData - Initial form data
 * @returns Form state and utility functions
 *
 * @example
 * ```typescript
 * const {
 *   formData,
 *   updateField,
 *   isSubmitting,
 *   setIsSubmitting,
 *   error,
 *   setError
 * } = useFormState<ScenarioFormData>({
 *   title: '',
 *   description: '',
 *   difficulty: 'beginner'
 * });
 *
 * // Update a single field
 * updateField('title', 'New Scenario');
 *
 * // Update multiple fields
 * updateFields({ title: 'New Title', description: 'New Description' });
 * ```
 */
export function useFormState<T>(initialData: T): UseFormStateResult<T> {
  const [formData, setFormData] = useState<T>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Update a single form field
   * Automatically clears error when field is updated
   */
  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null); // Clear error when user makes changes
  }, []);

  /**
   * Update multiple form fields at once
   * Automatically clears error when fields are updated
   */
  const updateFields = useCallback((updates: Partial<T>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setError(null); // Clear error when user makes changes
  }, []);

  /**
   * Reset form to initial data
   */
  const resetForm = useCallback(() => {
    setFormData(initialData);
    setError(null);
    setIsSubmitting(false);
  }, [initialData]);

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    formData,
    setFormData,
    updateField,
    updateFields,
    resetForm,
    isSubmitting,
    setIsSubmitting,
    error,
    setError,
    clearError
  };
}

/**
 * Hook for form submission with automatic error handling
 *
 * @param submitFn - Async function to handle form submission
 * @param options - Optional configuration
 * @returns Submission state and submit function
 *
 * @example
 * ```typescript
 * const { submit, isSubmitting, error } = useFormSubmission(async (data) => {
 *   const response = await fetch('/api/scenarios', {
 *     method: 'POST',
 *     body: JSON.stringify(data)
 *   });
 *   return response.json();
 * }, {
 *   onSuccess: (result) => console.log('Success!', result),
 *   onError: (error) => console.error('Failed:', error)
 * });
 * ```
 */
export function useFormSubmission<T, R = any>(
  submitFn: (data: T) => Promise<R>,
  options?: {
    onSuccess?: (result: R) => void;
    onError?: (error: string) => void;
    validate?: (data: T) => string | null; // Return error message or null if valid
  }
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<R | null>(null);

  const submit = useCallback(async (data: T) => {
    // Run validation if provided
    if (options?.validate) {
      const validationError = options.validate(data);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const submitResult = await submitFn(data);
      setResult(submitResult);

      if (options?.onSuccess) {
        options.onSuccess(submitResult);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Submission failed';
      setError(errorMessage);

      if (options?.onError) {
        options.onError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [submitFn, options]);

  return {
    submit,
    isSubmitting,
    error,
    result,
    setError,
    clearError: () => setError(null)
  };
}
