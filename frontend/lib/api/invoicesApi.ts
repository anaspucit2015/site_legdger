import { baseApi } from './baseApi';

export type Invoice = {
  id: string;
  taskId: string | null;
  customTaskName: string | null;
  siteId: string;
  vendorId: string;
  unit: string;
  quantity: string;
  unitCostSnapshot: string | null;
  amount: string;
  description: string | null;
  attachmentUrl: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  rejectionReason: string | null;
  rejectionReasonOther: string | null;
  deleteRequested: boolean;
  deleteRequestedAt: string | null;
  submittedAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  paymentRef: string | null;
  task?: { name: string; unit: string } | null;
  site?: { name: string };
  vendor?: { name: string } | null;
};

export const invoicesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getInvoices: build.query<Invoice[], { siteId?: string; vendorId?: string; status?: string; mine?: boolean }>({
      query: (params) => {
        const qs = new URLSearchParams();
        if (params.siteId) qs.set('siteId', params.siteId);
        if (params.vendorId) qs.set('vendorId', params.vendorId);
        if (params.status) qs.set('status', params.status);
        if (params.mine) qs.set('mine', 'true');
        return `/invoices?${qs}`;
      },
      providesTags: ['Invoice'],
    }),
    getInvoice: build.query<Invoice, string>({
      query: (id) => `/invoices/${id}`,
      providesTags: ['Invoice'],
    }),
    createInvoice: build.mutation<Invoice, { siteId: string; taskId?: string; customTaskName?: string; customTaskUnit?: string; customTaskUnitCost?: string; quantity: string; amount?: string; description?: string }>({
      query: (body) => ({ url: '/invoices', method: 'POST', body }),
      invalidatesTags: ['Invoice'],
    }),
    updateInvoice: build.mutation<Invoice, { id: string; quantity?: string; amount?: string; description?: string }>({
      query: ({ id, ...body }) => ({ url: `/invoices/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Invoice'],
    }),
    requestDeleteInvoice: build.mutation<Invoice, string>({
      query: (id) => ({ url: `/invoices/${id}/delete-request`, method: 'POST' }),
      invalidatesTags: ['Invoice'],
    }),
    approveInvoice: build.mutation<Invoice, string>({
      query: (id) => ({ url: `/invoices/${id}/approve`, method: 'POST' }),
      invalidatesTags: ['Invoice'],
    }),
    rejectInvoice: build.mutation<Invoice, { id: string; rejectionReason: string; rejectionReasonOther?: string }>({
      query: ({ id, ...body }) => ({ url: `/invoices/${id}/reject`, method: 'POST', body }),
      invalidatesTags: ['Invoice'],
    }),
    getDeleteRequests: build.query<Invoice[], void>({
      query: () => '/invoices/delete-requests',
      providesTags: ['Invoice'],
    }),
    resolveDeleteRequest: build.mutation<any, { id: string; approve: boolean }>({
      query: ({ id, approve }) => ({
        url: `/invoices/${id}/delete-request/resolve?approve=${approve}`,
        method: 'POST',
      }),
      invalidatesTags: ['Invoice'],
    }),
    releasePayment: build.mutation<Invoice, { id: string; paymentRef: string }>({
      query: ({ id, ...body }) => ({ url: `/invoices/${id}/pay`, method: 'POST', body }),
      invalidatesTags: ['Invoice'],
    }),
  }),
});

export const {
  useGetInvoicesQuery,
  useGetInvoiceQuery,
  useCreateInvoiceMutation,
  useUpdateInvoiceMutation,
  useRequestDeleteInvoiceMutation,
  useApproveInvoiceMutation,
  useRejectInvoiceMutation,
  useGetDeleteRequestsQuery,
  useResolveDeleteRequestMutation,
  useReleasePaymentMutation,
} = invoicesApi;
