-- Database function to create user records, bypassing RLS
create or replace function create_user_record(
  user_id uuid,
  user_email text,
  user_name text,
  user_role text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  -- Check if user already exists
  if exists (select 1 from users where id = user_id) then
    select json_build_object('success', true, 'message', 'User already exists') into result;
    return result;
  end if;

  -- Insert new user
  insert into users (id, email, name, role)
  values (user_id, user_email, user_name, user_role);

  select json_build_object('success', true, 'message', 'User created successfully') into result;
  return result;

exception when others then
  select json_build_object('success', false, 'error', SQLERRM) into result;
  return result;
end;
$$;