export default function Privacy() {
  return (
    <div className="card p-6">
      <h2 className="mb-2">Privacy</h2>
      <p className="text-sm text-gray-700">
        Uploaded files are parsed in memory and discarded after text extraction. Resume text, job descriptions, and tailored results are stored in Redis for up to 60 minutes so you can preview and export your session.
      </p>
      <p className="text-sm text-gray-700 mt-2">
        Resume and job description text is sent to OpenAI for tailoring. Lemon Squeezy handles checkout and sends payment webhooks used to add credits to your account.
      </p>
      <p className="text-sm text-gray-700 mt-2">We never invent experience. See the Integrity badge in the header.</p>
    </div>
  )
}
