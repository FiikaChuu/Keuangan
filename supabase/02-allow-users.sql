-- REPLACE both addresses before running. Invite these same emails in Auth > Users.
-- Email changes and membership changes must be made by the project owner in SQL Editor.
insert into private.allowed_users(email, household_id) values
  ('ganti-email-anda@example.com','0f739560-0427-4dca-8247-9e2f885d5191'),
  ('ganti-email-pasangan@example.com','0f739560-0427-4dca-8247-9e2f885d5191')
on conflict(email) do update set active=true,household_id=excluded.household_id;

-- To revoke access immediately on subsequent database/API requests:
-- update private.allowed_users set active=false where email='email-yang-dicabut@example.com';
