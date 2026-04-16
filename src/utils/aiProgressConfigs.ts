import type { AIProgressConfig } from '../hooks/useAIProgress';

export const TRAINING_PLAN_PROGRESS: AIProgressConfig = {
  mode: 'streaming',
  expectedTokens: 2500,
  phases: [
    { at: 0,  label: 'Connecting to AI...' },
    { at: 5,  label: 'Analyzing your data...' },
    { at: 25, label: 'Designing sessions...' },
    { at: 50, label: 'Building your plan...' },
    { at: 75, label: 'Adjusting details...' },
    { at: 90, label: 'Saving plan...' },
  ],
};

export const NUTRITION_PLAN_PROGRESS: AIProgressConfig = {
  mode: 'streaming',
  expectedTokens: 4000,
  phases: [
    { at: 0,  label: 'Connecting to AI...' },
    { at: 5,  label: 'Calculating your macros...' },
    { at: 20, label: 'Selecting foods...' },
    { at: 45, label: 'Building meal options...' },
    { at: 70, label: 'Balancing nutrients...' },
    { at: 90, label: 'Saving plan...' },
  ],
};

export const GOAL_PROGRESS: AIProgressConfig = {
  mode: 'timed',
  estimatedDurationMs: 12000,
  phases: [
    { at: 0,  label: 'Connecting to AI...' },
    { at: 10, label: 'Analyzing your goal...' },
    { at: 30, label: 'Defining progression phases...' },
    { at: 55, label: 'Identifying key exercises...' },
    { at: 80, label: 'Finalizing guide...' },
  ],
};

export const AGENT_PLAN_PROGRESS: AIProgressConfig = TRAINING_PLAN_PROGRESS;

export const FOOD_ANALYSIS_PROGRESS: AIProgressConfig = {
  mode: 'streaming',
  expectedTokens: 300,
  phases: [
    { at: 0,  label: 'Sending image...' },
    { at: 10, label: 'Analyzing photo...' },
    { at: 40, label: 'Estimating portions...' },
    { at: 70, label: 'Calculating macros...' },
    { at: 90, label: 'Finalizing...' },
  ],
};
