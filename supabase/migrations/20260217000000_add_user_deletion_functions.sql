-- Create admin_delete_user function (from schema.sql, not yet deployed)
create or replace function admin_delete_user(user_id_to_delete uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Only allow the admin user to delete accounts
  if (auth.jwt() ->> 'email') <> 'hun@ghkim.com' then
    raise exception 'Permission denied: admin access required';
  end if;

  -- Delete the user from auth.users
  delete from auth.users where id = user_id_to_delete;
end;
$$;

-- Create transactional delete_user_cascade function
-- Deletes all user data in a single transaction, then removes the auth user
create or replace function delete_user_cascade(target_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Only allow users to delete themselves, or admin to delete anyone
  if auth.uid() <> target_user_id
     and (auth.jwt() ->> 'email') <> 'hun@ghkim.com' then
    raise exception 'Permission denied: you can only delete your own account';
  end if;

  -- Delete in dependency order within a single transaction
  delete from public.league_members where user_id = target_user_id;
  delete from public.league_invites where email = (
    select email from auth.users where id = target_user_id
  );
  delete from public.leagues where owner_id = target_user_id;
  delete from public.profiles where id = target_user_id;

  -- Delete the auth user last
  delete from auth.users where id = target_user_id;
end;
$$;
