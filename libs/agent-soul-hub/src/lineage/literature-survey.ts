import { registerLineageSchema } from 'agent-lib/core';
import type { LineageSchema } from 'agent-lib/core';

export const literatureSurveyLineage: LineageSchema = {
  id: 'literature-survey',
  name: 'Literature Survey Lineage',
  description:
    'Multi-level lineage for systematic literature surveys. Chief router delegates to search routers, which in turn manage specialized worker agents.',
  root: {
    role: 'router',
    soulToken: 'chief-router',
    name: 'Chief Router',
    children: [
      {
        role: 'router',
        soulToken: 'article-retrieve-router',
        name: 'Article Retrieve Router',
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
