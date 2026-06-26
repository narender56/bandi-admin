export const RANGE_KEYS = ['today', 'week', 'month', '3m', '6m', '1y', 'all', 'custom'] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export const RANGE_LABELS: Record<RangeKey, string> = {
  today: 'Today',
  week: 'This week',
  month: 'This month',
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '1y': 'Last year',
  all: 'All time',
  custom: 'Custom range',
};

export type Bucket = 'hour' | 'day' | 'month';

export interface ResolvedRange {
  key: RangeKey;
  from: Date;
  to: Date;
  bucket: Bucket;
}
