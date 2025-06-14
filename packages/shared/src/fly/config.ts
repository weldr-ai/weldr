export type FlyAppType = "production" | "development";

export const flyApiHostname = process.env.FLY_API_HOSTNAME;
export const flyApiKey = process.env.FLY_API_TOKEN;
export const flyOrgSlug = process.env.FLY_ORG_SLUG;
