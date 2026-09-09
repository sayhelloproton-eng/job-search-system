# Excellent Resume Template Library Research

Research refresh: 2026-08-23.

Goal: build a vetted template/reference library for Senior / Staff / Principal / Software Architect / Platform / Developer Tools resumes. Separate visual/template infrastructure from senior-content examples. A template being popular does not automatically make it suitable for this candidate; ATS safety, information density, two-page support, employer-nested project structure, and senior-level scan hierarchy matter more than decoration.

## S-tier — primary templates to study/adapt

### 1. McDowell CV — dnl-blkv/mcdowell-cv
- GitHub: ~2.7k stars.
- Origin: Gayle Laakmann McDowell / CareerCup-style engineering resume.
- Strengths: dense single-column engineering layout, strong company/title/date hierarchy, compact project/experience blocks, excellent content-to-space ratio.
- Best use here: primary structural inspiration for a two-page Senior/Architect resume; relax the original one-page bias.
- Caveat: original design is U.S.-letter and often used as one page; do not let page compression erase senior evidence.

### 2. sb2nov/resume + Jake-style descendants
- sb2nov/resume: ~6.7k stars; one-column software-developer LaTeX template.
- Strengths: ATS-friendly text flow, restrained visual hierarchy, high information density, clear Experience/Projects headings.
- Jake's Resume is a widely reused descendant and is commonly recommended in software-engineering resume communities.
- Best use here: typography, spacing, job header, bullet geometry, ATS/plain-text baseline.
- Caveat: common implementations are optimized for students/early-career one-page resumes; senior content architecture must be expanded.

### 3. RenderCV — rendercv/rendercv
- GitHub: ~17k stars; resume builder specifically for academics and engineers.
- Source model: YAML -> validated structured data -> professional PDF typography.
- Strengths: version-control friendly, strict schema/validation, deterministic spacing, multiple themes, multilingual support, excellent separation of content and rendering.
- Best use here: likely rendering engine / canonical resume data layer after content architecture stabilizes.
- Caveat: RenderCV solves rendering consistency, not senior-content quality; theme selection still needs ATS/single-column filtering.
## A-tier — strong libraries / secondary references

### 4. Awesome-CV — posquit0/Awesome-CV
- GitHub: ~27.6k stars, ~5.2k forks.
- Supports resume/CV/cover letter, including polished two-page examples.
- Strengths: mature semantic LaTeX markup, excellent visual polish and hierarchy, naturally supports longer senior resumes.
- Best use here: visual hierarchy, section spacing, multi-page polish.
- Caveat: more visual styling than McDowell/sb2nov; any adapted version must be checked with pdftotext/ATS parsing before adoption.

### 5. Reactive Resume — amruthpillai/reactive-resume
- GitHub: ~40k+ stars; large open-source resume builder with many templates.
- Strengths: excellent template gallery, fast visual comparison, multi-language and configurable layout.
- Best use here: visual-reference library to compare typography, spacing, header and section hierarchy.
- Caveat: many templates are multi-column/decorative; only single-column, text-first variants are candidates for our engineering baseline.

### 6. r/EngineeringResumes resume template
- Community-maintained LaTeX template from r/EngineeringResumes.
- Strengths: deliberately plain, ATS-safe, engineering-specific and strongly content-first.
- Best use here: safety/control sample for margins, headings and bullet readability.
- Caveat: visually conservative; use as a correctness benchmark, not necessarily the final aesthetic.

### 7. JSON Resume + jsonresume-theme-engineering
- JSON Resume is an open resume-data standard with a community theme gallery.
- `jsonresume-theme-engineering` explicitly targets senior/staff engineers and supports grouping multiple positions at one company.
- Strengths: useful data model for promotions/role evolution and structured senior histories.
- Best use here: inspiration for employer-nested roles/workstreams and future structured resume storage.
- Caveat: the senior engineering theme itself has little GitHub popularity; treat it as a structural idea, not visual authority.
## Senior / Architect content exemplars — not template authorities

### bitwalker/resume
- Real public resume showing Principal Engineer and Senior Staff Software Engineer progression.
- Valuable because role descriptions explain architecture responsibility, platform migration, infrastructure, delivery and R&D scope rather than listing generic duties.
- Use for: Principal/Staff narrative depth and role-evolution language.

### tindn/resume
- Real Staff/Senior engineer resume with 13 years across full stack, mobile and current LLM/Agent work.
- Valuable because each role is concise but product-oriented, and tech-stack lines sit under concrete shipped systems.
- Use for: modern Senior/Staff AI + full-stack balance.

### markdownresume/markdown-resume-templates — Senior Engineer
- Has a Principal Software Engineer / Technical Lead sample with architecture, cloud, distributed systems and leadership emphasis.
- Use for: content anatomy and section proportions, not factual wording or fabricated metrics.

### Resume Worded — Principal Software Engineer / Senior Software Architect examples
- Commercial example library covering Principal Software Engineer, Senior Software Architect, Lead Software Engineer and related senior roles.
- Use for: comparison of architect/principal information hierarchy and keyword families.
- Caveat: examples use synthetic/generic metrics; never borrow claims or numeric patterns into our facts.

## Reject / use with caution

- Deedy CV / many AltaCV variants: visually attractive, often two-column; poor default fit for ATS-heavy software-engineering applications.
- Terminal/dark-mode/creative templates: interesting portfolio artifact, weak default application resume.
- Student one-page templates: useful typography references but wrong content budget for 10 years of experience.
- Generic Canva-style infographic resumes: reject for engineering baseline because visual decoration competes with evidence and parsing.

## Current shortlist for our next template prototypes

1. **McDowell-derived Senior 2-page** — strongest candidate for information-dense engineering baseline.
2. **RenderCV single-column/classic Senior 2-page** — strongest candidate for maintainable production rendering.
3. **Awesome-CV restrained 2-page** — candidate for a slightly more polished Architect/Principal visual variant.
4. **r/EngineeringResumes / Jake-style** — control template for ATS and text-density comparison.

Do not choose a winner yet. Next research step should render the same neutral senior-engineer content into these 4 skeletons and compare first-screen hierarchy, project nesting, two-page flow, ATS text extraction and Chinese typography.