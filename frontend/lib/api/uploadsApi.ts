import { baseApi } from './baseApi';

interface PresignedUrlRequest {
  fileName: string;
  fileType: string;
}

interface PresignedUrlResponse {
  presignedUrl: string;
  objectUrl: string;
}

export const uploadsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPresignedUrl: build.mutation<PresignedUrlResponse, PresignedUrlRequest>({
      query: (body) => ({ url: '/uploads/presigned-url', method: 'POST', body }),
    }),
  }),
});

export const { useGetPresignedUrlMutation } = uploadsApi;
