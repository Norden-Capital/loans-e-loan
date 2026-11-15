/// <reference types="astro/client" />

declare module "virtual:next-islands" {
  const islands: Record<string, () => Promise<Record<string, unknown>>>;
  export default islands;
}
