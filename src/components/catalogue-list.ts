/**
 * Shared bits for the draggable catalogue lists (#69).
 */

/**
 * Every row is the same height, which the sortable list needs in order to know
 * where a dragged row lands. Uniform rows are also what a native table does.
 */
export const RowHeight = 56;

/**
 * The drag handle's touch area.
 *
 * Wider than the glyph on purpose. `SortableItem.Handle` puts its
 * `GestureDetector` around a view styled by its *own* `style` prop — sizing a
 * view nested inside it leaves the gesture view wrapped tight around the
 * glyph, so only the drawn lines start a drag (#69).
 */
export const HandleWidth = 56;

/**
 * The library reports a drop as a map of id → position. Persisting an order
 * means turning that back into a list.
 */
export function orderedIds(positions: Record<string, number> | undefined): string[] {
  if (!positions) return [];
  return Object.entries(positions)
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id);
}
