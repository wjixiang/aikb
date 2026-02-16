# Skills Introspection

Generated: 2026-02-16

## Overview

This project implements a comprehensive academic writing and reviewing system built on a **four-layer model** that separates real (kernel, evidence) from virtual (narrative, assumptions) components of research papers.

## Architecture

### Core Philosophy: Four-Layer Model

All skills share a unified worldview defined in `skills/shared/four-layer-model.md`:

| Layer | Content | Reviewer Perspective |
|---|---|---|
| Kernel (Real) | Methods/formulas/propositions/mechanisms | Can it be proved or falsified? |
| Evidence (Real) | Experiment design/baselines/ablation/robustness | Reproducible and fair? |
| Narrative (Virtual) | Motivation/positioning/significance/implications | Self-consistent? Over-claiming? |
| Assumptions & Boundaries (Interface) | Validity/failure conditions/downgrade claims | Can it withstand attack? |

**Three-Item Extraction:**
- Storyline: pain → gap → method → key evidence → boundary
- Core insights: mechanistic conclusions stable under condition C
- External packaging: title/abstract/contributions (must not exceed evidence strength)

**Execution Paths:**
- Writing mode: `kernel → assumptions → evidence → narrative`
- Review mode: `narrative → assumptions → evidence → kernel` (reverse deconstruction)

---

## Skill Groups

### GROUP 1: Writing Workflow (STEP -1 to STEP 9)

**Orchestrator:** `writing`
- Runs end-to-end manuscript workflow for Q1-targeted engineering applied research
- Auto-pipeline execution: each step automatically invokes the next upon passing
- Hard gates: advances only when pass criteria met
- Output: `workflow_runs/<run-id>/` with 13 artifact files

**Step Skills:**

1. **writing-worldview** (STEP -1)
   - Four-layer worldview alignment before any work begins
   - Produces: `00-worldview-card.md`
   - Critical for preventing "big story, weak evidence" failures

2. **writing-novelty-gate** (STEP 0)
   - Go/no-go decision based on quantified gap
   - A/B/C/D classification
   - Produces: `01-step0-novelty-gate.md`

3. **writing-core-assumptions** (STEP 1-2)
   - Method kernel with full formula chains
   - Assumption register with dependency mapping
   - Claim typing: proposition vs narrative
   - Produces: `02-step1-method-core.md`, `03-step2-assumption-register.md`

4. **writing-evidence-pilot** (STEP 3-3.5)
   - Freezes baseline fairness rules
   - Scenario matrix + compute budget
   - Pilot validation with rollback control
   - Produces: `04-step3-evidence-plan.md`, `05-step35-pilot-report.md`

5. **writing-experiments-figures** (STEP 4-5)
   - Full reproducible experiments under frozen rules
   - Publication figure boards (mechanism + cross-scenario stability)
   - Produces: `06-step4-exp-log.md`, `07-step4-findings.md`, `08-step5-figure-board.md`

6. **writing-narrative-journal** (STEP 6-8)
   - Anchored narrative drafting
   - Reader-order reorganization
   - Target journal adaptation
   - Produces: `09-step6-draft.md`, `10-step7-reader-order.md`, `11-step8-journal-fit-card.md`

7. **reviewing-checklist** (STEP 9) — delegated to GROUP 2
   - Final submission gate
   - Produces: `12-step9-submission-gate.md`

---

### GROUP 2: Reviewing Workflow (R1-R5)

**Orchestrator:** `reviewing`
- Three routes: checklist-only (A), R1-R5 deep review (B), complete (C)
- Auto-pipeline execution
- Output: `review_runs/<run-id>/` with up to 4 artifact files

**Step Skills:**

1. **reviewing-r1-r2** (R1-R2)
   - Outer scan + four-layer mapping
   - Storyline candidate extraction
   - Separates core insights from external packaging
   - Supports confidence levels L0/L1/L2
   - Produces: `01-r1-r2-deconstruction.md`

2. **reviewing-r3** (R3)
   - Adversarial pressure testing
   - Attacks assumptions, evidence fairness, narrative overreach
   - Prioritized repair suggestions
   - Includes Stuck Protocol
   - Produces: `02-r3-adversarial-audit.md`

3. **reviewing-r4-r5** (R4-R5)
   - R4: Transfer actions to your own paper (with destination sections)
   - R5: Four-dimension scoring
   - Produces: `03-r4-r5-transfer-scoring.md`

4. **reviewing-checklist** (A-J Gate)
   - 69 items with [C]ritical/[M]ajor/[m]inor severity
   - Three reviewer personas: G1 (busy expert), G2 (rigorous PhD), G3 (hostile peer)
   - Gate rule: 0 [C] + 0 [M] failures = submission approved
   - Produces: `04-checklist-gate.md` (or `12-step9-submission-gate.md` when called from writing)

---

### GROUP 3: Dissecting Workflow

**Orchestrator:** `dissecting`
- Extracts reusable writing assets from published papers
- Key differentiator: **input preprocessing layer**
- Delegates R1-R5 to GROUP 2 skills after preprocessing

**Input Modes:**
- Mode A (Minimal): title + abstract → L0 confidence
- Mode B (Text): full sections → L1 confidence
- Mode C (PDF): PDF file → L1 confidence
- Mode D (Enhanced): B/C + figures/tables/supplementary → L2 confidence

**Confidence Levels:**
- L0: Storyline candidate only; no mechanistic strong judgments
- L1: Core insight drafts with boundary notes
- L2: High-confidence insights + transfer suggestions

**Degradation Strategy:**
- Missing method → narrative analysis only
- Missing experiments → attack points but no fairness conclusions
- Missing discussion → "implied boundary uncertain" warning
- Figure parsing fails → use captions, downgrade confidence

**Output:**
- `00-dissecting-preprocess.md` (preprocessing report)
- Then delegates to reviewing-r1-r2, reviewing-r3, reviewing-r4-r5

---

### Supporting Skills

**literature-toolkit**
- Multi-source academic literature retrieval (OpenAlex, Crossref, arXiv)
- Two modes: `explore` (high recall) vs `focus` (precision filtering)
- Deterministic with reproducible artifacts
- Output: `query-plan.json`, `records.csv`, `summary.md`
- Deduplication by DOI + title fallback
- Scoring: relevance + recency + citations

**keybindings-help**
- Keyboard shortcut customization
- Manages `~/.claude/keybindings.json`

---

## Shared Resources

### `skills/shared/`

1. **four-layer-model.md**
   - Core worldview definition
   - Used by all writing/reviewing/dissecting skills

2. **worldview-card-template.md**
   - Template for worldview alignment output

3. **strength-calibration.md**
   - Evidence strength calibration guidelines
   - Prevents over-claiming

---

## Key Design Patterns

### 1. Auto-Pipeline Execution
Both `writing` and `reviewing` orchestrators automatically invoke the next step upon passing current step's criteria. No manual intervention unless:
- Pass criteria fail
- Rollback triggered
- Final step completes
- User explicitly requests single-step mode

### 2. Hard Gates
- Each step has explicit pass criteria
- Must generate artifact file before advancing
- For Q1 target: 0 [C] + 0 [M] failures required

### 3. Artifact Contracts
All outputs use **PROJECT ROOT relative paths**:
- `workflow_runs/<run-id>/` for writing workflow
- `review_runs/<run-id>/` for reviewing/dissecting workflows
- UTF-8 BOM encoding on Windows

### 4. Cross-Group Delegation
- `writing` (STEP 9) → `reviewing-checklist`
- `dissecting` (R1-R5) → `reviewing-r1-r2`, `reviewing-r3`, `reviewing-r4-r5`

### 5. Stuck Protocols
Every skill includes explicit "Stuck Protocol" for common failure modes with concrete recovery actions.

### 6. Confidence-Aware Processing
`dissecting` assigns L0/L1/L2 confidence levels based on input completeness, constraining output strength accordingly.

---

## Workflow Comparison

| Aspect | Writing | Reviewing | Dissecting |
|---|---|---|---|
| **Purpose** | Create new manuscript | Evaluate draft/paper | Extract reusable assets |
| **Direction** | Forward (kernel → narrative) | Reverse (narrative → kernel) | Reverse + preprocessing |
| **Steps** | STEP -1 to STEP 9 | R1-R5 + checklist | Preprocess + R1-R5 |
| **Output Dir** | `workflow_runs/` | `review_runs/` | `review_runs/` |
| **Hard Gates** | Yes (each step) | Yes (each route) | Yes (quality gate) |
| **Auto-Pipeline** | Yes | Yes | Yes |

---

## Usage Examples

### Start a new manuscript:
```
/writing
"Run writing workflow from worldview for topic: GNSS integrity in heterogeneous fleets."
```

### Review a paper:
```
/reviewing
"Review this paper with full R1-R5 + checklist." (Route C)
```

### Dissect a published paper:
```
/dissecting
"Dissect this paper: <title + abstract>." (Mode A)
```

### Search literature:
```
/literature-toolkit
"Search literature for topic: eVTOL safety with include terms robust, safety."
```

### Pre-submission check:
```
/reviewing-checklist
"Run checklist gate on my draft."
```

---

## Quality Assurance

### Evidence Anchors
Every strong claim must trace to:
- A proposition (formula/theorem)
- A figure/table
- An experiment result

### Strength Calibration
- External packaging strength ≤ weakest evidence strength
- Core insights must state applicability boundaries
- L0 confidence forbids "prove/confirm/universal" wording

### Reproducibility
- All literature searches produce `query-plan.json` for exact reproduction
- All experiments run under frozen baseline rules
- All artifacts use deterministic file naming

---

## File Structure

```
skills/
├── shared/                          # Shared models and templates
│   ├── four-layer-model.md
│   ├── worldview-card-template.md
│   └── strength-calibration.md
├── writing/                         # GROUP 1 orchestrator
├── writing-worldview/               # STEP -1
├── writing-novelty-gate/            # STEP 0
├── writing-core-assumptions/        # STEP 1-2
├── writing-evidence-pilot/          # STEP 3-3.5
├── writing-experiments-figures/     # STEP 4-5
├── writing-narrative-journal/       # STEP 6-8
├── reviewing/                       # GROUP 2 orchestrator
├── reviewing-r1-r2/                 # R1-R2
├── reviewing-r3/                    # R3
├── reviewing-r4-r5/                 # R4-R5
├── reviewing-checklist/             # A-J gate (STEP 9 or standalone)
├── dissecting/                      # GROUP 3 orchestrator
└── literature-toolkit/              # Supporting tool

Each skill directory contains:
├── SKILL.md                         # Skill definition and usage
└── references/                      # Templates, checklists, specs
```

---

## Integration Points

### With Claude Code
- Skills invoked via `/skill-name` syntax
- Auto-loaded from `skills/` directory
- Each `SKILL.md` has YAML frontmatter with name and description

### With Agent Library
- Skills can be orchestrators (delegate to other skills)
- Skills can be atomic executors (run scripts, generate files)
- All skills follow artifact contract for file outputs

### With Literature APIs
- `literature-toolkit` integrates OpenAlex, Crossref, arXiv
- Deterministic query plans for reproducibility
- Automatic deduplication and scoring

---

## Future Considerations

### Potential Enhancements
1. Add skill for automated figure generation from experiment logs
2. Add skill for related work section generation from literature search
3. Add skill for rebuttal letter generation from reviewer comments
4. Add skill for grant proposal adaptation from manuscript

### Maintenance Notes
1. Keep `four-layer-model.md` as single source of truth
2. Update `strength-calibration.md` when new evidence types emerge
3. Sync checklist items with latest journal requirements
4. Version control `query-plan.json` format for backward compatibility

---

## Conclusion

This skill system implements a rigorous, gate-based academic writing methodology that:
- Separates real (kernel, evidence) from virtual (narrative, assumptions)
- Enforces evidence-anchored claims
- Prevents over-claiming through strength calibration
- Supports both forward (writing) and reverse (reviewing/dissecting) workflows
- Provides reproducible, artifact-based execution
- Includes explicit failure recovery protocols

The architecture is modular (orchestrators delegate to atomic skills), deterministic (artifact contracts), and quality-gated (hard pass criteria at each step).
