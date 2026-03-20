import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * Structured output for medical literature summarization
 */
export interface MedicalLiteratureSummary {
  metadata: {
    title: string;
    authors: string[];
    journal: string;
    publicationYear: number;
    doi?: string;
    abstract: string;
  };
  pico: {
    population: {
      description: string;
      sampleSize: number;
      inclusionCriteria: string[];
      exclusionCriteria: string[];
      demographics: {
        ageRange: string;
        gender?: string;
        diseaseStatus: string;
      };
    };
    intervention: {
      name: string;
      dosage?: string;
      duration?: string;
      route?: string;
      comparator?: string;
    };
    outcome: {
      primaryOutcomes: string[];
      secondaryOutcomes: string[];
      measurementTools: string[];
      followUpDuration?: string;
    };
  };
  studyDesign: {
    designType: string;
    blinding?: string;
    randomization?: string;
    duration?: string;
    numCenters?: number;
    country?: string;
    setting?: string;
  };
  results: {
    mainFindings: string;
    effectMeasures: {
      relativeRisk?: string;
      oddsRatio?: string;
      hazardRatio?: string;
      meanDifference?: string;
      confidenceInterval?: string;
    };
    pValue?: string;
    nnt?: number;
    adverseEvents: string[];
  };
  riskOfBias: {
    selectionBias: string;
    performanceBias: string;
    detectionBias: string;
    attritionBias: string;
    reportingBias: string;
    overall: string;
    concerns: string[];
  };
  qualityAssessment: {
    strengths: string[];
    limitations: string[];
    gapsInEvidence: string[];
  };
  clinicalImplications: {
    keyFindings: string;
    clinicalRelevance: string;
    applicability: string;
    recommendations: string[];
    safetyConcerns: string[];
  };
  plainEnglishSummary: string;
  keywords: string[];
}

export interface LiteratureSummaryResult {
  success: boolean;
  summary?: MedicalLiteratureSummary;
  error?: string;
  processingTimeMs?: number;
}

export interface PICOExtractionResult {
  success: boolean;
  population?: MedicalLiteratureSummary['pico']['population'];
  intervention?: MedicalLiteratureSummary['pico']['intervention'];
  outcome?: MedicalLiteratureSummary['pico']['outcome'];
  error?: string;
}

const SUMMARIZATION_PROMPT = `You are an expert in evidence-based medicine and systematic review.
Analyze the following medical literature article and provide a comprehensive structured summary in JSON format.

Article Content:
{{content}}

Output the result as valid JSON matching this exact schema (use null for unknown optional fields):
{
  "metadata": {
    "title": "string - paper title",
    "authors": ["string array - author names"],
    "journal": "string - journal name",
    "publicationYear": "integer - publication year",
    "doi": "string or null",
    "abstract": "string - paper abstract"
  },
  "pico": {
    "population": {
      "description": "string - population description",
      "sampleSize": "integer - number of participants",
      "inclusionCriteria": ["array of strings"],
      "exclusionCriteria": ["array of strings"],
      "demographics": {
        "ageRange": "string - e.g., '18-65 years'",
        "gender": "string or null",
        "diseaseStatus": "string - disease/condition studied"
      }
    },
    "intervention": {
      "name": "string - intervention name",
      "dosage": "string or null",
      "duration": "string or null",
      "route": "string or null - e.g., 'oral', 'IV'",
      "comparator": "string or null - control/comparison group"
    },
    "outcome": {
      "primaryOutcomes": ["array of primary outcomes"],
      "secondaryOutcomes": ["array of secondary outcomes"],
      "measurementTools": ["array of measurement tools/scales"],
      "followUpDuration": "string or null"
    }
  },
  "studyDesign": {
    "designType": "string - e.g., 'RCT', 'Cohort', 'Case-Control'",
    "blinding": "string or null",
    "randomization": "string or null",
    "duration": "string or null",
    "numCenters": "integer or null",
    "country": "string or null",
    "setting": "string or null"
  },
  "results": {
    "mainFindings": "string - main study findings",
    "effectMeasures": {
      "relativeRisk": "string or null",
      "oddsRatio": "string or null",
      "hazardRatio": "string or null",
      "meanDifference": "string or null",
      "confidenceInterval": "string or null"
    },
    "pValue": "string or null",
    "nnt": "integer or null - number needed to treat",
    "adverseEvents": ["array of adverse events"]
  },
  "riskOfBias": {
    "selectionBias": "string - Low/Moderate/High/Unknown",
    "performanceBias": "string - Low/Moderate/High/Unknown",
    "detectionBias": "string - Low/Moderate/High/Unknown",
    "attritionBias": "string - Low/Moderate/High/Unknown",
    "reportingBias": "string - Low/Moderate/High/Unknown",
    "overall": "string - overall risk assessment",
    "concerns": ["array of specific concerns"]
  },
  "qualityAssessment": {
    "strengths": ["array of study strengths"],
    "limitations": ["array of limitations"],
    "gapsInEvidence": ["array of evidence gaps"]
  },
  "clinicalImplications": {
    "keyFindings": "string - key clinical findings",
    "clinicalRelevance": "string - clinical relevance",
    "applicability": "string - external validity/applicability",
    "recommendations": ["array of clinical recommendations"],
    "safetyConcerns": ["array of safety concerns"]
  },
  "plainEnglishSummary": "string - 2-3 sentence summary for non-experts",
  "keywords": ["array of 5-10 keywords"]
}

Return ONLY the JSON, no markdown formatting or explanation.`;

const PICO_PROMPT = `Extract the PICO (Population, Intervention, Comparator, Outcome) elements from this medical literature:

{{content}}

Output ONLY valid JSON matching this schema:
{
  "population": {
    "description": "string",
    "sampleSize": "integer (use 0 if unknown)",
    "inclusionCriteria": ["array of strings"],
    "exclusionCriteria": ["array of strings"],
    "demographics": {
      "ageRange": "string",
      "gender": "string or null",
      "diseaseStatus": "string"
    }
  },
  "intervention": {
    "name": "string",
    "dosage": "string or null",
    "duration": "string or null",
    "route": "string or null",
    "comparator": "string or null"
  },
  "outcome": {
    "primaryOutcomes": ["array of strings"],
    "secondaryOutcomes": ["array of strings"],
    "measurementTools": ["array of strings"],
    "followUpDuration": "string or null"
  }
}

Return ONLY the JSON, no markdown formatting.`;

@Injectable()
export class LiteratureSummaryService {
  private readonly logger = new Logger(LiteratureSummaryService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.apiUrl = process.env.LLM_API_URL || 'https://api.minimaxi.com/anthropic/v1/messages';
    this.apiKey = process.env.MINIMAX_API_KEY || '';
  }

  /**
   * Summarize medical literature with full structured output
   */
  async summarizeLiterature(content: string): Promise<LiteratureSummaryResult> {
    const startTime = Date.now();

    try {
      this.logger.log('Starting literature summarization...');

      if (!this.apiKey) {
        throw new Error('MINIMAX_API_KEY environment variable is not set');
      }

      const prompt = SUMMARIZATION_PROMPT.replace('{{content}}', content);

      const response = await this.callLLM(prompt);
      const summary = this.parseJsonResponse<MedicalLiteratureSummary>(response);

      return {
        success: true,
        summary,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Literature summarization failed: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Extract PICO elements only
   */
  async extractPICO(content: string): Promise<PICOExtractionResult> {
    try {
      this.logger.log('Extracting PICO elements...');

      if (!this.apiKey) {
        throw new Error('MINIMAX_API_KEY environment variable is not set');
      }

      const prompt = PICO_PROMPT.replace('{{content}}', content);
      const response = await this.callLLM(prompt);

      const pico = this.parseJsonResponse<{
        population?: MedicalLiteratureSummary['pico']['population'];
        intervention?: MedicalLiteratureSummary['pico']['intervention'];
        outcome?: MedicalLiteratureSummary['pico']['outcome'];
      }>(response);

      return {
        success: true,
        population: pico.population,
        intervention: pico.intervention,
        outcome: pico.outcome,
      };
    } catch (error) {
      this.logger.error(`PICO extraction failed: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Summarize multiple papers for systematic review
   */
  async summarizeMultiplePapers(papers: Array<{
    content: string;
    title?: string;
    citation?: string;
  }>): Promise<{
    success: boolean;
    summaries?: MedicalLiteratureSummary[];
    synthesis?: string;
    themes?: string[];
    conflicts?: string[];
    gaps?: string[];
    error?: string;
  }> {
    try {
      this.logger.log(`Summarizing ${papers.length} papers...`);

      if (!this.apiKey) {
        throw new Error('MINIMAX_API_KEY environment variable is not set');
      }

      const papersText = papers
        .map((p, i) => `=== Paper ${i + 1} ===\nTitle: ${p.title || 'Untitled'}\n${p.citation ? `Citation: ${p.citation}\n` : ''}Content:\n${p.content}`)
        .join('\n\n');

      const prompt = `You are an expert in evidence-based medicine and systematic review.
Analyze the following multiple medical papers and provide:
1. Individual summaries of each paper
2. A synthesis comparing all papers
3. Common themes identified
4. Any conflicts or discrepancies between findings
5. Gaps in the evidence

Papers:
${papersText}

Output ONLY valid JSON with this structure:
{
  "summaries": [
    {
      "title": "string",
      "metadata": { "title": "string", "authors": ["string"], "journal": "string", "publicationYear": 0, "doi": null, "abstract": "string" },
      "pico": { "population": {...}, "intervention": {...}, "outcome": {...} },
      "studyDesign": { "designType": "string" },
      "results": { "mainFindings": "string", "effectMeasures": {...}, "adverseEvents": [] },
      "riskOfBias": { "selectionBias": "string", "performanceBias": "string", "detectionBias": "string", "attritionBias": "string", "reportingBias": "string", "overall": "string", "concerns": [] },
      "qualityAssessment": { "strengths": [], "limitations": [], "gapsInEvidence": [] },
      "clinicalImplications": { "keyFindings": "string", "clinicalRelevance": "string", "applicability": "string", "recommendations": [], "safetyConcerns": [] },
      "plainEnglishSummary": "string",
      "keywords": []
    }
  ],
  "synthesis": "string - comparative synthesis of all papers",
  "themes": ["array of common themes"],
  "conflicts": ["array of conflicts/discrepancies"],
  "gaps": ["array of evidence gaps"]
}

Return ONLY the JSON.`;

      const response = await this.callLLM(prompt);

      const result = this.parseJsonResponse<{
        summaries?: MedicalLiteratureSummary[];
        synthesis?: string;
        themes?: string[];
        conflicts?: string[];
        gaps?: string[];
      }>(response);

      return {
        success: true,
        summaries: result.summaries,
        synthesis: result.synthesis,
        themes: result.themes,
        conflicts: result.conflicts,
        gaps: result.gaps,
      };
    } catch (error) {
      this.logger.error(`Multiple paper summarization failed: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Call LLM API
   */
  private async callLLM(prompt: string): Promise<string> {
    const response = await axios.post(
      this.apiUrl,
      {
        model: "minimax-m2.5-highspeed",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 8192,
        temperature: 0.3,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        timeout: 120000,
      }
    );

    // Handle different API response formats
    const content = response.data.content?.[0]?.text
      || response.data.choices?.[0]?.message?.content
      || response.data.text
      || '';

    if (!content) {
      throw new Error('Empty response from LLM API');
    }

    return content;
  }

  /**
   * Parse JSON from LLM response
   */
  private parseJsonResponse<T>(response: string): T {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.trim();

    // Try to find JSON object
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!objectMatch) {
      throw new Error('No JSON found in response');
    }

    try {
      return JSON.parse(objectMatch[0]) as T;
    } catch (error) {
      this.logger.error(`Failed to parse JSON: ${objectMatch[0].substring(0, 200)}...`);
      throw new Error('Failed to parse JSON response from LLM');
    }
  }
}
