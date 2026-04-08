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
}
