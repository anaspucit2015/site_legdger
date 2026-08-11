import { baseApi } from './baseApi';
import { PaginatedResult } from './invoicesApi';

export type Site = {
  id: string;
  siteCode: number;
  name: string;
  location: string;
  isActive: boolean;
  createdAt: string;
};

export const sitesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getSites: build.query<PaginatedResult<Site>, { page?: number; limit?: number } | void>({
      query: (params) => {
        const qs = new URLSearchParams();
        if (params?.page) qs.set('page', String(params.page));
        if (params?.limit) qs.set('limit', String(params.limit));
        const str = qs.toString();
        return str ? `/sites?${str}` : '/sites';
      },
      providesTags: ['Site'],
    }),
    getActiveSites: build.query<Site[], void>({
      query: () => '/sites/active',
      providesTags: ['Site'],
    }),
    createSite: build.mutation<Site, { name: string; location: string }>({
      query: (body) => ({ url: '/sites', method: 'POST', body }),
      invalidatesTags: ['Site'],
    }),
    updateSite: build.mutation<Site, { id: string; name?: string; location?: string; isActive?: boolean }>({
      query: ({ id, ...body }) => ({ url: `/sites/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Site'],
    }),
    deactivateSite: build.mutation<Site, string>({
      query: (id) => ({ url: `/sites/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Site'],
    }),
  }),
});

export const {
  useGetSitesQuery,
  useGetActiveSitesQuery,
  useCreateSiteMutation,
  useUpdateSiteMutation,
  useDeactivateSiteMutation,
} = sitesApi;
