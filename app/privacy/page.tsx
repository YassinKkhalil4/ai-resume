export default function Privacy() {
  return (
    <div className="card p-6">
      <h2 className="mb-2">Privacy</h2>
      <p className="text-sm text-gray-700">
        Files are processed in-memory and never persisted to disk or third-party storage by default. Uploaded files are discarded immediately after text extraction.
        Sessions are ephemeral (60 minutes). Enable persistence only if you configure a database explicitly.
      </p>
      <p className="text-sm text-gray-700 mt-2">We never invent experience. See the Integrity badge in the header.</p>
    </div>
  )
}
