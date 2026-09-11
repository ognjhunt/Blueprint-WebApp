# Minimal authentication pages — September 11, 2026

Owner-directed extension of the public website theme to sign-in, create-account, and password reset. ADP-010 / partner-admission gate: the account entry points visibly contradicted the approved website and buried forms under promotional panels. The completion artifact is the matching responsive auth flow with preserved account/intake behavior.

The shared AuthLayout uses ivory, dark green, DM Sans, a simple wordmark, essential account/legal links, and one generated packing illustration. Mobile prioritizes the form and omits decorative artwork. Existing business and capturer signup steps, payloads, role selection, access permissions, and Terms/Privacy acceptance remain intact. Password reset keeps a neutral outcome for unknown accounts and provider failures. Sign-in prevents concurrent email/Google submissions; forms use POST as their non-JavaScript fallback so credentials are not placed in a URL.

The real signup/reset components now prerender instead of old static summary pages, and sign-in has a single auth shell. The previous marketing sidebar, feature panels, and duplicated navigation are removed. No new auth provider, account migration, or schema change is introduced.

Image concept: minimal-auth-concept.png. Prompt and output provenance: minimal-auth-image-provenance.json. Generation used the built-in Codex image tool, which still does not expose a selector or exact model identity. Sunburst was requested but exact model provenance cannot be certified. Final artwork is stored in the repository as WebP.

Validation covers email/Google callbacks, credential validation, pending/error/password-visibility states, neutral recovery responses, both signup payloads and legal acceptance, desktop/mobile layout, entry-point navigation, and prerendered forms. Tests do not create real accounts or send live reset emails.
