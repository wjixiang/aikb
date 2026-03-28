import { registerLineageSchema } from 'agent-lib/core';
import type { LineageSchema } from 'agent-lib/core';

export const literatureSurveyLineage: LineageSchema = {
  id: 'literature-survey',
  name: 'Literature Survey Lineage',
  description:
    'Multi-level lineage for systematic literature surveys. Chief coordinator delegates to search coordinators, which in turn manage specialized worker agents.',
  root: {
    role: 'coordinator',
    soulToken: 'chief-coordinator',
    name: 'Chief Coordinator',
    children: [
      {
        role: 'coordinator',
        soulToken: 'coordinator',
        name: 'Search Coordinator',
        children: [
          {
            role: 'worker',
            soulToken: 'epidemiology',
            name: 'Epidemiology & Risk Factors',
          },
          {
            role: 'worker',
            soulToken: 'pathophysiology',
            name: 'Pathophysiology',
          },
          {
            role: 'worker',
            soulToken: 'diagnosis',
            name: 'Diagnosis & Screening',
          },
          {
            role: 'worker',
            soulToken: 'management',
            name: 'Disease Management',
          },
          {
            role: 'worker',
            soulToken: 'quality-of-life',
            name: 'Quality of Life',
          },
          {
            role: 'worker',
            soulToken: 'emerging-treatments',
            name: 'Emerging Treatments',
          },
        ],
      },
    ],
  },
};

registerLineageSchema(literatureSurveyLineage);
