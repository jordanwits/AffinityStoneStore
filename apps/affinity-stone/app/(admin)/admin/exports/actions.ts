'use server';

import { requireAdmin } from '@/lib/auth/require-admin';
import { revalidatePath } from 'next/cache';
import {
  generateOrdersCsv,
  generateOrderItemsCsv,
  generatePointsLedgerCsv,
  getFileSizeBytes,
} from '@/lib/exports/csv-generator';

interface ExportResult {
  success: boolean;
  error?: string;
  message?: string;
  exportId?: string;
}

/**
 * Generate monthly export for a specific month and type
 * @param month - YYYY-MM format
 * @param exportType - 'orders', 'order_items', or 'points_ledger'
 */
export async function generateMonthlyExport(
  month: string,
  exportType: 'orders' | 'order_items' | 'points_ledger'
): Promise<ExportResult> {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode) {
    return { 
      success: false, 
      error: 'Exports require Supabase to be configured.' 
    };
  }

  try {
    const { supabase, profile } = await requireAdmin();

    // Validate month format
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return { success: false, error: 'Invalid month format. Use YYYY-MM.' };
    }

    // Parse month to get date range
    const [year, monthNum] = month.split('-');
    const startDate = new Date(`${year}-${monthNum}-01T00:00:00Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    // Check if export already exists
    const { data: existingExport } = await supabase
      .from('monthly_exports')
      .select('id')
      .eq('month', month)
      .eq('export_type', exportType)
      .single();

    if (existingExport) {
      return { 
        success: false, 
        error: `Export for ${month} (${exportType}) already exists. Delete it first to regenerate.` 
      };
    }

    let csvContent: string;
    let rowCount: number;

    // Generate export based on type
    if (exportType === 'orders') {
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (!orders || orders.length === 0) {
        return { success: false, error: `No orders found for ${month}` };
      }

      csvContent = generateOrdersCsv(orders);
      rowCount = orders.length;
    } else if (exportType === 'order_items') {
      // Get order items for orders in this month
      const { data: orderItems } = await supabase
        .from('order_items')
        .select(`
          *,
          orders!inner(created_at)
        `)
        .gte('orders.created_at', startDate.toISOString())
        .lt('orders.created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (!orderItems || orderItems.length === 0) {
        return { success: false, error: `No order items found for ${month}` };
      }

      csvContent = generateOrderItemsCsv(orderItems);
      rowCount = orderItems.length;
    } else if (exportType === 'points_ledger') {
      const { data: transactions } = await supabase
        .from('points_ledger')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (!transactions || transactions.length === 0) {
        return { success: false, error: `No points transactions found for ${month}` };
      }

      csvContent = generatePointsLedgerCsv(transactions);
      rowCount = transactions.length;
    } else {
      return { success: false, error: 'Invalid export type' };
    }

    // Upload to storage
    const fileName = `${month}_${exportType}.csv`;
    const fileSizeBytes = getFileSizeBytes(csvContent);
    
    const { error: uploadError } = await supabase.storage
      .from('exports')
      .upload(fileName, csvContent, {
        contentType: 'text/csv',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return { 
        success: false, 
        error: `Failed to upload: ${uploadError.message}` 
      };
    }

    // Insert metadata record
    const { data: exportRecord, error: insertError } = await supabase
      .from('monthly_exports')
      .insert({
        month,
        export_type: exportType,
        storage_path: fileName,
        file_size_bytes: fileSizeBytes,
        row_count: rowCount,
        created_by: profile.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting export metadata:', insertError);
      // Try to clean up the uploaded file
      await supabase.storage.from('exports').remove([fileName]);
      return { success: false, error: 'Failed to save export metadata' };
    }

    revalidatePath('/admin/exports');

    return { 
      success: true, 
      message: `Successfully exported ${rowCount} rows for ${month} (${exportType})`,
      exportId: exportRecord.id,
    };
  } catch (error) {
    console.error('Error generating export:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Delete an export
 */
export async function deleteExport(exportId: string): Promise<ExportResult> {
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode) {
    return { 
      success: false, 
      error: 'Exports require Supabase to be configured.' 
    };
  }

  try {
    const { supabase } = await requireAdmin();

    // Get export metadata
    const { data: exportRecord, error: fetchError } = await supabase
      .from('monthly_exports')
      .select('storage_path')
      .eq('id', exportId)
      .single();

    if (fetchError || !exportRecord) {
      return { success: false, error: 'Export not found' };
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('exports')
      .remove([exportRecord.storage_path]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
      // Continue anyway to clean up metadata
    }

    // Delete metadata
    const { error: deleteError } = await supabase
      .from('monthly_exports')
      .delete()
      .eq('id', exportId);

    if (deleteError) {
      console.error('Error deleting export metadata:', deleteError);
      return { success: false, error: 'Failed to delete export' };
    }

    revalidatePath('/admin/exports');

    return { success: true, message: 'Export deleted successfully' };
  } catch (error) {
    console.error('Error deleting export:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get list of all exports
 */
export async function getExports() {
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode) {
    return [];
  }

  try {
    const { supabase } = await requireAdmin();

    const { data: exports } = await supabase
      .from('monthly_exports')
      .select(`
        *,
        profiles(email)
      `)
      .order('month', { ascending: false });

    return exports || [];
  } catch (error) {
    console.error('Error fetching exports:', error);
    return [];
  }
}

/**
 * Generate signed URL for downloading an export
 */
export async function getExportDownloadUrl(exportId: string): Promise<{ url?: string; error?: string }> {
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  if (isDevMode) {
    return { error: 'Exports require Supabase to be configured.' };
  }

  try {
    const { supabase } = await requireAdmin();

    // Get export metadata
    const { data: exportRecord, error: fetchError } = await supabase
      .from('monthly_exports')
      .select('storage_path')
      .eq('id', exportId)
      .single();

    if (fetchError || !exportRecord) {
      return { error: 'Export not found' };
    }

    // Generate signed URL (valid for 1 hour)
    const { data, error: urlError } = await supabase.storage
      .from('exports')
      .createSignedUrl(exportRecord.storage_path, 3600);

    if (urlError || !data) {
      console.error('Error generating signed URL:', urlError);
      return { error: 'Failed to generate download URL' };
    }

    return { url: data.signedUrl };
  } catch (error) {
    console.error('Error generating download URL:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
