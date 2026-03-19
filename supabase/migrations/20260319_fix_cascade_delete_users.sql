-- Ensure every public FK to auth.users(id) uses ON DELETE CASCADE to prevent auth user deletion failures.
DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN
    SELECT
      tc.table_schema,
      tc.table_name,
      tc.constraint_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
     AND tc.table_name = kcu.table_name
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
     AND tc.constraint_schema = rc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON rc.unique_constraint_name = ccu.constraint_name
     AND rc.unique_constraint_schema = ccu.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_schema = 'auth'
      AND ccu.table_name = 'users'
      AND rc.delete_rule <> 'CASCADE'
  LOOP
    -- Recreate FK with CASCADE so deleting auth users also deletes dependent public rows.
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
      fk.table_schema,
      fk.table_name,
      fk.constraint_name
    );

    EXECUTE format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE',
      fk.table_schema,
      fk.table_name,
      fk.constraint_name,
      fk.column_name
    );
  END LOOP;
END $$;

