declare module 'jsdom' {
  export class JSDOM {
    constructor(html?: string)
    serialize(): string
  }
}

declare module 'html-docx-js' {
  const htmlDocx: { asBlob: (html: string) => Blob }
  export default htmlDocx
}
