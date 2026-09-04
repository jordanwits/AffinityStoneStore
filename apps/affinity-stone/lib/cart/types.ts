import type { Availability } from '@/lib/inventory/availability';

export interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface Cart {
  items: CartItem[];
}

export interface CartItemWithDetails extends CartItem {
  productName: string;
  variantName?: string;
  pointsPerItem: number;
  totalPoints: number;
  imageUrl?: string;
  /** True when product.collections includes the Affinity collection (restricted points apply first). */
  affinityEligible?: boolean;
  /**
   * Stock band for this line at its current quantity. Absent only when the product could
   * not be loaded, where there is nothing to base a claim on.
   */
  availability?: Availability;
}
