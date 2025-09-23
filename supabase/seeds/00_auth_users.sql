-- Seed data for auth users and identities
-- This must run first to create users that other tables reference

-- Insert auth users with passwords
INSERT INTO auth.users (
  id,
  email,
  raw_user_meta_data,
  email_confirmed_at,
  encrypted_password,
  aud,
  role,
  instance_id,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token,
  created_at,
  updated_at,
  last_sign_in_at,
  confirmation_sent_at
)
VALUES
  (
    'd0fc7e7c-8e2a-4e5b-8b2c-f6d718e39af3',
    'alice@example.com',
    jsonb_build_object('full_name', 'Alice Johnson', 'avatar_url', '/avatars/alice.jpg'),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    crypt('Password123', gen_salt('bf')),
    'authenticated',
    'authenticated',
    '00000000-0000-0000-0000-000000000000',
    '',
    '',
    '',
    '',
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
  ),
  (
    'e1fc7e7c-8e2a-4e5b-8b2c-f6d718e39af4',
    'bob@example.com',
    jsonb_build_object('full_name', 'Bob Smith', 'avatar_url', '/avatars/bob.jpg'),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    crypt('Password123', gen_salt('bf')),
    'authenticated',
    'authenticated',
    '00000000-0000-0000-0000-000000000000',
    '',
    '',
    '',
    '',
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
  ),
  (
    '470bbb96-f240-4e86-bc3b-833cebc60642',
    'hpark0011@gmail.com',
    jsonb_build_object('full_name', 'Hyunsol Park', 'avatar_url', '/avatars/hyunsol.jpg'),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    crypt('#F0eeff11', gen_salt('bf')),
    'authenticated',
    'authenticated',
    '00000000-0000-0000-0000-000000000000',
    '',
    '',
    '',
    '',
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
  );

-- Insert into auth.identities for email auth
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
VALUES
  (
    'd0fc7e7c-8e2a-4e5b-8b2c-f6d718e39af3',
    'd0fc7e7c-8e2a-4e5b-8b2c-f6d718e39af3',
    jsonb_build_object('sub', 'd0fc7e7c-8e2a-4e5b-8b2c-f6d718e39af3', 'email', 'alice@example.com'),
    'Email',
    'alice@example.com',
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
  ),
  (
    'e1fc7e7c-8e2a-4e5b-8b2c-f6d718e39af4',
    'e1fc7e7c-8e2a-4e5b-8b2c-f6d718e39af4',
    jsonb_build_object('sub', 'e1fc7e7c-8e2a-4e5b-8b2c-f6d718e39af4', 'email', 'bob@example.com'),
    'Email',
    'bob@example.com',
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
  ),
  (
    '470bbb96-f240-4e86-bc3b-833cebc60642',
    '470bbb96-f240-4e86-bc3b-833cebc60642',
    jsonb_build_object('sub', '470bbb96-f240-4e86-bc3b-833cebc60642', 'email', 'hpark0011@gmail.com'),
    'email',
    'hpark0011@gmail.com',
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
    (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
  ); 