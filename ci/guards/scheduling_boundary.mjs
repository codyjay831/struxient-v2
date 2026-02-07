/**
 * Scheduling Boundary Definition
 * 
 * This file defines the canonical entry points and forbidden patterns
 * for the scheduling subsystem. Guards use this to stay in sync.
 */

export const SCHEDULING_COMMIT_SURFACES = {
  // Layers allowed to call recordOutcome
  ALLOWED_LAYERS: [
    'src/lib/flowspec',
    'tests',
    'src/__tests__',
  ],
  // Layers strictly forbidden from calling recordOutcome
  FORBIDDEN_LAYERS: [
    'src/app/(app)',
    'src/app/api/calendar',
    'src/app/api/scheduling',
    'src/components/workstation',
  ],
};

// Canon schedule model names (must be exact matches)
export const GUARDED_SCHEDULE_MODELS = [
  'ScheduleBlock',
  'ScheduleChangeRequest',
];
