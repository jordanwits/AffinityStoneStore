import { createClient } from '@/lib/supabase/server';
import { cache } from 'react';

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getUserProfile = cache(async () => {
  const supabase = await createClient();
  const user = await getCurrentUser();
  
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile;
});
