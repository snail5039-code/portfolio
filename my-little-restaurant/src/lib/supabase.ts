import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Restaurant = {
  id: number;
  name: string;
  food: string;
  created_at: string;
  category_id: number | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  visited: boolean;
  alone_ok: number | null;
  rating: number | null;
  memo: string | null;
  user_id: string | null;
  image_url: string | null;
};
