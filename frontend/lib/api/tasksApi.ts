import { baseApi } from './baseApi';
import { PaginatedResult } from './invoicesApi';

export type Task = {
  id: string;
  name: string;
  unit: string;
  unitCost: string | null;
  isCustom: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  rateHistory?: RateHistory[];
};

export type RateHistory = {
  id: string;
  taskId: string;
  oldRate: string | null;
  newRate: string;
  changedBy: string;
  changedAt: string;
};

export const tasksApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getTasks: build.query<PaginatedResult<Task>, { page?: number; limit?: number } | void>({
      query: (params) => {
        const qs = new URLSearchParams();
        if (params?.page) qs.set('page', String(params.page));
        if (params?.limit) qs.set('limit', String(params.limit));
        const str = qs.toString();
        return str ? `/tasks?${str}` : '/tasks';
      },
      providesTags: ['Task'],
    }),
    getActiveTasks: build.query<Task[], void>({
      query: () => '/tasks?active=true',
      providesTags: ['Task'],
    }),
    getTask: build.query<Task, string>({
      query: (id) => `/tasks/${id}`,
      providesTags: ['Task'],
    }),
    createTask: build.mutation<Task, { name: string; unit: string; unitCost?: string }>({
      query: (body) => ({ url: '/tasks', method: 'POST', body }),
      invalidatesTags: ['Task'],
    }),
    updateTask: build.mutation<Task, { id: string; name?: string; unit?: string; unitCost?: string; isActive?: boolean }>({
      query: ({ id, ...body }) => ({ url: `/tasks/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Task'],
    }),
    deactivateTask: build.mutation<Task, string>({
      query: (id) => ({ url: `/tasks/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Task'],
    }),
    getRateHistory: build.query<RateHistory[], string>({
      query: (id) => `/tasks/${id}/rate-history`,
      providesTags: ['Task'],
    }),
  }),
});

export const {
  useGetTasksQuery,
  useGetActiveTasksQuery,
  useGetTaskQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeactivateTaskMutation,
  useGetRateHistoryQuery,
} = tasksApi;
