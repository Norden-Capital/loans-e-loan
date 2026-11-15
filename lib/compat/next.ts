/**
 * Stand-in for the `next` package's types (`import type { Metadata } from "next"`).
 */
export type { Metadata } from "@/lib/compat/metadata";
export type { Viewport } from "@/lib/compat/router";

type ChangeFrequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

export declare namespace MetadataRoute {
  type Robots = {
    rules:
      | { userAgent?: string | string[]; allow?: string | string[]; disallow?: string | string[]; crawlDelay?: number }
      | { userAgent: string | string[]; allow?: string | string[]; disallow?: string | string[]; crawlDelay?: number }[];
    sitemap?: string | string[];
    host?: string;
  };
  type Sitemap = {
    url: string;
    lastModified?: string | Date;
    changeFrequency?: ChangeFrequency;
    priority?: number;
  }[];
  type Manifest = Record<string, unknown>;
}
