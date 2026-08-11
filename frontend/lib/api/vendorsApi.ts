import { baseApi } from './baseApi';
import { PaginatedResult } from './invoicesApi';

export type Vendor = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
};

export const vendorsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getVendors: build.query<PaginatedResult<Vendor>, { page?: number; limit?: number } | void>({
      query: (params) => {
        const qs = new URLSearchParams();
        if (params?.page) qs.set('page', String(params.page));
        if (params?.limit) qs.set('limit', String(params.limit));
        const str = qs.toString();
        return str ? `/vendors?${str}` : '/vendors';
      },
      providesTags: ['Vendor'],
    }),
    getActiveVendors: build.query<Vendor[], void>({
      query: () => '/vendors/active',
      providesTags: ['Vendor'],
    }),
    createVendor: build.mutation<Vendor, { name: string; contactPerson: string; phone: string; address: string; email?: string }>({
      query: (body) => ({ url: '/vendors', method: 'POST', body }),
      invalidatesTags: ['Vendor'],
    }),
    updateVendor: build.mutation<Vendor, { id: string; name?: string; contactPerson?: string; phone?: string; email?: string; address?: string; isActive?: boolean }>({
      query: ({ id, ...body }) => ({ url: `/vendors/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Vendor'],
    }),
    deactivateVendor: build.mutation<Vendor, string>({
      query: (id) => ({ url: `/vendors/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Vendor'],
    }),
  }),
});

export const {
  useGetVendorsQuery,
  useGetActiveVendorsQuery,
  useCreateVendorMutation,
  useUpdateVendorMutation,
  useDeactivateVendorMutation,
} = vendorsApi;
