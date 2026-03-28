import { registerLineageSchema } from 'agent-lib/core';
import type { LineageSchema } from 'agent-lib/core';

export const literatureSurveyLineage: LineageSchema = {
  id: 'literature-survey',
  name: 'Literature Survey Lineage',
  description:
    'Multi-level lineage for systematic literature surveys. Chief coordinator delegates to search/analysis/report coordinators, which in turn manage specialized worker agents.',
  root: {
    id: 'chief-coordinator',
    role: 'coordinator',
    soulToken: 'chief-coordinator',
    name: 'Chief Coordinator',
    children: [
      {
        id: 'search-coordinator',
        role: 'coordinator',
        soulToken: 'coordinator',
        name: 'Search Coordinator',
        children: [
          {
            id: 'epidemiology',
            role: 'worker',
            soulToken: 'epidemiology',
            name: 'Epidemiology & Risk Factors',
          },
          {
            id: 'pathophysiology',
            role: 'worker',
            soulToken: 'pathophysiology',
            name: 'Pathophysiology',
          },
          {
            id: 'diagnosis',
            role: 'worker',
            soulToken: 'diagnosis',
            name: 'Diagnosis & Screening',
          },
          {
            id: 'management',
            role: 'worker',
            soulToken: 'management',
            name: 'Disease Management',
          },
          {
            id: 'quality-of-life',
            role: 'worker',
            soulToken: 'quality-of-life',
            name: 'Quality of Life',
          },
          {
            id: 'emerging-treatments',
            role: 'worker',
            soulToken: 'emerging-treatments',
            name: 'Emerging Treatments',
          },
        ],
      },
      {
        id: 'analysis-coordinator',
        role: 'coordinator',
        soulToken: 'coordinator',
        name: 'Analysis Coordinator',
        children: [
          {
            id: 'paper-analysis',
            role: 'worker',
            soulToken: 'paper-analysis',
            name: 'Paper Analysis',
          },
        ],
      },
    ],
  },
};

registerLineageSchema(literatureSurveyLineage);
