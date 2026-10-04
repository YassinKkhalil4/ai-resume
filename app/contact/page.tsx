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
    <main className="space-y-20 md:space-y-28">
      <section aria-labelledby="contact-heading" className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <h1 id="contact-heading" className="enter enter-1 text-4xl font-semibold leading-[1.05] tracking-tighter sm:text-5xl lg:text-6xl">
            Get in touch
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-slate-600 dark:text-slate-400 md:text-lg">
            Have a question, feedback, or need help? Send us a message and we&apos;ll get back to you as soon as we can.
          </p>

          <dl className="mt-10 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            <div className="py-4">
              <dt className="text-sm font-semibold">Email</dt>
              <dd className="mt-1 text-slate-600 dark:text-slate-400">support@tryrolefit.com</dd>
            </div>
            <div className="py-4">
              <dt className="text-sm font-semibold">Response time</dt>
              <dd className="mt-1 text-slate-600 dark:text-slate-400">We typically respond within 24 hours.</dd>
            </div>
            <div className="py-4">
              <dt className="text-sm font-semibold">Billing questions</dt>
              <dd className="mt-1 text-slate-600 dark:text-slate-400">
                Check the <a href="/pricing" className="font-medium text-blue-700 underline underline-offset-4 dark:text-blue-300">pricing page</a> first, or write to us.
              </dd>
            </div>
          </dl>
        </div>

        <div className="enter enter-2 card p-6 sm:p-8 lg:col-span-7">
          <h2 className="mb-6 text-xl font-semibold tracking-tight">Send us a message</h2>
          {error && (
            <div role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
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
      </section>
    </main>
  )
}
