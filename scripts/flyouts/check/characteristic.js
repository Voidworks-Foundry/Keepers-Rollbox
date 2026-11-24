/**
 * Builds the Check flyout's Characteristic tab, with values only for one character. See docs/check-flyout.md.
 * @param {{choices: object, single: boolean, panel: Function, list: Function, row: Function}} flyout
 * @returns {HTMLElement}
 */
export function characteristicPanel(flyout) {
  const panel = flyout.panel("characteristic");
  const list = flyout.list("characteristic");
  for (const choice of flyout.choices.characteristic) {
    list.append(flyout.row(choice.key, choice.check, choice.name, flyout.single ? choice : undefined));
  }
  panel.append(list);
  return panel;
}
