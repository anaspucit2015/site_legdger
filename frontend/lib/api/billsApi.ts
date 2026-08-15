import { baseApi } from './baseApi';
import { PaginatedResult } from './invoicesApi';

export type BillLineItem = {
  id: string;
  taskId: string | null;
  customTaskName: string | null;
  unit: string;
  quantity: string;
  unitCostSnapshot: string | null;
  amount: string;
  task?: { name: string; unit: string } | null;
};

export type Bill = {
  id: string;
  billNumber: number;
  siteId: string;
  vendorId: string | null;
  submittedById: string;
  totalAmount: string;
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
  site?: { name: string };
  vendor?: { name: string } | null;
  submittedBy?: { name: string } | null;
  lineItems: BillLineItem[];
};

export const billsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getBills: build.query<PaginatedResult<Bill>, { siteId?: string; vendorId?: string; status?: string; mine?: boolean; page?: number; limit?: number }>({
      query: (params) => {
        const qs = new URLSearchParams();
        if (params.siteId) qs.set('siteId', params.siteId);
        if (params.vendorId) qs.set('vendorId', params.vendorId);
        if (params.status) qs.set('status', params.status);
        if (params.mine) qs.set('mine', 'true');
        if (params.page) qs.set('page', String(params.page));
        if (params.limit) qs.set('limit', String(params.limit));
        return `/bills?${qs}`;
      },
      providesTags: ['Bill'],
    }),
    getBill: build.query<Bill, string>({
      query: (id) => `/bills/${id}`,
      providesTags: ['Bill'],
    }),
    createBill: build.mutation<Bill, {
      siteId: string;
      vendorId?: string;
      lineItems: Array<{
        taskId?: string;
        customTaskName?: string;
        customTaskUnit?: string;
        customTaskUnitCost?: string;
        quantity: string;
      }>;
      description?: string;
      attachmentUrl?: string;
      status?: 'pending' | 'approved' | 'paid';
    }>({
      query: (body) => ({ url: '/bills', method: 'POST', body }),
      invalidatesTags: ['Bill'],
    }),
    approveBill: build.mutation<Bill, string>({
      query: (id) => ({ url: `/bills/${id}/approve`, method: 'POST' }),
      invalidatesTags: ['Bill'],
    }),
    rejectBill: build.mutation<Bill, { id: string; rejectionReason: string; rejectionReasonOther?: string }>({
      query: ({ id, ...body }) => ({ url: `/bills/${id}/reject`, method: 'POST', body }),
      invalidatesTags: ['Bill'],
    }),
    releasePaymentBill: build.mutation<Bill, { id: string; paymentRef: string }>({
      query: ({ id, ...body }) => ({ url: `/bills/${id}/pay`, method: 'POST', body }),
      invalidatesTags: ['Bill'],
    }),
    requestDeleteBill: build.mutation<Bill, string>({
      query: (id) => ({ url: `/bills/${id}/delete-request`, method: 'POST' }),
      invalidatesTags: ['Bill'],
    }),
    resolveDeleteBill: build.mutation<any, { id: string; approve: boolean }>({
      query: ({ id, approve }) => ({
        url: `/bills/${id}/delete-request/resolve?approve=${approve}`,
        method: 'POST',
      }),
      invalidatesTags: ['Bill'],
    }),
    adminUpdateBill: build.mutation<Bill, { id: string; vendorId?: string; description?: string; attachmentUrl?: string }>({
      query: ({ id, ...body }) => ({ url: `/bills/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Bill'],
    }),
    adminDeleteBill: build.mutation<{ deleted: boolean }, string>({
      query: (id) => ({ url: `/bills/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Bill'],
    }),
    getDeleteRequestsBills: build.query<PaginatedResult<Bill>, { page?: number; limit?: number } | void>({
      query: (params) => {
        const qs = new URLSearchParams();
        if (params?.page) qs.set('page', String(params.page));
        if (params?.limit) qs.set('limit', String(params.limit));
        const str = qs.toString();
        return str ? `/bills/delete-requests?${str}` : '/bills/delete-requests';
      },
      providesTags: ['Bill'],
    }),
  }),
});

export const {
  useGetBillsQuery,
  useGetBillQuery,
  useCreateBillMutation,
  useApproveBillMutation,
  useRejectBillMutation,
  useReleasePaymentBillMutation,
  useRequestDeleteBillMutation,
  useResolveDeleteBillMutation,
  useAdminDeleteBillMutation,
  useAdminUpdateBillMutation,
  useGetDeleteRequestsBillsQuery,
} = billsApi;
