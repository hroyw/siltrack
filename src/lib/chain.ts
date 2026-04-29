import type { Branch } from '../types';

export const BRANCH_LABELS: Record<Branch, string> = {
  photovoltaic: '光伏链',
  organosilicon: '有机硅链',
  fiber: '光纤链（实验性）',
};

export const BRANCH_ORDER: Branch[] = ['photovoltaic', 'organosilicon', 'fiber'];
