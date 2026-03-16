// Type definitions

export interface Company {
  id: string;
  name: string | null;
  logo_url: string | null;
  website: string | null;
  primary_color: string;
  address: string | null;
  trade_license: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  created_at: string | null;
  job_title: string | null;
  whatsapp_number: string | null;
  rera_number: string | null;
  avatar_url: string | null;
  signature_image_url: string | null;
  company_id: string | null;
  company?: Company | null;
}
