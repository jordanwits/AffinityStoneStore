/**
 * What a made-to-order line actually asks of the fulfillment team.
 *
 * Since 037 a made-to-order line draws whatever is on hand before the rest is made, so the
 * flag alone no longer answers "how many do we make?" — a line of 3 with 1 on the shelf
 * needs 2. Anything that shows order lines reads the count through here so a partial draw
 * is never rounded up to "make all of them" or silently dropped.
 */

export interface OrderItemFulfillmentInput {
  quantity: number;
  units_from_stock?: number | null;
  made_to_order?: boolean | null;
}

export interface OrderItemProcurement {
  label: string;
  /** Pill classes for the admin tables, matching orderStatusPillClasses. */
  pillClasses: string;
}

/** Null for a line with nothing to say: a stocked product came off the shelf as always. */
export function orderItemProcurement(
  item: OrderItemFulfillmentInput
): OrderItemProcurement | null {
  if (!item.made_to_order) {
    return null;
  }

  const fromStock = item.units_from_stock ?? 0;
  const toMake = item.quantity - fromStock;

  if (toMake <= 0) {
    return { label: 'From stock', pillClasses: 'bg-green-100 text-green-900' };
  }

  if (toMake < item.quantity) {
    return {
      label: `Make ${toMake} of ${item.quantity}`,
      pillClasses: 'bg-amber-100 text-amber-900',
    };
  }

  return { label: 'Made to Order', pillClasses: 'bg-amber-100 text-amber-900' };
}
