import { BillSubmitForm } from '@/components/bill-submit-form';

export default function AdminNewBillPage() {
  return <BillSubmitForm showStatus redirectPath="/admin/bills" />;
}
