import { apiClient } from './client'

export type BookDemoPayload = {
  name: string
  phone: string
  email: string
}

export async function bookDemoRequest(
  payload: BookDemoPayload,
): Promise<void> {
  await apiClient.post<{ ok: boolean }>('/public/book-demo', payload)
}
