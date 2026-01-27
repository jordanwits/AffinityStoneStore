import { createClient } from '@/lib/supabase/server';
import { cache } from 'react';

// Cache store settings - React cache() provides request-level deduplication
export const getStoreSettings = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('store_settings')
    .select('usd_to_points_rate')
    .single();
  
  return {
    conversionRate: data?.usd_to_points_rate || 100,
  };
});

// Cache filter metadata - React cache() provides request-level deduplication
// This prevents multiple parallel queries in the same request from hitting the database
export const getFilterMetadata = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.rpc('get_filter_metadata');
  
  const filterData = data as {
    categories: string[];
    collections: string[];
    sizes: string[];
    colors: string[];
  } | null;
  
  return {
    categories: filterData?.categories || [],
    collections: filterData?.collections || [],
    sizes: filterData?.sizes || [],
    colors: filterData?.colors || [],
  };
});

// Fetch products by IDs (for cart) - more efficient than fetching all
export const getProductsByIds = cache(async (productIds: string[]) => {
  if (productIds.length === 0) return [];
  
  const supabase = await createClient();
  const { data } = await supabase
    .from('products')
    .select('*')
    .in('id', productIds)
    .eq('active', true);
  
  return data || [];
});

// Fetch variants by product IDs (for cart) - more efficient than fetching all
export const getVariantsByProductIds = cache(async (productIds: string[]) => {
  if (productIds.length === 0) return [];
  
  const supabase = await createClient();
  const { data } = await supabase
    .from('product_variants')
    .select('*')
    .in('product_id', productIds)
    .eq('active', true);
  
  return data || [];
});

// Combined product and variant fetch for a single product (product detail page)
export const getProductWithVariants = cache(async (productId: string) => {
  const supabase = await createClient();
  
  // Run both queries in parallel
  const [productResult, variantsResult] = await Promise.all([
    supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single(),
    supabase
      .from('product_variants')
      .select('*')
      .eq('product_id', productId)
      .eq('active', true),
  ]);
  
  return {
    product: productResult.data,
    variants: variantsResult.data || [],
  };
});
