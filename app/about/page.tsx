export default function AboutPage() {
  return (
    <main className="space-y-12 pb-16">
      <section className="relative overflow-hidden rounded-3xl border border-white/50 bg-white/70 p-10 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70 md:p-16">
        <div className="relative z-10 mx-auto max-w-3xl">
          <h1 className="mb-6 text-4xl font-semibold text-slate-900 dark:text-slate-100 md:text-5xl">
            About tailora
          </h1>
          <p className="mb-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            tailora was born from a simple frustration: tailoring resumes to job descriptions shouldn&apos;t take hours, and it definitely shouldn&apos;t require fabricating experience.
          </p>
          <p className="mb-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            We built tailora for professionals who value integrity, privacy, and efficiency. Our AI-powered platform helps you align your resume with job descriptions while maintaining complete honesty—every bullet point links back to your original experience.
          </p>
          <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            We believe that the best resumes are honest, well-structured, and optimized for both human recruiters and ATS systems. That&apos;s why we&apos;ve built guardrails into every step of our process to ensure you never accidentally misrepresent your experience.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-white/50 bg-white/70 p-10 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70 md:p-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 text-3xl font-semibold text-slate-900 dark:text-slate-100">
            Our Values
          </h2>
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/60">
              <h3 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
                Integrity First
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                We never invent experience. Every rewritten bullet point must be supported by your original resume. If we can&apos;t find evidence, we flag it for your review.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/60">
              <h3 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
                Privacy by Default
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                Your files are processed in-memory and never persisted to disk. Exports are generated on-demand and wiped immediately after download. Your data stays yours.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/60">
              <h3 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
                ATS-Native Formatting
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                We stick to recruiter-approved structure—no columns, no graphics, no fancy formatting. Just clean, keyword-optimized sections that pass every ATS.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/60">
              <h3 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
                Human-Vetted AI
              </h3>
              <p className="text-slate-600 dark:text-slate-300">
                Our prompts are carefully crafted and continuously reviewed by human experts. We combine the speed of AI with the judgment of experienced professionals.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/50 bg-white/70 p-10 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70 md:p-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-semibold text-slate-900 dark:text-slate-100">
            Ready to get started?
          </h2>
          <p className="mb-8 text-lg text-slate-600 dark:text-slate-300">
            Join thousands of professionals who trust tailora to help them land their dream roles.
          </p>
          <a
            href="/tailor"
            className="button inline-block"
          >
            Start Tailoring
          </a>
        </div>
      </section>
    </main>
  )
}
