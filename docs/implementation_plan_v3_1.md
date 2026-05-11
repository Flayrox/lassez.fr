# Implementation Plan: Radar Cortex Industrial Upgrade (v3.1)

This plan outlines the technical roadmap for implementing **Auto-Throttling**, **Source Auto-Healing**, and **Parallel Agent Execution** to transform the Radar Cortex into a robust, high-performance investigative engine.

---

## 1. Feature: Auto-Throttling & 503 Resiliency
**Objective**: Eliminate "Model Overloaded" errors by intelligently managing request density.

### Technical Implementation
- **Queue Manager**: Implement a `ThrottledQueue` utility to wrap Gemini API calls.
- **Exponential Backoff**: When a 503 error is detected, the agent will wait (2s, 4s, 8s) before retrying.
- **Inter-Article Delay**: Introduce a mandatory `PIPELINE_COOLDOWN` (default: 5s) between article processing to stay within Gemini's RPM (Requests Per Minute) limits.

### Modified Files
- `radar_lassez/lib/agents/BaseAgent.js` (to be created as a parent class for all agents).
- `radar_lassez/lib/pipeline/Pipeline.js` (to handle the cooldown logic).

---

## 2. Feature: Source Health & Auto-Healing
**Objective**: Automatically identify and quarantine dead or blocking feeds to keep the logs clean and ingestion efficient.

### Technical Implementation
- **Health Tracking**: Add a `source_health` table in `radar.db` to track `last_status`, `error_count`, and `consecutive_failures`.
- **Quarantine Logic**:
    - If a source fails **3 times consecutively**, mark it as `DEGRADED`.
    - If it fails **5 times**, set it to `DISABLED` and send a high-priority alert to Discord.
- **Front-end / UI Management**:
    - **Quarantine Dashboard**: Integrate a dedicated "Source Errors" view within the Sources tab to manage degraded or disabled feeds.
    - **Manual Update**: Allow users to update the URL or settings of a quarantined source directly from the error list to try and reactivate it.

### Modified Files
- `radar_lassez/lib/providers/RSSProvider.js` (to report success/failure).
- `radar_lassez/lib/CoreEngine.js` (to manage the health DB logic).
- `app/(frontend)/radar-admin/settings/components/SourcesSection.tsx` (to display health badges and error dashboard).

---

## 3. Feature: Performance & Precision (Parallelism + Prompting)
**Objective**: Drastically reduce total scan time and improve validation accuracy.

### Technical Implementation
- **Worker Pool Pattern**: Implement controlled concurrent processing with a `MAX_CONCURRENT_ARTICLES` setting (default: 3).
- **Editorial Validator**: Refine the Validator Agent prompt to match the Editor's incisive yet factual tone. It must catch not just hallucinations, but also deviations from the "L'Assez" journalistic standard.

### Modified Files
- `radar_lassez/lib/CoreEngine.js`: Refactor the `processArticles` loop from sequential to parallel.
- `radar_lassez/lib/agents/ValidatorAgent.js`: Update prompt with editorial guidelines.

---

## 🏗️ Execution Roadmap

### Phase 1: Stability (Auto-Throttling)
- Create `BaseAgent` with retry logic.
- Integrate 503 handling in `Researcher` and `Editor`.
- *Expected Outcome*: Zero 503 errors in logs.

### Phase 2: Intelligence & UI (Auto-Healing)
- Setup the Health DB schema.
- Implement the "Quarantine" logic and Front-end error dashboard.
- *Expected Outcome*: Ingestion speed increases; user can fix dead sources easily.

### Phase 3: Performance & Precision
- Refactor the CoreEngine loop for parallelism.
- Update Validator prompts for better editorial alignment.
- *Expected Outcome*: Scan time reduced by ~60%; higher quality output.

---

> [!IMPORTANT]
> **Space Note**: This plan is stored in `docs/implementation_plan_v3_1.md` on the D: drive because the C: drive is currently full.

**Je commence par la Phase 1 ?**
