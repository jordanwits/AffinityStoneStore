'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'core/components/Button';
import Link from 'next/link';
import { setProductActive, deleteProduct } from './actions';

interface ProductRowActionsProps {
  productId: string;
  productName: string;
  isActive: boolean;
  isDevMode: boolean;
}

export function ProductRowActions({ productId, productName, isActive, isDevMode }: ProductRowActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleToggleActive = async () => {
    if (isDevMode) return;
    
    setLoading(true);
    const result = await setProductActive(productId, !isActive);
    setLoading(false);
    
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error || 'Failed to update product status');
    }
  };

  const handleDelete = async () => {
    if (isDevMode) return;
    
    const confirmed = confirm(
      `Are you sure you want to delete "${productName}"?\n\nThis action cannot be undone. The product and all its variants will be permanently deleted.`
    );
    
    if (!confirmed) return;
    
    setLoading(true);
    const result = await deleteProduct(productId);
    setLoading(false);
    
    if (result.success) {
      router.refresh();
    } else {
      alert(result.error || 'Failed to delete product');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Link href={`/admin/products/${productId}/edit`}>
        <Button variant="outline" size="sm" disabled={isDevMode}>
          Edit
        </Button>
      </Link>
      <Button
        variant={isActive ? 'outline' : 'primary'}
        size="sm"
        onClick={handleToggleActive}
        disabled={isDevMode || loading}
      >
        {loading ? '...' : (isActive ? 'Deactivate' : 'Activate')}
      </Button>
      <Button
        variant="danger"
        size="sm"
        onClick={handleDelete}
        disabled={isDevMode || loading}
      >
        Delete
      </Button>
    </div>
  );
}
