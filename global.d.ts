declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string, options?: { url?: string })
    window: {
      document: Document
    }
    serialize(): string
  }
}

declare module 'html-docx-js' {
  const htmlDocx: { asBlob: (html: string) => Blob }
  export default htmlDocx
}
