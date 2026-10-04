import Link from 'next/link'

const values = [
  {
    title: 'Integrity first',
    detail: "We never invent experience. Every rewritten bullet point must be supported by your original resume. If we can't find evidence, we flag it for your review.",
  },
  {
    title: 'Privacy by default',
    detail: 'Uploaded files are parsed in memory and discarded after extraction. Session data is kept in Redis for up to 60 minutes, and tailoring uses OpenAI.',
  },
  {
    title: 'ATS-native formatting',
    detail: 'We stick to recruiter-approved structure: no columns, no graphics, no fancy formatting. Just clean, keyword-optimized sections that pass every ATS.',
  },
  {
    title: 'Human-vetted AI',
    detail: 'Our prompts are carefully crafted and continuously reviewed by human experts. We combine the speed of AI with the judgment of experienced professionals.',
  },
]

export default function AboutPage() {
  return (
    <main className="space-y-20 md:space-y-28">
      <section aria-labelledby="about-heading" className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <h1 id="about-heading" className="text-4xl font-semibold leading-[1.05] tracking-tighter sm:text-5xl lg:col-span-5 lg:text-6xl">
          About Rolefit
        </h1>
        <div className="space-y-6 lg:col-span-7">
          <p className="text-xl leading-relaxed text-slate-900 dark:text-slate-100 md:text-2xl">
            Rolefit was born from a simple frustration: tailoring resumes to job descriptions shouldn&apos;t take hours, and it definitely shouldn&apos;t require fabricating experience.
          </p>
          <p className="max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            We built Rolefit for professionals who value integrity, privacy, and efficiency. It helps you align your resume with a job description while staying completely honest: every bullet point links back to your original experience.
          </p>
          <p className="max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
            The best resumes are honest, well-structured, and optimized for both human recruiters and ATS systems. That&apos;s why we built guardrails into every step, so you never accidentally misrepresent your experience.
          </p>
        </div>
      </section>

      <section aria-labelledby="values-heading">
        <h2 id="values-heading" className="text-3xl font-semibold tracking-tighter sm:text-4xl">Our values</h2>
        <dl className="mt-10 grid gap-x-14 gap-y-10 md:grid-cols-2">
          {values.map((value) => (
            <div key={value.title} className="border-t border-slate-200 pt-5 dark:border-slate-800">
              <dt className="text-lg font-semibold tracking-tight">{value.title}</dt>
              <dd className="mt-2 leading-relaxed text-slate-600 dark:text-slate-400">{value.detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="about-cta-heading" className="flex flex-col items-start gap-6 border-t border-slate-200 pt-14 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
        <h2 id="about-cta-heading" className="text-3xl font-semibold tracking-tighter sm:text-4xl">Ready to get started?</h2>
        <Link href="/tailor" className="button">
          Start Tailoring
        </Link>
      </section>
    </main>
  )
}
