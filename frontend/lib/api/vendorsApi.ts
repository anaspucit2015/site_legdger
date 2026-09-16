import { baseApi } from './baseApi';
import { PaginatedResult } from './invoicesApi';

export type Vendor = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  bankName: string | null;
  accountTitle: string | null;
  accountNumber: string | null;
  iban: string | null;
  branchCode: string | null;
  currentBalance: string;
  advanceBalance: string;
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
};

export type VendorTxnType = 'ADVANCE_GIVEN' | 'INVOICE_APPROVED' | 'BILL_APPROVED' | 'ADVANCE_APPLIED' | 'VENDOR_PAYMENT' | 'REVERSAL';

export type VendorTransaction = {
  id: string;
  vendorId: string;
  type: VendorTxnType;
  amount: string;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'JAZZCASH_EASYPAISA' | null;
  invoiceReferenceNote: string | null;
  invoiceId: string | null;
  billId: string | null;
  reversesId: string | null;
  outstandingAfter: string;
  advanceAfter: string;
  paymentRef: string | null;
  notes: string | null;
  performedById: string;
  createdAt: string;
  invoice?: { invoiceNumber: number } | null;
  bill?: { billNumber: number } | null;
  performedBy?: { name: string };
  reverses?: { id: string; type: string } | null;
  reversedBy?: { id: string }[];
};

export type VendorStatement = {
  outstandingBalance: number;
  advanceBalance: number;
  netPayable: number;
  totalAdvanceGiven: number;
  totalAdvanceApplied: number;
  totalVendorPayments: number;
  totalInvoicesApproved: number;
  totalBillsApproved: number;
  reconciliationOk: boolean;
  invoices: { total: number; count: number; byStatus: { pending: number; approved: number; voided: number; rejected: number } };
  bills: { total: number; count: number; byStatus: { pending: number; approved: number; voided: number; rejected: number } };
};

export type VendorTransactionLedger = {
  data: VendorTransaction[];
  total: number;
  page: number;
  limit: number;
  summary: {
    vendorName: string;
    outstandingBalance: number;
    advanceBalance: number;
    netPayable: number;
  };
};

export type GiveAdvanceBody = { id: string; amount: number; notes?: string };
export type ApplyAdvanceBody = { id: string; amount: number; notes?: string };
export type PayVendorBody = {
  id: string;
  amount: number;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'JAZZCASH_EASYPAISA';
  paymentRef?: string;
  invoiceReferenceNote?: string;
  notes?: string;
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
    createVendor: build.mutation<Vendor, { name: string; contactPerson?: string; phone?: string; address?: string; email?: string; bankName?: string; accountTitle?: string; accountNumber?: string; iban?: string; branchCode?: string; currentBalance?: number }>({
      query: (body) => ({ url: '/vendors', method: 'POST', body }),
      invalidatesTags: ['Vendor'],
    }),
    updateVendor: build.mutation<Vendor, { id: string; name?: string; contactPerson?: string; phone?: string; email?: string; address?: string; bankName?: string; accountTitle?: string; accountNumber?: string; iban?: string; branchCode?: string; currentBalance?: number; isActive?: boolean }>({
      query: ({ id, ...body }) => ({ url: `/vendors/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['Vendor', 'Invoice'],
    }),
    deactivateVendor: build.mutation<Vendor, string>({
      query: (id) => ({ url: `/vendors/${id}/deactivate`, method: 'POST' }),
      invalidatesTags: ['Vendor'],
    }),
    archiveVendor: build.mutation<Vendor, string>({
      query: (id) => ({ url: `/vendors/${id}/archive`, method: 'POST' }),
      invalidatesTags: ['Vendor'],
    }),
    giveAdvance: build.mutation<{ vendor: Vendor; transaction: VendorTransaction }, GiveAdvanceBody>({
      query: ({ id, ...body }) => ({ url: `/vendors/${id}/advance`, method: 'POST', body }),
      invalidatesTags: ['Vendor', 'VendorTransaction'],
    }),
    applyAdvance: build.mutation<{ vendor: Vendor; transaction: VendorTransaction }, ApplyAdvanceBody>({
      query: ({ id, ...body }) => ({ url: `/vendors/${id}/apply-advance`, method: 'POST', body }),
      invalidatesTags: ['Vendor', 'VendorTransaction'],
    }),
    payVendor: build.mutation<{ vendor: Vendor; transaction: VendorTransaction }, PayVendorBody>({
      query: ({ id, ...body }) => ({ url: `/vendors/${id}/pay`, method: 'POST', body }),
      invalidatesTags: ['Vendor', 'VendorTransaction'],
    }),
    getVendorTransactions: build.query<VendorTransactionLedger, { id: string; page?: number; limit?: number }>({
      query: ({ id, page, limit }) => {
        const qs = new URLSearchParams();
        if (page) qs.set('page', String(page));
        if (limit) qs.set('limit', String(limit));
        const str = qs.toString();
        return str ? `/vendors/${id}/transactions?${str}` : `/vendors/${id}/transactions`;
      },
      providesTags: ['VendorTransaction'],
    }),
    getVendorStatement: build.query<VendorStatement, string>({
      query: (id) => `/vendors/${id}/statement`,
      providesTags: ['VendorTransaction'],
    }),
    reverseVendorTransaction: build.mutation<{ vendor: Vendor; reversalTransaction: VendorTransaction }, { txnId: string; reason: string }>({
      query: ({ txnId, reason }) => ({ url: `/vendors/transactions/${txnId}/reverse`, method: 'POST', body: { reason } }),
      invalidatesTags: ['Vendor', 'VendorTransaction'],
    }),
  }),
});

export const {
  useGetVendorsQuery,
  useGetActiveVendorsQuery,
  useCreateVendorMutation,
  useUpdateVendorMutation,
  useDeactivateVendorMutation,
  useArchiveVendorMutation,
  useGiveAdvanceMutation,
  useApplyAdvanceMutation,
  usePayVendorMutation,
  useGetVendorTransactionsQuery,
  useGetVendorStatementQuery,
  useReverseVendorTransactionMutation,
} = vendorsApi;
