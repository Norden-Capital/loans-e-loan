/** The answers to "Why are you leaving?" on /unsubscribe (the server route maps them to LMS codes). */
export const UNSUBSCRIBE_REASONS = [
  "Too many emails",
  "Not interested anymore",
  "I already got a loan",
  "I never signed up",
  "Other",
] as const;

/** The LMS keeps up to 300 characters of the "Other" text. */
export const UNSUBSCRIBE_OTHER_MAX = 300;
