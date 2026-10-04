export default function Privacy() {
  return (
    <main className="max-w-3xl space-y-8">
      <h1 className="text-4xl font-semibold tracking-tighter sm:text-5xl">Privacy</h1>
      <div className="space-y-5 text-lg leading-relaxed text-slate-600 dark:text-slate-400">
        <p>
          Uploaded files are parsed in memory and discarded after text extraction. Resume text, job descriptions, and tailored results are stored in Redis for up to 60 minutes so you can preview and export your session.
        </p>
        <p>
          Resume and job description text is sent to OpenAI for tailoring. Lemon Squeezy handles checkout and sends payment webhooks used to add credits to your account.
        </p>
        <p>We never invent experience.</p>
      </div>
    </main>
  )
}
