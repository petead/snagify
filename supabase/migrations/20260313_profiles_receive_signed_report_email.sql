-- Email copy of fully signed PDF to inspector/agent (toggle in profile; default on)
alter table public.profiles
  add column if not exists receive_signed_report_email boolean not null default true;
