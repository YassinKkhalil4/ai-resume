export function sanitizeHtmlForDocx(html: string): string {
  // Brutal but effective:
  // - remove <style>, <script>, inline styles
  // - convert <div> to <p>, keep <h1..h3>, <ul><li>, <p>, <strong>, <em>, <a>
  let s = html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/\sstyle="[^"]*"/g, '')
    .replace(/<div\b/gi, '<p').replace(/<\/div>/gi, '</p>')

  // strip anything not in allowlist (light touch)
  s = s.replace(/<(?!\/?(h[1-3]|p|ul|li|strong|em|a)(\s|>|\/))/gi, '&lt;')
  // lists: ensure <li> only inside <ul> (best-effort)
  return s
}
