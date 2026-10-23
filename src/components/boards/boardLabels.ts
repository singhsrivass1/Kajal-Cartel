export const BOARD_EVENT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'wedding', label: 'Wedding' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'sangeet', label: 'Sangeet' },
  { value: 'mehendi', label: 'Mehendi' },
  { value: 'haldi', label: 'Haldi' },
  { value: 'reception', label: 'Reception' },
  { value: 'cocktail', label: 'Cocktail' },
  { value: 'party', label: 'Party' },
  { value: 'pre-wedding-shoot', label: 'Pre-wedding shoot' },
  { value: 'other', label: 'Other' },
];

export function eventLabel(value: string): string {
  return BOARD_EVENT_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
