export default function TermsPage() {
  return (
    <main className="space-y-12 pb-16">
      <section className="relative overflow-hidden rounded-3xl border border-white/50 bg-white/70 p-10 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70 md:p-16">
        <div className="relative z-10 mx-auto max-w-3xl">
          <h1 className="mb-6 text-4xl font-semibold text-slate-900 dark:text-slate-100 md:text-5xl">
            Terms of Service
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-white/50 bg-white/70 p-10 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70 md:p-16">
        <div className="mx-auto max-w-3xl space-y-8">
          <div>
            <h2 className="mb-4 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              1. Acceptance of Terms
            </h2>
            <p className="leading-relaxed text-slate-600 dark:text-slate-300">
              By accessing and using Rolefit, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              2. Use License
            </h2>
            <p className="mb-2 leading-relaxed text-slate-600 dark:text-slate-300">
              Permission is granted to temporarily use Rolefit for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
            </p>
            <ul className="ml-6 list-disc space-y-1 text-slate-600 dark:text-slate-300">
              <li>Modify or copy the materials</li>
              <li>Use the materials for any commercial purpose or for any public display</li>
              <li>Attempt to reverse engineer any software contained in Rolefit</li>
              <li>Remove any copyright or other proprietary notations from the materials</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              3. Service Description
            </h2>
            <p className="leading-relaxed text-slate-600 dark:text-slate-300">
              Rolefit provides AI-powered resume tailoring services. We use advanced AI technology to help you align your resume with job descriptions while maintaining integrity and honesty. All rewritten content is based on your original resume and is designed to be ATS-friendly and recruiter-approved.
            </p>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              4. User Responsibilities
            </h2>
            <p className="mb-2 leading-relaxed text-slate-600 dark:text-slate-300">
              You are responsible for:
            </p>
            <ul className="ml-6 list-disc space-y-1 text-slate-600 dark:text-slate-300">
              <li>Ensuring the accuracy of information you provide</li>
              <li>Reviewing all AI-generated content for accuracy before use</li>
              <li>Using the service in compliance with all applicable laws</li>
              <li>Maintaining the confidentiality of your account credentials</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              5. Credits and Billing
            </h2>
            <p className="mb-2 leading-relaxed text-slate-600 dark:text-slate-300">
              Credits purchased through Rolefit:
            </p>
            <ul className="ml-6 list-disc space-y-1 text-slate-600 dark:text-slate-300">
              <li>Expire 12 months after they are added to your account</li>
              <li>Are non-transferable</li>
              <li>Are non-refundable except as required by law or at our discretion</li>
              <li>Each credit allows you to tailor one resume to one job description</li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              6. Privacy and Data
            </h2>
            <p className="leading-relaxed text-slate-600 dark:text-slate-300">
              Your privacy is important to us. Uploaded files are parsed in memory and discarded after extraction; session data is stored in Redis for up to 60 minutes and tailoring uses OpenAI. Please review our <a href="/privacy" className="text-blue-600 hover:underline dark:text-blue-400">Privacy Policy</a> for more information about how we handle your data.
            </p>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              7. Disclaimer
            </h2>
            <p className="leading-relaxed text-slate-600 dark:text-slate-300">
              The materials on Rolefit are provided on an &apos;as is&apos; basis. Rolefit makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
            </p>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              8. Limitations
            </h2>
            <p className="leading-relaxed text-slate-600 dark:text-slate-300">
              In no event shall Rolefit or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Rolefit, even if Rolefit or a Rolefit authorized representative has been notified orally or in writing of the possibility of such damage.
            </p>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              9. Revisions
            </h2>
            <p className="leading-relaxed text-slate-600 dark:text-slate-300">
              Rolefit may revise these terms of service at any time without notice. By using this service you are agreeing to be bound by the then current version of these terms of service.
            </p>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              10. Contact Information
            </h2>
            <p className="leading-relaxed text-slate-600 dark:text-slate-300">
              If you have any questions about these Terms of Service, please contact us at <a href="/contact" className="text-blue-600 hover:underline dark:text-blue-400">support@tryrolefit.com</a> or through our <a href="/contact" className="text-blue-600 hover:underline dark:text-blue-400">contact page</a>.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
