import { PixelRatio } from 'react-native';

/**
 * Dimensions that follow the text size (N10, #48).
 *
 * Text scales on its own — `allowFontScaling` is on by default and nothing in
 * this app turns it off. What does not scale is the box around it, so a row
 * fixed at 56pt clips its own label the moment someone raises the text size,
 * and the app quietly becomes unusable for the person who needed the setting.
 *
 * `minHeight` solves that wherever a box may simply grow. Where it cannot —
 * the catalogue's draggable rows have to be a uniform, known height for the
 * sortable list to work out where a dragged row lands — the height has to
 * scale instead, which is what this is for.
 *
 * **Capped at 2×.** iOS accessibility sizes go far beyond that, and an
 * uncapped row at the largest setting would be taller than the screen: one row
 * visible, nothing draggable past it. Two steps of growth is the compromise
 * between respecting the setting and leaving a list that is still a list.
 *
 * Read once, at module load. iOS can change the text size while the app is
 * running and this will not follow until the next launch — worth knowing, not
 * worth the machinery, since nobody changes it mid-session.
 */
export function scaled(size: number, cap = 2): number {
  return Math.round(size * Math.min(PixelRatio.getFontScale(), cap));
}
