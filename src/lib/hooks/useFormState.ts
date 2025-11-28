import { useState, useCallback, ChangeEvent } from 'react'

export interface UseFormStateOptions<T> {
  initialValues: T
  validate?: (values: T) => Partial<Record<keyof T, string>>
  onSubmit?: (values: T) => void | Promise<void>
}

export interface UseFormStateResult<T> {
  values: T
  errors: Partial<Record<keyof T, string>>
  touched: Partial<Record<keyof T, boolean>>
  isSubmitting: boolean
  isValid: boolean
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  handleBlur: (field: keyof T) => void
  setFieldValue: (field: keyof T, value: any) => void
  setFieldError: (field: keyof T, error: string) => void
  setValues: (values: Partial<T>) => void
  resetForm: () => void
  handleSubmit: (e?: React.FormEvent) => Promise<void>
}

/**
 * Custom hook for managing form state with validation
 *
 * @example
 * ```tsx
 * const { values, errors, handleChange, handleSubmit } = useFormState({
 *   initialValues: { name: '', email: '' },
 *   validate: (values) => {
 *     const errors: any = {}
 *     if (!values.name) errors.name = 'Name is required'
 *     if (!values.email) errors.email = 'Email is required'
 *     return errors
 *   },
 *   onSubmit: async (values) => {
 *     await fetch('/api/submit', {
 *       method: 'POST',
 *       body: JSON.stringify(values)
 *     })
 *   }
 * })
 * ```
 */
export function useFormState<T extends Record<string, any>>({
  initialValues,
  validate,
  onSubmit
}: UseFormStateOptions<T>): UseFormStateResult<T> {
  const [values, setValuesState] = useState<T>(initialValues)
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validateForm = useCallback((formValues: T): Partial<Record<keyof T, string>> => {
    if (validate) {
      return validate(formValues)
    }
    return {}
  }, [validate])

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target

    setValuesState(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))

    // Clear error when user types
    if (errors[name as keyof T]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name as keyof T]
        return newErrors
      })
    }
  }, [errors])

  const handleBlur = useCallback((field: keyof T) => {
    setTouched(prev => ({ ...prev, [field]: true }))

    // Validate single field on blur
    const fieldErrors = validateForm(values)
    if (fieldErrors[field]) {
      setErrors(prev => ({ ...prev, [field]: fieldErrors[field] }))
    }
  }, [values, validateForm])

  const setFieldValue = useCallback((field: keyof T, value: any) => {
    setValuesState(prev => ({ ...prev, [field]: value }))
  }, [])

  const setFieldError = useCallback((field: keyof T, error: string) => {
    setErrors(prev => ({ ...prev, [field]: error }))
  }, [])

  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState(prev => ({ ...prev, ...newValues }))
  }, [])

  const resetForm = useCallback(() => {
    setValuesState(initialValues)
    setErrors({})
    setTouched({})
    setIsSubmitting(false)
  }, [initialValues])

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()

    // Mark all fields as touched
    const allTouched = Object.keys(values).reduce((acc, key) => {
      acc[key as keyof T] = true
      return acc
    }, {} as Partial<Record<keyof T, boolean>>)
    setTouched(allTouched)

    // Validate all fields
    const formErrors = validateForm(values)
    setErrors(formErrors)

    // If there are errors, don't submit
    if (Object.keys(formErrors).length > 0) {
      return
    }

    // Submit the form
    if (onSubmit) {
      setIsSubmitting(true)
      try {
        await onSubmit(values)
      } finally {
        setIsSubmitting(false)
      }
    }
  }, [values, validateForm, onSubmit])

  const isValid = Object.keys(errors).length === 0

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    handleChange,
    handleBlur,
    setFieldValue,
    setFieldError,
    setValues,
    resetForm,
    handleSubmit
  }
}
