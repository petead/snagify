-- Users / Agents
create table profiles (
  id uuid references auth.users on delete cascade,
  full_name text,
  agency_name text,
  phone text,
  role text default 'agent',
  created_at timestamp default now(),
  primary key (id)
);

-- Properties
create table properties (
  id uuid default gen_random_uuid() primary key,
  agent_id uuid references profiles(id),
  address text not null,
  unit_number text,
  property_type text, -- studio / 1BR / 2BR / villa
  furnished boolean default false,
  ejari_ref text,
  created_at timestamp default now()
);

-- Inspections
create table inspections (
  id uuid default gen_random_uuid() primary key,
  property_id uuid references properties(id),
  agent_id uuid references profiles(id),
  type text, -- check-in / check-out
  status text default 'draft', -- draft / completed / signed
  landlord_name text,
  landlord_email text,
  tenant_name text,
  tenant_email text,
  report_url text,
  document_hash text,
  created_at timestamp default now(),
  completed_at timestamp
);

-- Rooms
create table rooms (
  id uuid default gen_random_uuid() primary key,
  inspection_id uuid references inspections(id),
  name text not null, -- Living Room / Bedroom 1 / Kitchen...
  order_index integer,
  overall_condition text -- good / fair / poor
);

-- Photos (damage_tags: [] = general view, non-empty = damage reported)
create table photos (
  id uuid default gen_random_uuid() primary key,
  room_id uuid references rooms(id),
  url text not null,
  gps_lat numeric,
  gps_lng numeric,
  taken_at timestamp,
  ai_analysis text,
  damage_tags text[] default '{}',
  notes text
);

-- Signatures
create table signatures (
  id uuid default gen_random_uuid() primary key,
  inspection_id uuid references inspections(id),
  signer_type text, -- landlord / tenant / agent
  signer_name text,
  signer_phone text,
  otp_code text,
  otp_verified boolean default false,
  signature_data text,
  signed_at timestamp,
  ip_address text
);

-- Audit Trail
create table audit_logs (
  id uuid default gen_random_uuid() primary key,
  inspection_id uuid references inspections(id),
  action text not null,
  performed_by uuid references profiles(id),
  metadata jsonb,
  created_at timestamp default now()
);

-- Enable Row Level Security
alter table profiles enable row level security;
alter table properties enable row level security;
alter table inspections enable row level security;
alter table rooms enable row level security;
alter table photos enable row level security;
alter table signatures enable row level security;
alter table audit_logs enable row level security;
