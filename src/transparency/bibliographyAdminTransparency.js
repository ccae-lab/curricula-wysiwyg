/**
 * Shared transparency content for <BibliographyAdmin> and equivalent
 * surfaces. Each TRiAD site imports this, spreads in its own model +
 * routing details, and passes the result to <AITransparencyPanel>.
 *
 * References are the same wherever these features ship because they
 * describe the *concepts* (annotation drafting, citation-graph
 * traversal), not the site plumbing.
 */

/** Base feature objects with seminal + current scholarship. */
export const BIBLIOGRAPHY_ADMIN_FEATURES_BASE = {
  draftWithAI: {
    name: 'DRAFT WITH AI',
    what:
      'Generates a 2-3 sentence annotation for a bibliography entry. The AI is given the title, authors, year, DOI, venue, and abstract if present, and produces a draft under the platform voice rules. Nothing is saved until you click SAVE ANNOTATION.',
    digcomp: [
      '1.2 Evaluating data, information and digital content',
      '3.1 Developing digital content',
      '3.4 Programming (via composable adapters)',
    ],
    seminal: {
      cite:
        'Weizenbaum, J. (1976). Computer Power and Human Reason: From Judgment to Calculation. W. H. Freeman.',
      url: 'https://archive.org/details/computerpowerhum0000weiz',
    },
    current: {
      cite:
        'Long, D., & Magerko, B. (2020). What is AI Literacy? Competencies and Design Considerations. CHI 2020.',
      doi: '10.1145/3313831.3376727',
    },
  },
  twins: {
    name: 'TWINS (SEMINAL ↔ LATEST)',
    what:
      'For a row with a DOI, traces the citation graph via OpenAlex. Goes backward through referenced_works to surface the seminal ancestor (oldest, highly cited), and forward through cited_by to surface the latest descendant (newest, highly cited). No LLM. Every result links to the source DOI.',
    digcomp: [
      '1.1 Browsing, searching, filtering data, information and digital content',
      '1.3 Managing data, information and digital content',
    ],
    seminal: {
      cite:
        'Garfield, E. (1955). Citation Indexes for Science. Science, 122(3159), 108-111.',
      doi: '10.1126/science.122.3159.108',
    },
    current: {
      cite:
        'Priem, J., Piwowar, H., & Orr, R. (2022). OpenAlex: A fully-open index of scholarly works, authors, venues, institutions, and concepts. arXiv:2205.01833.',
      doi: '10.48550/arXiv.2205.01833',
    },
  },
};

/** Framework-level references, shared across features. */
export const FRAMEWORK_REFS = {
  aiFluency: [
    {
      cite:
        'Long, D., & Magerko, B. (2020). What is AI Literacy? Competencies and Design Considerations. CHI 2020.',
      doi: '10.1145/3313831.3376727',
    },
    {
      cite:
        'Ng, D. T. K., Leung, J. K. L., Chu, S. K. W., & Qiao, M. S. (2021). Conceptualizing AI literacy: An exploratory review. Computers and Education: Artificial Intelligence, 2, 100041.',
      doi: '10.1016/j.caeai.2021.100041',
    },
    {
      cite:
        'Bender, E. M., Gebru, T., McMillan-Major, A., & Shmitchell, S. (2021). On the Dangers of Stochastic Parrots: Can Language Models Be Too Big? FAccT 2021.',
      doi: '10.1145/3442188.3445922',
    },
  ],
  digComp: [
    {
      cite:
        'Vuorikari, R., Kluzer, S., & Punie, Y. (2022). DigComp 2.2: The Digital Competence Framework for Citizens. Publications Office of the European Union.',
      doi: '10.2760/115376',
    },
    {
      cite:
        'European Commission, Joint Research Centre. DigComp 3.0 (ongoing update). Framework for Citizens\' Digital Competence, extending 2.2 with explicit AI, data and algorithmic literacy references.',
      url: 'https://joint-research-centre.ec.europa.eu/scientific-activities-z/digcomp_en',
    },
  ],
};

/**
 * Build the default transparency config for a site. The caller passes
 * its model / routing details and optionally overrides other fields.
 *
 *   buildBibliographyAdminTransparency({
 *     draftModel: 'Gemini 2.5 Flash (Google)',
 *     draftVia: 'Supabase edge function annotation-draft',
 *     draftVerify: 'Draft appears in the textarea. Edit freely. SAVE ANNOTATION commits.',
 *   })
 */
export function buildBibliographyAdminTransparency({
  draftModel,
  draftVia,
  draftVerify,
  twinsModel = 'OpenAlex API (deterministic; no LLM)',
  twinsVia = 'Direct browser fetch to api.openalex.org',
  twinsVerify = 'Every twin card has a direct DOI link you can click to read the source.',
  intro,
} = {}) {
  return {
    intro:
      intro
      || 'This page uses AI and data-graph operations that could otherwise be opaque. Below is what runs, how, and how you can verify the output. Aligned with the AI Fluency framing (Long and Magerko 2020) and DigComp 3.0 (EU Joint Research Centre).',
    features: [
      {
        ...BIBLIOGRAPHY_ADMIN_FEATURES_BASE.draftWithAI,
        model: draftModel,
        via: draftVia,
        verify: draftVerify || 'Draft appears in the textarea. Edit freely. Nothing persists until you click SAVE ANNOTATION.',
      },
      {
        ...BIBLIOGRAPHY_ADMIN_FEATURES_BASE.twins,
        model: twinsModel,
        via: twinsVia,
        verify: twinsVerify,
      },
    ],
    frameworks: FRAMEWORK_REFS,
  };
}
