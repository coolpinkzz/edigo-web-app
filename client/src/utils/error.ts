import axios from 'axios'

/**
 * Normalizes unknown errors (especially Axios) into a user-visible string.
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data
    if (data && typeof data === 'object') {
      if ('error' in data) {
        const msg = (data as { error?: unknown }).error
        if (typeof msg === 'string') return msg
      }
      if ('message' in data) {
        const msg = (data as { message?: unknown }).message
        if (typeof msg === 'string') return msg
      }
    }
    if (error.response?.statusText) return error.response.statusText
    return error.message
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}
