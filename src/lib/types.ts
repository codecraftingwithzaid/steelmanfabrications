import type { CategorySlug } from "./catalog";

export type DocType = "invoice" | "quotation";

export type UserRole = "admin" | "staff";

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";
export type QuotationStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired";
export type DocumentStatus = InvoiceStatus | QuotationStatus;

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
}

export interface Customer {
  id: string;
  name: string;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ItemCategory {
  id: string;
  name: CategorySlug;
}

export interface ItemDescription {
  id: string;
  category_id: string;
  label: string;
  is_active: boolean;
  sort_order: number;
}

export interface DocumentItem {
  id: string;
  document_id: string;
  sr_order: number;
  category: CategorySlug;
  description: string;
  qty: number;
  unit: string;
  rate: number;
  total: number;
}

export interface DocumentRecord {
  id: string;
  doc_type: DocType;
  doc_number: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_gstin: string | null;
  doc_date: string;
  validity_or_due_date: string | null;
  gst_percent: number | null;
  subtotal: number;
  gst_amount: number;
  grand_total: number;
  status: DocumentStatus;
  terms_and_conditions: string | null;
  contact_person_id: string | null;
  converted_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Line item shape used inside the editor (client-side, pre-persist). */
export interface EditorLineItem {
  key: string;
  category: CategorySlug;
  description: string;
  isOther: boolean;
  qty: string;
  unit: string;
  rate: string;
}

/** Full document payload the editor builds and the PDF template consumes. */
export interface DocumentDraft {
  docType: DocType;
  docNumber: string;
  docDate: string;
  validityOrDueDate: string;
  customerName: string;
  customerGstin: string;
  items: EditorLineItem[];
  gstPercent: string;
  terms: string;
  contact: {
    name: string;
    email: string;
    phone: string;
  };
}
