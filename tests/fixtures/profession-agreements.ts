/** Synthetic profession scopes for contrast / regression tests — no real client data. */

export const PHOTOGRAPHER_SCOPE = `Wedding photography package: 8 hours coverage, online gallery of edited images, and one round of select retouches.
Includes two revision rounds on the album design.
Does not include same-day slideshow, drone, or print products unless quoted separately.`;

export const DESIGNER_SCOPE = `Brand identity: logo suite, color system, and basic brand guide PDF.
Includes two revision rounds.
Does not include website design, packaging, or social templates.`;

export const CONSULTANT_SCOPE = `Strategy engagement: discovery workshop, written recommendations, and one stakeholder readout.
Includes one revision round on the recommendations document.
Does not include implementation or ongoing retainers.`;

export const DEVELOPER_SCOPE = `MVP web app: auth, core dashboard, and deploy to staging.
Includes two revision rounds.
Does not include native mobile apps, custom integrations, or ongoing ops.`;

export const PROFESSION_SCOPES = {
  photographer: PHOTOGRAPHER_SCOPE,
  designer: DESIGNER_SCOPE,
  consultant: CONSULTANT_SCOPE,
  developer: DEVELOPER_SCOPE,
} as const;
