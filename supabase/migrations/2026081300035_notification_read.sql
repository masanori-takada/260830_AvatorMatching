create or replace function public.mark_notification_read(p_notification_id uuid)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  read_time timestamptz;
begin
  if (select auth.uid()) is null then raise exception 'UNAUTHENTICATED'; end if;
  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id and owner_id = (select auth.uid())
  returning read_at into read_time;
  if not found then raise exception 'NOTIFICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  return read_time;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;
