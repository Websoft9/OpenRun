# OpenRun PRD

## Goal

Build an enterprise digitalization intelligence service that helps FDEs, OPCs, and consultants move from a customer problem to a standard process, a software shortlist, and implementation advice with traceable evidence.

The catalog and process model must be usable both as a browsable directory and as structured context for AI-assisted analysis and reporting.

## User Stories

- As a consultant, I can describe a customer problem and map it to a process domain and process.
- As a consultant, I can browse PCF-aligned L1/L2/L3 processes.
- As a consultant, I can see which software supports a process and with what fit level.
- As a consultant, I can generate an implementation-oriented recommendation with evidence and confidence.
- As an FDE, I can compare software options for the same process and industry.
- As an editor, I can curate process domains, software types, processes, mappings, and evidence.
- As an admin, I can review and publish catalog and process content.

## Pages and Surfaces

| Surface | Content |
|---|---|
| Home | Process framework domains, software types, featured and recent products |
| Software types | PCF-independent software category pages |
| Processes | PCF-aligned L1/L2/L3 browser |
| Process detail | Process description, children, KPIs, mapped software |
| Product detail | Process fit, software types, industries, platforms, markets |
| Search | Keyword, process domain, software type, industry, market, platform filters |
| Admin | Review queue, catalog editing, process mapping, publishing |
| API | Process, software, and mapping endpoints for AI and integrations |
| Advisor | AI-assisted diagnosis, process matching, recommendations, reports (next phase) |

## Core Data

- Software type: vendor/product-view secondary classification
- Process framework: PCF-aligned framework, version, license, source
- Process node: L1/L2/L3 code, parent, name, description, inputs, outputs, roles, KPIs
- Software-process fit: fit level, confidence, evidence URL, review status
- Implementation pattern: prerequisites, effort, risks, roles, integration notes
- Software: facts, analysis, translations, license, platforms, markets
- Industry: applicable enterprise industries
- Provenance: source URL, fetched time, reviewer, review time
- Submission: external submission and review history

## Functional Requirements

1. Maintain the PCF-aligned L1/L2/L3 process model as the primary enterprise-view classification.
2. Treat existing software categories as software types, not the primary taxonomy.
3. Maintain a PCF-aligned process framework with L1/L2/L3 nodes.
4. Provide process browsing and search through pages and API.
5. Link software to process nodes with fit level, confidence, evidence, and review status.
6. Support industry-specific process variants.
7. Keep implementation patterns separate from software facts.
8. Expose stable process codes for AI retrieval and report generation.
9. AI must cite process codes, software records, and sources; it must not invent process codes.
10. Preserve framework version, license, and source.
11. Support bilingual process and software content.
12. Keep catalog, process, and recommendation data auditable and repeatable.

## AI Advisory Workflow

```
Customer problem / goal
    -> process domain (L1)
    -> process group and process (L2/L3)
    -> gap and optimization hypotheses
    -> software capability fit
    -> implementation pattern
    -> recommendation + evidence + confidence
    -> report
```

The AI layer may suggest mappings, but every published mapping must be reviewable. Confidence and evidence are first-class fields.

## Non-functional Requirements

- Do not claim unlicensed APQC PCF data as official.
- Full licensed PCF data must be imported from an authorized source.
- Process codes are stable identifiers and must not be generated freely by AI.
- Recommendations must be traceable to process, software, and evidence.
- Migrations are versioned and repeatable.
- Reference data is source-controlled and rebuildable.
- Business data is backed up and not stored in Git.
- Pages remain fast and statically publishable where possible.

## Acceptance Criteria

- PCF process domains and software types are separate dimensions.
- PCF-aligned L1/L2/L3 data is stored, seeded, browsable, and available through API.
- Process nodes have stable codes and parent/child relationships.
- Software-process fit schema exists with confidence and evidence fields.
- Product pages show process fit, software types, industries, platforms, and markets.
- The UI makes PCF process domains the primary enterprise view.
- The documentation clearly distinguishes PCF-aligned preview data from licensed official PCF data.
- Ingest, seed, and publish flows are repeatable.
- English and Chinese content are accessible.
