-- Seed data for user profiles
-- This creates profiles for the seeded auth users

insert into public.profiles (id, username, full_name, avatar_url)
values
  (
    'd0fc7e7c-8e2a-4e5b-8b2c-f6d718e39af3',
    'alice_johnson',
    'Alice Johnson',
    '/avatars/alice.jpg'
  ),
  (
    'e1fc7e7c-8e2a-4e5b-8b2c-f6d718e39af4',
    'bob_smith',
    'Bob Smith',
    '/avatars/bob.jpg'
  ),
  (
    '470bbb96-f240-4e86-bc3b-833cebc60642',
    'hpark0011',
    'Hyunsol Park',
    '/avatars/hyunsol.jpg'
  )
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  full_name = EXCLUDED.full_name,
  avatar_url = EXCLUDED.avatar_url; 