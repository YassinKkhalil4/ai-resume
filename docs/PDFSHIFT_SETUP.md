# PDFShift Integration Guide

This document describes the PDFShift integration for PDF export functionality.

## ✅ Implementation Complete

The PDF service has been updated to use PDFShift as the primary PDF generation service with improved error handling and fallback mechanisms.

## 🔧 Environment Variables

Add these to your `.env.local` (development) and Vercel (production):

```bash
# PDFShift Configuration
PDF_SERVICE_API_KEY=your_pdfshift_api_key_here
PDF_SERVICE_URL=https://api.pdfshift.io/v3/convert/pdf
PDF_SERVICE_TYPE=pdfshift
```

### Getting Your PDFShift API Key

1. Sign up at https://pdfshift.io
2. Navigate to Dashboard → API Keys
3. Copy your API key
4. Add it to your environment variables

**Free Tier:** 250 PDFs/month  
**Paid:** $0.01 per PDF after free tier

## 🧪 Testing

Run the test script to verify PDF generation:

```bash
npx tsx test-pdf-service.ts
```

This will:
- Test PDF generation with sample HTML
- Test PDF generation with resume data structure
- Test error handling
- Generate test PDF files: `test-output-simple.pdf` and `test-output-resume.pdf`

## 📊 PDF Generation Flow

The system uses a multi-tier fallback approach:

1. **Primary: PDFShift** (High Quality)
   - Fast (1-2 seconds)
   - Reliable (99.9% success rate)
   - Best formatting and CSS support
   - Used in production

2. **Fallback 1: Puppeteer** (High Quality)
   - Only available in local development (not on Vercel)
   - Good for testing without API key
   - Requires `puppeteer` package installed

3. **Fallback 2: Basic PDF** (Low Quality)
   - Text-only, minimal formatting
   - Always available as last resort
   - Should only be used if PDFShift fails

## 🔍 Error Handling

The implementation includes:

- ✅ Detailed error logging with service identification
- ✅ Timeout handling (30 seconds)
- ✅ Content validation (checks PDF size and type)
- ✅ Helpful error messages
- ✅ Automatic fallback to next method on failure
- ✅ Monitoring and telemetry integration

## 📝 Code Changes

### Updated Files

1. **`lib/pdf-service-v2.ts`**
   - Updated `generatePDFWithExternalService()` for PDFShift API
   - Improved error handling throughout
   - Enhanced logging with service names
   - Better timeout and validation handling

### Key Features

- **PDFShift API Integration**: Uses Basic Auth with `api:api_key` format
- **Request Configuration**: Optimized for resume PDFs (A4, proper margins)
- **Error Recovery**: Automatic fallback chain ensures PDF is always generated
- **Production Ready**: Works seamlessly on Vercel serverless functions

## 🚀 Deployment Checklist

- [ ] Add `PDF_SERVICE_API_KEY` to Vercel environment variables
- [ ] Add `PDF_SERVICE_URL` (optional, defaults to PDFShift)
- [ ] Test PDF generation in production
- [ ] Monitor PDFShift dashboard for usage
- [ ] Set up alerts if needed (via PDFShift dashboard)

## 💰 Cost Estimation

**Example Usage:**
- 1,000 PDFs/month = 250 free + 750 paid = **$7.50/month**
- 5,000 PDFs/month = 250 free + 4,750 paid = **$47.50/month**

## 🔗 Resources

- PDFShift Documentation: https://pdfshift.io/docs
- PDFShift Dashboard: https://pdfshift.io/dashboard
- API Reference: https://pdfshift.io/docs/api

## 🐛 Troubleshooting

### "PDF service API key not configured"
- Ensure `PDF_SERVICE_API_KEY` is set in environment variables
- Check that the key is correct (no extra spaces)

### "PDFShift API request timed out"
- Check your internet connection
- Verify PDFShift service status
- Try again (may be temporary)

### "PDFShift returned invalid or empty PDF"
- Check PDFShift dashboard for API errors
- Verify your API key is valid
- Check usage limits (free tier: 250/month)

### Fallback to basic PDF
- This means PDFShift failed
- Check logs for specific error
- Verify API key and network connectivity
- Basic PDF will still work but with limited formatting

## 📈 Monitoring

The system logs all PDF generation attempts:
- Success/failure status
- Response times
- Method used (pdfshift, puppeteer, basic_pdf)
- File sizes
- Error messages

Check your application logs or telemetry system for these metrics.

