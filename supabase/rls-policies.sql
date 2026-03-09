-- RLS Policies: allow authenticated agents to manage their own data.
-- Run this in the Supabase SQL Editor after applying schema.sql

-- Profiles: users can only read/insert/update their own profile
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Properties: agents can only manage properties where they are the agent
create policy "Agents can view own properties"
  on properties for select
  using (auth.uid() = agent_id);

create policy "Agents can insert own properties"
  on properties for insert
  with check (auth.uid() = agent_id);

create policy "Agents can update own properties"
  on properties for update
  using (auth.uid() = agent_id);

create policy "Agents can delete own properties"
  on properties for delete
  using (auth.uid() = agent_id);

-- Inspections: agents can only manage their own inspections
create policy "Agents can view own inspections"
  on inspections for select
  using (auth.uid() = agent_id);

create policy "Agents can insert own inspections"
  on inspections for insert
  with check (auth.uid() = agent_id);

create policy "Agents can update own inspections"
  on inspections for update
  using (auth.uid() = agent_id);

create policy "Agents can delete own inspections"
  on inspections for delete
  using (auth.uid() = agent_id);

-- Rooms: agents can manage rooms of their inspections
create policy "Agents can view rooms of own inspections"
  on rooms for select
  using (
    inspection_id in (
      select id from inspections where agent_id = auth.uid()
    )
  );

create policy "Agents can insert rooms in own inspections"
  on rooms for insert
  with check (
    inspection_id in (
      select id from inspections where agent_id = auth.uid()
    )
  );

create policy "Agents can update rooms of own inspections"
  on rooms for update
  using (
    inspection_id in (
      select id from inspections where agent_id = auth.uid()
    )
  );

create policy "Agents can delete rooms of own inspections"
  on rooms for delete
  using (
    inspection_id in (
      select id from inspections where agent_id = auth.uid()
    )
  );

-- Room items: via room -> inspection -> agent
create policy "Agents can view room_items of own inspections"
  on room_items for select
  using (
    room_id in (
      select r.id from rooms r
      join inspections i on i.id = r.inspection_id
      where i.agent_id = auth.uid()
    )
  );

create policy "Agents can insert room_items in own inspections"
  on room_items for insert
  with check (
    room_id in (
      select r.id from rooms r
      join inspections i on i.id = r.inspection_id
      where i.agent_id = auth.uid()
    )
  );

create policy "Agents can update room_items of own inspections"
  on room_items for update
  using (
    room_id in (
      select r.id from rooms r
      join inspections i on i.id = r.inspection_id
      where i.agent_id = auth.uid()
    )
  );

create policy "Agents can delete room_items of own inspections"
  on room_items for delete
  using (
    room_id in (
      select r.id from rooms r
      join inspections i on i.id = r.inspection_id
      where i.agent_id = auth.uid()
    )
  );

-- Photos: via inspection
create policy "Agents can view photos of own inspections"
  on photos for select
  using (
    room_id in (
      select r.id from rooms r
      join inspections i on i.id = r.inspection_id
      where i.agent_id = auth.uid()
    )
  );

create policy "Agents can insert photos in own inspections"
  on photos for insert
  with check (
    room_id in (
      select r.id from rooms r
      join inspections i on i.id = r.inspection_id
      where i.agent_id = auth.uid()
    )
  );

create policy "Agents can update photos of own inspections"
  on photos for update
  using (
    room_id in (
      select r.id from rooms r
      join inspections i on i.id = r.inspection_id
      where i.agent_id = auth.uid()
    )
  );

create policy "Agents can delete photos of own inspections"
  on photos for delete
  using (
    room_id in (
      select r.id from rooms r
      join inspections i on i.id = r.inspection_id
      where i.agent_id = auth.uid()
    )
  );

-- Signatures: linked to inspection
create policy "Agents can view signatures of own inspections"
  on signatures for select
  using (
    inspection_id in (
      select id from inspections where agent_id = auth.uid()
    )
  );

create policy "Agents can insert signatures for own inspections"
  on signatures for insert
  with check (
    inspection_id in (
      select id from inspections where agent_id = auth.uid()
    )
  );

create policy "Agents can update signatures of own inspections"
  on signatures for update
  using (
    inspection_id in (
      select id from inspections where agent_id = auth.uid()
    )
  );

-- Audit logs: linked to inspection
create policy "Agents can view audit_logs of own inspections"
  on audit_logs for select
  using (
    inspection_id in (
      select id from inspections where agent_id = auth.uid()
    )
  );

create policy "Agents can insert audit_logs for own inspections"
  on audit_logs for insert
  with check (
    inspection_id in (
      select id from inspections where agent_id = auth.uid()
    )
  );
