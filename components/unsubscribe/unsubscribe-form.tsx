"use client";

/* Unsubscribe form (design: LMS/design/brand-unsubscribe/e-loan, made from the
   approved LoanHero page). Box, fields and button use the same classes as
   components/contact/contact-form.tsx.
   States: form, form + "Other" text box, wrong email, server error, success.
   Sends to /api/unsubscribe, which passes it on to the LMS. */

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PixelTransition } from "@/components/ui/pixel-transition";
import { Textarea } from "@/components/ui/textarea";
import { UNSUBSCRIBE_OTHER_MAX, UNSUBSCRIBE_REASONS } from "@/lib/unsubscribe";

/* ── Site styling — the only part that differs between sites ───────────── */
const STYLES = {
  box: "border border-border bg-background p-6 sm:p-8",
  label: "gap-1",
  field: "h-10 rounded-none",
  bad: "!border-[#f87171] !bg-[#fef2f2]",
  reason:
    "relative flex items-center gap-2.5 min-h-11 px-3.5 border text-[14px] font-medium cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
  reasonOff: "border-[hsl(var(--palette-border))] bg-transparent text-[hsl(var(--palette-ink))]",
  reasonOn: "border-[hsl(var(--palette-ink))] bg-[hsl(var(--palette-lime)/0.35)] text-[hsl(var(--palette-ink))]",
  dotOff: "border-[1.5px] border-[hsl(0_0%_75%)]",
  dotOn: "border-[5px] border-[hsl(var(--palette-ink))]",
  muted: "text-[hsl(0_0%_40%)]",
};
/* ─────────────────────────────────────────────────────────────────────── */

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

type Status = "idle" | "sending" | "badEmail" | "serverError" | "done";

function AlertIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" className="flex-none mt-px">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

/** The contact form's button (pixel effect on hover), with this page's words. */
function SubmitButton({ sending }: { sending: boolean }) {
  const [active, setActive] = useState(false);
  return (
    <button
      type="submit"
      disabled={sending}
      onMouseEnter={() => !sending && setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => !sending && setActive(true)}
      onBlur={() => setActive(false)}
      className="relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden border border-primary bg-primary px-6 text-base font-bold text-primary-foreground transition-opacity disabled:pointer-events-none disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <PixelTransition
        active={active}
        columns={12}
        rows={4}
        animationStepDuration={0.32}
        exitAnimationStepDuration={0.32}
        pixelColor="hsl(var(--accent))"
        exitPixelColor="hsl(var(--primary))"
        squarePixels
        pixelSize={12}
        className="pointer-events-none absolute inset-0"
        firstContent={<span className="block size-full bg-primary" />}
        secondContent={<span className="block size-full bg-accent" />}
      />
      {sending && <Loader2 className="relative z-20 h-4 w-4 animate-spin text-primary-foreground" />}
      <span className={`relative z-20 transition-colors duration-200 ${active ? "text-accent-foreground" : "text-primary-foreground"}`}>
        Unsubscribe
      </span>
    </button>
  );
}

export function UnsubscribeForm() {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [other, setOther] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [doneEmail, setDoneEmail] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;

    const cleanEmail = email.trim();
    if (!isEmail(cleanEmail)) {
      setStatus("badEmail");
      return;
    }

    const company = (e.currentTarget.elements.namedItem("company") as HTMLInputElement | null)?.value ?? "";
    setStatus("sending");

    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          reason,
          otherText: reason === "Other" ? other.trim() : "",
          company,
        }),
      });
      if (res.ok) {
        setDoneEmail(cleanEmail);
        setStatus("done");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { field?: string };
      setStatus(res.status === 400 && data.field === "email" ? "badEmail" : "serverError");
    } catch {
      setStatus("serverError");
    }
  }

  if (status === "done") {
    return (
      <div className={STYLES.box}>
        <div className="text-center pt-3 pb-1" role="status">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-[hsl(var(--palette-lime))] text-[hsl(var(--palette-ink))]">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <path d="M22 4 12 14.01l-3-3" />
            </svg>
          </div>
          <h2 className="font-display text-2xl tracking-tight text-foreground mb-2">You&rsquo;re unsubscribed</h2>
          <p className={`text-[14px] max-w-[340px] mx-auto leading-[1.6] ${STYLES.muted}`}>We will not send you more emails.</p>
          <span className="inline-block mt-4 mb-1 px-3 py-1.5 rounded-full bg-[hsl(var(--palette-lime))] text-[hsl(var(--palette-ink))] text-[13px] font-semibold">
            {doneEmail}
          </span>
          <br />
          <a className="inline-block mt-5 text-[13px] font-semibold underline underline-offset-4 hover:opacity-80 text-[hsl(var(--palette-ink))]" href="/">
            Back to home
          </a>
        </div>
      </div>
    );
  }

  const badEmail = status === "badEmail";

  return (
    <form onSubmit={handleSubmit} noValidate className={STYLES.box}>
      <div className="grid gap-5">
        <h2 className="font-display text-2xl tracking-tight text-foreground">Remove me from the list</h2>

        {status === "serverError" && (
          <div role="alert" className="flex gap-2.5 items-start px-3.5 py-3 bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c] text-[13px] leading-normal">
            <AlertIcon size={18} />
            <div>
              <b className="block text-[#991b1b]">Something went wrong.</b>Please try again in a minute.
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="ub-email" className={STYLES.label}>
            Email address
          </Label>
          <Input
            id="ub-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={200}
            placeholder="you@example.com"
            className={`${STYLES.field}${badEmail ? ` ${STYLES.bad}` : ""}`}
            value={email}
            aria-invalid={badEmail || undefined}
            aria-describedby={badEmail ? "ub-email-help" : undefined}
            onChange={(e) => {
              setEmail(e.target.value);
              if (badEmail) setStatus("idle");
            }}
          />
          {/* Always in the page (hidden when not needed), as in the design: keeps the same spacing. */}
          <p id="ub-email-help" className={badEmail ? "flex items-center gap-1.5 mt-1.5 text-[12.5px] text-[#dc2626]" : "hidden"}>
            <AlertIcon size={14} />
            Please enter a valid email.
          </p>
        </div>

        <div className="space-y-1.5" role="radiogroup" aria-labelledby="ub-reason-label">
          <p id="ub-reason-label" className="flex items-center gap-1 text-sm leading-none font-medium select-none">
            Why are you leaving? <span className={`font-normal ${STYLES.muted}`}>(optional)</span>
          </p>
          <div className="grid gap-2">
            {UNSUBSCRIBE_REASONS.map((r) => {
              const on = reason === r;
              return (
                <label key={r} className={`${STYLES.reason} ${on ? STYLES.reasonOn : STYLES.reasonOff}`}>
                  <input type="radio" name="reason" value={r} checked={on} onChange={() => setReason(r)} className="absolute opacity-0 pointer-events-none" />
                  <span className={`w-4 h-4 rounded-full bg-white flex-none ${on ? STYLES.dotOn : STYLES.dotOff}`} />
                  {r}
                </label>
              );
            })}
          </div>
          <div className={reason === "Other" ? "mt-2" : "hidden"}>
              <Textarea
                name="otherText"
                rows={3}
                aria-label="Tell us more (optional)"
                placeholder="Tell us more (optional)"
                maxLength={UNSUBSCRIBE_OTHER_MAX}
                className="rounded-none resize-none field-sizing-fixed"
                value={other}
                onChange={(e) => setOther(e.target.value)}
              />
          </div>
        </div>

        {/* Honeypot: hidden from people; bots often fill it. */}
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute w-px h-px -left-[9999px] opacity-0 pointer-events-none"
        />

        <SubmitButton sending={status === "sending"} />
        <p className={`text-center text-[12px] m-0 ${STYLES.muted}`}>It only takes a second. You can sign up again any time.</p>
      </div>
    </form>
  );
}

export default UnsubscribeForm;
