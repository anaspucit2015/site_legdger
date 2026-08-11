import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getToken, clearAuth } from '../auth';

const rawBase = fetchBaseQuery({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  prepareHeaders: (headers) => {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

const baseQueryWithReauth: typeof rawBase = async (args, api, extra) => {
  const result = await rawBase(args, api, extra);
  if (result.error?.status === 401) {
    clearAuth();
    if (typeof window !== 'undefined') window.location.href = '/login';
  }
  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['User', 'Site', 'Task', 'Invoice', 'Vendor'],
  endpoints: () => ({}),
});
