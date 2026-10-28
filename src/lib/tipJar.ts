/**
 * Tip jar settings. Paste your Ko-fi, Buy Me a Coffee or Stripe payment link
 * here (e.g. 'https://ko-fi.com/yourname'). While it's empty, the Feed Walla
 * page still works — the leaves are just on the house and no prices are shown.
 */
export const TIP_URL = '';

export interface TipOption {
  leaves: number;
  label: string;
  price: string;
}

export const TIP_OPTIONS: TipOption[] = [
  { leaves: 1, label: 'A leaf', price: '$3' },
  { leaves: 3, label: 'A handful', price: '$5' },
  { leaves: 5, label: 'A whole branch', price: '$10' }
];
