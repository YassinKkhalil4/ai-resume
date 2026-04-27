# Email Verification

Email verification is enabled for password signups.

## Behavior

- Password signup creates an unverified user.
- A verification code and link are sent with Resend.
- Protected AI and billing routes call `requireEmailVerification()`.
- Google OAuth users are auto-verified by the provider callback.
- The first free credit is granted as a 12-month `credit_lots` row, but it cannot be used until the user verifies their email.

## Required Environment

```text
RESEND_API_KEY=
RESEND_FROM_EMAIL=
VERIFICATION_BASE_URL=
```
