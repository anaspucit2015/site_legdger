import { baseApi } from './baseApi';

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
    getSites: build.query<Site[], void>({
      query: () => '/sites',
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
