import type { Metadata } from "next";

import SectionTitleBand from "@/components/landing/SectionTitleBand";
import { UnsubscribeForm } from "@/components/unsubscribe/unsubscribe-form";
import { BASE_URL, buildMetadata } from "@/lib/seo";

// Same band, intro and form row as /contact (design: LMS/design/brand-unsubscribe/e-loan).
export const metadata: Metadata = buildMetadata({
  title: "Unsubscribe",
  description: "Stop E-Loan emails. Enter your email address and we will stop sending you emails.",
  path: "/unsubscribe",
});

const DOMAIN = new URL(BASE_URL).host;

export default function UnsubscribePage() {
  return (
    <main className="bg-background">
      <section className="mx-auto w-full max-w-[1000px]">
        <SectionTitleBand label="Unsubscribe" className="border-x border-b border-border" />

        <div className="grid border-x border-b border-border lg:grid-cols-[0.42fr_0.58fr]">
          <div className="border-b border-border p-6 md:p-8 lg:border-b-0 lg:border-r">
            <p className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              <span aria-hidden className="h-3 w-px bg-accent" />
              Email preferences
            </p>
            <h1 className="mt-6 max-w-md font-display text-5xl leading-[1.02] tracking-tight text-balance text-foreground md:text-[3.5rem]">
              Stop our emails.
            </h1>
          </div>

          <div className="flex items-end p-6 md:p-8">
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              Enter your email and we will stop sending you emails. It only takes a second.
            </p>
          </div>
        </div>

        <div className="grid gap-6 border-x border-b border-border p-4 md:p-6 lg:grid-cols-[0.58fr_0.42fr]">
          <UnsubscribeForm />

          <div className="grid gap-2.5 self-start">
            <div className="flex items-start gap-2.5 border border-accent/30 bg-accent-soft/60 p-3.5">
              <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center bg-primary text-primary-foreground">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h9" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  <path d="m17 17 4 4" />
                  <path d="m21 17-4 4" />
                </svg>
              </span>
              <p className="text-xs leading-5 text-foreground">We only use your email to take it off our list. Nothing else.</p>
            </div>
            <div className="border border-border bg-secondary/40 p-3.5">
              <p className="text-xs leading-5 text-muted-foreground">
                Changed your mind? You can sign up again any time on{" "}
                <span className="font-medium text-foreground">{DOMAIN}</span>.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
