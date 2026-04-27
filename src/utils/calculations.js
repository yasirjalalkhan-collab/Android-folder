// ── Timber 360 Calculation Engine — exact port from HTML ────

import { formatInchesToFt } from './helpers';

export const STD_WIDTHS  = [27, 30, 33, 36, 39, 42, 45, 48];
export const TYPE_DOOR    = 'door';
export const TYPE_SKIN    = 'skin';
export const TYPE_PLYWOOD = 'plywood';
export const TYPE_WOOD    = 'wood';

export const ITEM_TYPES = [
  { id: TYPE_DOOR,    label: 'Door'    },
  { id: TYPE_SKIN,    label: 'Skins'   },
  { id: TYPE_PLYWOOD, label: 'Plywood' },
  { id: TYPE_WOOD,    label: 'Wood'    },
];

export const EXPENSE_CATEGORIES = [
  'Rent','Salaries','Utilities','Transport',
  'Raw Material','Repair & Maintenance','Miscellaneous','Custom',
];

export const calculateDoor = (wIn, hTotalIn, rate, calcMode = 'standard') => {
  const w   = parseFloat(wIn)      || 0;
  const hIn = parseFloat(hTotalIn) || 0;
  let billW  = w;
  let billH_Ft = hIn / 12;

  if (calcMode === 'standard') {
    billW    = STD_WIDTHS.find(std => std >= w) || (w > 48 ? w : 48);
    billH_Ft = (hIn <= 84 && hIn > 0)  ? 7
             : (hIn > 84 && hIn <= 96) ? 8
             : (hIn > 96)              ? 9
             : Math.ceil(hIn / 12);
  }

  const finalW    = calcMode === 'standard' ? billW : w;
  const finalH_In = calcMode === 'standard' ? billH_Ft * 12 : hIn;
  const sqFt      = (finalW * finalH_In) / 144;

  return {
    displaySize: `${w}" x ${formatInchesToFt(hIn)}`,
    billingSize:  calcMode === 'standard'
      ? `${billW}" x ${billH_Ft}'`
      : `${w}" x ${formatInchesToFt(hIn)} (Act)`,
    unit:    'Sq.Ft',
    qtyUnit: sqFt,
    amount:  sqFt * rate,
  };
};

export const calculateWood = (l, w, t, unitWT, unitL, rate) => {
  const val  = parseFloat(l) || 0;
  const toIn = (v) => unitWT === 'mm'
    ? (parseFloat(v) || 0) / 25.4
    : (parseFloat(v) || 0);

  let l_in = 0;
  if      (unitL === 'ft') l_in = val * 12;
  else if (unitL === 'm')  l_in = val * 39.3701;
  else                     l_in = val;

  const w_in = toIn(w);
  const t_in = toIn(t);
  const vol  = (l_in * w_in * t_in) / 1728;

  // 4 decimal precision — 8ft x 8in x 1in = 0.4444 Cu.Ft
  const vol4 = Math.round(vol * 10000) / 10000;
  return {
    displaySize: `${l}${unitL} x ${w}${unitWT} x ${t}${unitWT}`,
    billingSize: `${l_in.toFixed(1)}" x ${w_in.toFixed(1)}" x ${t_in.toFixed(1)}"`,
    unit:    'Cu.Ft',
    qtyUnit: vol4,
    amount:  vol4 * rate,
  };
};

export const calculatePlywood = (rate) => ({
  displaySize: 'Standard Sheet',
  billingSize: 'Sheet',
  unit:    'Sheet',
  qtyUnit: 1,
  amount:  rate,
});
