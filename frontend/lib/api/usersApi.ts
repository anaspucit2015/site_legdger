import { baseApi } from './baseApi';
import { PaginatedResult } from './invoicesApi';

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'site_supervisor' | 'accountant';
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
};

export const usersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getUsers: build.query<PaginatedResult<User>, { page?: number; limit?: number } | void>({
      query: (params) => {
        const qs = new URLSearchParams();
        if (params?.page) qs.set('page', String(params.page));
        if (params?.limit) qs.set('limit', String(params.limit));
        const str = qs.toString();
        return str ? `/users?${str}` : '/users';
      },
      providesTags: ['User'],
    }),
    createUser: build.mutation<User, { name: string; email: string; password: string; role: string }>({
      query: (body) => ({ url: '/users', method: 'POST', body }),
      invalidatesTags: ['User'],
    }),
    updateUser: build.mutation<User, { id: string; name?: string; role?: string; isActive?: boolean }>({
      query: ({ id, ...body }) => ({ url: `/users/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['User'],
    }),
    deactivateUser: build.mutation<User, string>({
      query: (id) => ({ url: `/users/${id}`, method: 'DELETE' }),
      invalidatesTags: ['User'],
    }),
    archiveUser: build.mutation<User, string>({
      query: (id) => ({ url: `/users/${id}/archive`, method: 'PATCH' }),
      invalidatesTags: ['User'],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeactivateUserMutation,
  useArchiveUserMutation,
} = usersApi;
