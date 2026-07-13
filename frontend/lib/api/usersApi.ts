import { baseApi } from './baseApi';

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'vendor' | 'accountant';
  isActive: boolean;
  createdAt: string;
};

export const usersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getUsers: build.query<User[], void>({
      query: () => '/users',
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
  }),
});

export const { useGetUsersQuery, useCreateUserMutation, useUpdateUserMutation, useDeactivateUserMutation } = usersApi;
