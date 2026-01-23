'use client';

import { useState } from 'react';
import { Button } from 'core/components/Button';
import { Input } from 'core/components/Input';
import { Alert } from 'core/components/Alert';
import { generateMonthlyExport } from './actions';

interface ExportGeneratorFormProps {
  isDevMode: boolean;
}

export function ExportGeneratorForm({ isDevMode }: ExportGeneratorFormProps) {
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [exportType, setExportType] = useState<'orders' | 'order_items' | 'points_ledger'>('orders');
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [progress, setProgress] = useState<string[]>([]);

  const getMonthsBetween = (start: string, end: string): string[] => {
    const months: string[] = [];
    const startDate = new Date(start + '-01');
    const endDate = new Date(end + '-01');
    
    const current = new Date(startDate);
    while (current <= endDate) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      months.push(`${year}-${month}`);
      current.setMonth(current.getMonth() + 1);
    }
    
    return months;
  };

  const handleGenerate = async () => {
    if (!startMonth) {
      setMessage({ type: 'error', text: 'Please select a start month' });
      return;
    }

    setIsGenerating(true);
    setMessage(null);
    setProgress([]);

    const monthsToGenerate = endMonth && endMonth >= startMonth 
      ? getMonthsBetween(startMonth, endMonth)
      : [startMonth];

    const results: { month: string; success: boolean; message: string }[] = [];

    for (const month of monthsToGenerate) {
      setProgress(prev => [...prev, `Generating ${exportType} for ${month}...`]);
      
      const result = await generateMonthlyExport(month, exportType);
      
      results.push({
        month,
        success: result.success,
        message: result.success ? (result.message || 'Success') : (result.error || 'Failed')
      });
      
      setProgress(prev => [...prev, `✓ ${month}: ${result.success ? 'Success' : result.error || 'Failed'}`]);
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    if (failCount === 0) {
      setMessage({ 
        type: 'success', 
        text: `Successfully generated ${successCount} export${successCount > 1 ? 's' : ''} for ${exportType}` 
      });
      setStartMonth('');
      setEndMonth('');
    } else {
      setMessage({ 
        type: 'error', 
        text: `Generated ${successCount} exports, ${failCount} failed. See details above.` 
      });
    }

    setIsGenerating(false);
  };

  // Get current month in YYYY-MM format for max date
  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="startMonth" className="block text-sm font-medium text-gray-700 mb-2">
            Start Month
          </label>
          <Input
            id="startMonth"
            type="month"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            max={currentMonth}
            disabled={isDevMode || isGenerating}
            placeholder="Select start month"
          />
        </div>

        <div>
          <label htmlFor="endMonth" className="block text-sm font-medium text-gray-700 mb-2">
            End Month <span className="text-gray-500 font-normal">(optional)</span>
          </label>
          <Input
            id="endMonth"
            type="month"
            value={endMonth}
            onChange={(e) => setEndMonth(e.target.value)}
            min={startMonth}
            max={currentMonth}
            disabled={isDevMode || isGenerating || !startMonth}
            placeholder="Same as start"
          />
        </div>

        <div>
          <label htmlFor="exportType" className="block text-sm font-medium text-gray-700 mb-2">
            Export Type
          </label>
          <select
            id="exportType"
            value={exportType}
            onChange={(e) => setExportType(e.target.value as any)}
            disabled={isDevMode || isGenerating}
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="orders" className="text-gray-900 bg-white">Orders</option>
            <option value="order_items" className="text-gray-900 bg-white">Order Items</option>
            <option value="points_ledger" className="text-gray-900 bg-white">Points Ledger</option>
          </select>
        </div>
      </div>

      {progress.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Progress:</h4>
          <div className="space-y-1 text-sm text-gray-700 font-mono">
            {progress.map((msg, idx) => (
              <div key={idx}>{msg}</div>
            ))}
          </div>
        </div>
      )}

      {message && (
        <Alert variant={message.type}>
          {message.text}
        </Alert>
      )}

      <div className="flex items-start gap-3">
        <Button
          onClick={handleGenerate}
          disabled={isDevMode || isGenerating || !startMonth}
          variant="primary"
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating...
            </>
          ) : (
            'Generate Export'
          )}
        </Button>
        
        <div className="text-sm text-gray-500 pt-2">
          <p className="font-medium">Generate exports for one or multiple months.</p>
          <p className="mt-1">Leave end month empty to generate just one month, or select a range to generate multiple months at once.</p>
        </div>
      </div>
    </div>
  );
}
