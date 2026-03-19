-- RPC used by app/api/account/delete: nullify storage.objects owner before auth user delete.
-- PostgREST .schema('storage') is unreliable from the JS client; SECURITY DEFINER runs as owner.

CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  UPDATE storage.objects
  SET owner_id = NULL
  WHERE owner_id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO service_role;
