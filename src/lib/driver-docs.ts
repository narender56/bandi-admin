import type { DriverDocType } from './actions';

// Documents that legally expire — these require an expiry date and block the
// driver from going online once expired (enforced in DB check_go_online).
export const EXPIRING_DOC_TYPES: DriverDocType[] = [
  'license',
  'insurance',
  'puc',
  'rc',
  'permit',
];
