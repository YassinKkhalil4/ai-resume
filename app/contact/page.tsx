'use client'

import { useState } from 'react'

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type')
      let data
      if (contentType && contentType.includes('application/json')) {
        data = await response.json()
      } else {
        // If not JSON, try to get text for error message
        const text = await response.text()
        setError('An unexpected error occurred. Please try again later.')
        setLoading(false)
        return
      }

      if (!response.ok) {
        setError(data.message || 'Failed to send message. Please try again.')
        setLoading(false)
        return
      }

      // Success - show confirmation and clear form
    setSubmitted(true)
      setFormData({ name: '', email: '', subject: '', message: '' })
      setTimeout(() => {
        setSubmitted(false)
    }, 3000)
    } catch (err) {
      setError('An error occurred. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <main className="space-y-12 pb-16">
      <section className="relative overflow-hidden rounded-3xl border border-white/50 bg-white/85 p-6 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 md:p-16">
        <div className="relative z-10 mx-auto max-w-3xl">
          <h1 className="mb-4 text-4xl font-semibold text-slate-900 dark:text-slate-100 md:text-5xl">
            Get in touch
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Have a question, feedback, or need help? We&apos;re here to help. Send us a message and we&apos;ll get back to you as soon as possible.
          </p>
        </div>
      </section>

      <section className="grid gap-8 md:grid-cols-2">
        <div className="rounded-3xl border border-white/50 bg-white/85 p-6 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 md:p-10">
          <h2 className="mb-6 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Send us a message
          </h2>
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="label mb-2 block">
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="input w-full"
                placeholder="Your name"
              />
            </div>
            <div>
              <label htmlFor="email" className="label mb-2 block">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="input w-full"
                placeholder="your.email@example.com"
              />
            </div>
            <div>
              <label htmlFor="subject" className="label mb-2 block">
                Subject
              </label>
              <select
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                className="input w-full"
              >
                <option value="">Select a subject</option>
                <option value="support">Support</option>
                <option value="feedback">Feedback</option>
                <option value="billing">Billing</option>
                <option value="feature">Feature Request</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="message" className="label mb-2 block">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                required
                rows={6}
                className="input w-full resize-none"
                placeholder="Your message..."
              />
            </div>
            <button
              type="submit"
              className="button w-full"
              disabled={submitted || loading}
            >
              {loading ? 'Sending...' : submitted ? 'Message Sent!' : 'Send Message'}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/50 bg-white/85 p-6 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 md:p-8">
            <h3 className="mb-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
              Other ways to reach us
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">Email</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">support@tryrolefit.com</div>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">Response Time</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">We typically respond within 24 hours</div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/50 bg-white/85 p-6 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90 md:p-8">
            <h3 className="mb-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
              Common questions
            </h3>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p>
                <strong className="text-slate-900 dark:text-slate-100">Need help with your account?</strong>
                <br />
                Check out our dashboard or contact support.
              </p>
              <p>
                <strong className="text-slate-900 dark:text-slate-100">Billing questions?</strong>
                <br />
                Visit our <a href="/pricing" className="text-blue-600 hover:underline dark:text-blue-400">pricing page</a> or contact us.
              </p>
              <p>
                <strong className="text-slate-900 dark:text-slate-100">Feature requests?</strong>
                <br />
                We&apos;d love to hear your ideas! Use the form to submit a feature request.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
