"use strict";(()=>{var e={};e.id=711,e.ids=[711],e.modules={98860:e=>{e.exports=require("jsdom")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},89261:e=>{e.exports=require("postcss")},78018:e=>{e.exports=require("puppeteer")},61107:e=>{e.exports=require("puppeteer-core")},39491:e=>{e.exports=require("assert")},6113:e=>{e.exports=require("crypto")},82361:e=>{e.exports=require("events")},57147:e=>{e.exports=require("fs")},13685:e=>{e.exports=require("http")},95687:e=>{e.exports=require("https")},87561:e=>{e.exports=require("node:fs")},70612:e=>{e.exports=require("node:os")},49411:e=>{e.exports=require("node:path")},41041:e=>{e.exports=require("node:url")},65628:e=>{e.exports=require("node:zlib")},22037:e=>{e.exports=require("os")},71017:e=>{e.exports=require("path")},12781:e=>{e.exports=require("stream")},76224:e=>{e.exports=require("tty")},57310:e=>{e.exports=require("url")},73837:e=>{e.exports=require("util")},87565:(e,t,n)=>{n.r(t),n.d(t,{originalPathname:()=>N,patchFetch:()=>O,requestAsyncStorage:()=>_,routeModule:()=>F,serverHooks:()=>E,staticGenerationAsyncStorage:()=>R});var i={};n.r(i),n.d(i,{GET:()=>D,POST:()=>P,dynamic:()=>k,maxDuration:()=>j,runtime:()=>$});var o=n(49303),r=n(88716),s=n(60670),a=n(87070),l=n(45647);function c(e){return e.replace(/[&<>]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;"})[e])}function d(e){return e.replace(/[&<>]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;"})[e])}function p(e){return e.replace(/[&<>]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;"})[e])}function u(e){return(e||"").replace(/[&<>]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;"})[e])}function m(e,t){return t&&t.length?`<div class="sec"><h2>${e}</h2><ul>${t.map(e=>`<li>${e}</li>`).join("")}</ul></div>`:""}function g(e){return(e||"").replace(/[&<>]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;"})[e])}async function f(e,t,n){return"classic"===t?`<!doctype html>
<html><head><meta charset="utf-8" /><style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, "Helvetica Neue", Helvetica, sans-serif; color:#111; font-size: 12pt; line-height: 1.35; }
  h1,h2 { margin: 0 0 6px; }
  h2 { font-size: 13pt; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  .sec { margin: 14px 0; }
  .role { font-weight: bold; }
  ul { margin: 6px 0 0 16px; padding: 0; }
  li { margin: 4px 0; }
  .chips span { display:inline-block; border:1px solid #ccc; border-radius: 12px; padding: 2px 8px; margin: 0 6px 6px 0; font-size: 10pt; }
</style></head><body>
  ${n.includeSummary&&e.summary?`<div class="sec"><h2>Summary</h2><div>${p(e.summary)}</div></div>`:""}
  <div class="sec"><h2>Experience</h2>
    ${e.experience.map(e=>`
      <div class="entry">
        <div class="role">${p(e.role)} — ${p(e.company)}</div>
        <div class="dates" style="color:#666">${p(e.dates)}</div>
        <ul>${e.bullets.map(e=>`<li>${p(e)}</li>`).join("")}</ul>
      </div>
    `).join("")}
  </div>
  ${n.includeSkills&&e.skills?.length?`<div class="sec"><h2>Skills</h2><div class="chips">${(e.skills||[]).map(e=>`<span>${p(e)}</span>`).join("")}</div></div>`:""}
  ${e.education?.length?`<div class="sec"><h2>Education</h2><ul>${(e.education||[]).map(e=>`<li>${p(e)}</li>`).join("")}</ul></div>`:""}
  ${e.certifications?.length?`<div class="sec"><h2>Certifications</h2><ul>${(e.certifications||[]).map(e=>`<li>${p(e)}</li>`).join("")}</ul></div>`:""}
</body></html>`:"modern"===t?`<!doctype html>
<html><head><meta charset="utf-8" /><style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, "Helvetica Neue", Helvetica, sans-serif; color:#111; font-size: 12pt; line-height: 1.35; }
  h2 { font-size: 13pt; margin: 0 0 8px; }
  .sec { margin: 14px 0; }
  .row { display:flex; justify-content: space-between; }
  .role { font-weight: 600; }
  ul { margin: 6px 0 0 16px; padding: 0; }
  li { margin: 4px 0; }
  .chips span { display:inline-block; background:#f5f5f5; border-radius: 6px; padding: 2px 8px; margin: 0 6px 6px 0; font-size: 10pt; }
  .divider { height:1px; background:#eee; margin:8px 0; }
</style></head><body>
  ${n.includeSummary&&e.summary?`<div class="sec"><h2>Summary</h2><div>${d(e.summary)}</div></div>`:""}
  <div class="sec"><h2>Experience</h2><div class="divider"></div>
    ${e.experience.map(e=>`
      <div class="entry">
        <div class="row"><div class="role">${d(e.role)} — ${d(e.company)}</div><div style="color:#666">${d(e.dates)}</div></div>
        <ul>${e.bullets.map(e=>`<li>${d(e)}</li>`).join("")}</ul>
      </div>
    `).join("")}
  </div>
  ${n.includeSkills&&e.skills?.length?`<div class="sec"><h2>Skills</h2><div class="chips">${(e.skills||[]).map(e=>`<span>${d(e)}</span>`).join("")}</div></div>`:""}
  ${e.education?.length?`<div class="sec"><h2>Education</h2><ul>${(e.education||[]).map(e=>`<li>${d(e)}</li>`).join("")}</ul></div>`:""}
</body></html>`:"executive"===t?function(e,t){var n;let i=`
  body{font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, "Helvetica Neue", Helvetica, sans-serif; color:#0b0b0b; font-size:11.5pt; line-height:1.38;}
  .wrap{max-width:820px; margin:0 auto;}
  .hdr{display:grid; grid-template-columns: 2fr 1fr; gap:16px; align-items:flex-end; border-bottom:2px solid #111; padding-bottom:10px; margin-bottom:14px}
  .name{font-size:20pt; font-weight:700; letter-spacing:.2px}
  .contact{font-size:10pt; color:#444; text-align:right}
  h2{font-size:12.8pt; margin:14px 0 6px; letter-spacing:.2px}
  .sec{margin: 6px 0 10px}
  .role{font-weight:600}
  ul{margin:4px 0 0 16px; padding:0}
  li{margin:2px 0}
  .meta{color:#666; font-weight:400}
  `,o=e.contact?.name||"",r=(n=e.contact)?[n.email,n.phone,n.location,n.website].filter(Boolean):[];return`<!doctype html><html><head><meta charset="utf-8" /><style>${i}</style></head><body><div class="wrap">
  <div class="hdr">
    <div class="name">${u(o)}</div>
    <div class="contact">${r.join(" \xb7 ")}</div>
  </div>
  ${t.includeSummary&&e.summary?`<div class="sec"><h2>Executive Summary</h2><div>${u(e.summary)}</div></div>`:""}
  <div class="sec"><h2>Experience</h2>
    ${e.experience.map(e=>`
      <div class="entry">
        <div class="role">${u(e.role)} — ${u(e.company)} <span class="meta">(${u(e.dates)})</span></div>
        <ul>${e.bullets.map(e=>`<li>${u(e)}</li>`).join("")}</ul>
      </div>
    `).join("")}
  </div>
  ${t.includeSkills&&e.skills?.length?`<div class="sec"><h2>Core Skills</h2><div>${(e.skills||[]).join(" • ")}</div></div>`:""}
  ${e.education?.length?`<div class="sec"><h2>Education</h2><ul>${(e.education||[]).map(e=>`<li>${u(e)}</li>`).join("")}</ul></div>`:""}
  </div></body></html>`}(e,n):"academic"===t?function(e,t){let n=`
  body{font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, "Helvetica Neue", Helvetica, sans-serif; color:#111; font-size:11.5pt; line-height:1.4}
  .wrap{max-width:820px; margin:0 auto}
  h1{font-size:18pt; margin:0 0 6px; font-weight:700}
  h2{font-size:12.5pt; margin:12px 0 6px}
  .sec{margin: 6px 0 10px}
  ul{margin:4px 0 0 16px; padding:0}
  li{margin:2px 0}
  .meta{color:#666}
  `,i=e.contact||{};return`<!doctype html><html><head><meta charset="utf-8" /><style>${n}</style></head><body><div class="wrap">
    <h1>${g(i.name||"")}</h1>
    ${t.includeSummary&&e.summary?`<div class="sec"><h2>Research Summary</h2><div>${g(e.summary)}</div></div>`:""}
    ${m("Projects",e.projects?.map(e=>`${g(e.name)} — ${e.bullets.map(e=>g(e)).join("; ")}`)||[])}
    ${m("Publications",e.publications||[])}
    ${m("Teaching",e.teaching||[])}
    ${m("Experience",(e.experience||[]).map(e=>`${g(e.role)} — ${g(e.company)} <span class=meta>(${g(e.dates)})</span>`))}
    ${t.includeSkills&&e.skills?.length?`<div class="sec"><h2>Skills</h2><div>${(e.skills||[]).join(" • ")}</div></div>`:""}
    ${e.education?.length?`<div class="sec"><h2>Education</h2><ul>${(e.education||[]).map(e=>`<li>${g(e)}</li>`).join("")}</ul></div>`:""}
  </div></body></html>`}(e,n):`<!doctype html>
<html><head><meta charset="utf-8" /><style>
  /* Force safe system fonts to avoid blank glyphs in serverless Chromium */
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, "Helvetica Neue", Helvetica, sans-serif; color:#111; font-size: 11.5pt; line-height: 1.35; }
  h2 { font-size: 12.5pt; margin: 0 0 6px; letter-spacing: 0.2px; }
  .sec { margin: 16px 0; }
  .role { font-weight: 600; }
  ul { margin: 4px 0 0 16px; padding: 0; }
  li { margin: 2px 0; }
  .sep { height:1px; background:#eaeaea; margin:10px 0; }
</style></head><body>
  ${n.includeSummary&&e.summary?`<div class="sec"><h2>Summary</h2><div>${c(e.summary)}</div></div>`:""}
  <div class="sec"><h2>Experience</h2><div class="sep"></div>
    ${e.experience.map(e=>`
      <div class="entry">
        <div class="role">${c(e.role)} — ${c(e.company)} <span style="color:#666; font-weight:400">(${c(e.dates)})</span></div>
        <ul>${e.bullets.map(e=>`<li>${c(e)}</li>`).join("")}</ul>
      </div>
    `).join("")}
  </div>
  ${n.includeSkills&&e.skills?.length?`<div class="sec"><h2>Skills</h2><div>${(e.skills||[]).join(" • ")}</div></div>`:""}
  ${e.education?.length?`<div class="sec"><h2>Education</h2><ul>${(e.education||[]).map(e=>`<li>${c(e)}</li>`).join("")}</ul></div>`:""}
</body></html>`}async function h(e){let{convertHtmlToDocument:t}=await Promise.all([n.e(969),n.e(511)]).then(n.bind(n,9511));return await t(e)}async function y(e){let t=null;console.log("Starting PDF generation with HTML length:",e.length);for(let n=1;n<=2;n++)try{console.log(`PDF generation attempt ${n}/2`);let t=await v(e);if(!t||0===t.length)throw Error("PDF generation returned empty buffer");return console.log(`PDF generation successful on attempt ${n}, size:`,t.length),t}catch(e){if(t=e,console.warn(`PDF generation attempt ${n} failed:`,e),n<2){let e=1e3*n;console.log(`Waiting ${e}ms before retry...`),await new Promise(t=>setTimeout(t,e))}}try{return console.warn("All PDF service attempts failed, trying fallback method"),await x(e)}catch(e){throw console.error("All PDF generation methods failed:",e),Error(`PDF generation failed after 2 attempts: ${t?.message}`)}}async function v(e){let t="1"===process.env.USE_LAMBDA_CHROMIUM||"1"===process.env.VERCEL;if(console.log("Using PDF generation method:",t?"Lambda/Chromium":"Local Puppeteer"),t){let t=await n.e(837).then(n.t.bind(n,86837,23)),i=await Promise.resolve().then(n.t.bind(n,61107,23)),o=await i.launch({args:t.default.args,defaultViewport:t.default.defaultViewport,executablePath:await t.default.executablePath(),headless:t.default.headless});try{let t=await o.newPage();return await t.setCacheEnabled(!1),await t.emulateMediaType("screen"),await t.setContent(e,{waitUntil:"domcontentloaded"}),await t.pdf({format:"A4",printBackground:!0,preferCSSPageSize:!0,margin:{top:"18mm",right:"16mm",bottom:"18mm",left:"16mm"}})}finally{await o.close()}}else{let t=await Promise.resolve().then(n.t.bind(n,78018,23)),i=await t.launch({headless:!0});try{let t=await i.newPage();return await t.emulateMediaType("screen"),await t.setContent(e,{waitUntil:"domcontentloaded"}),await t.pdf({format:"A4",printBackground:!0,preferCSSPageSize:!0,margin:{top:"18mm",right:"16mm",bottom:"18mm",left:"16mm"}})}finally{await i.close()}}}async function x(e){let t=e.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim(),n=`%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length ${t.length+100}
>>
stream
BT
/F1 12 Tf
50 750 Td
(${t.substring(0,100)}) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000274 00000 n 
0000000500 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
${600+t.length}
%%EOF`;return Buffer.from(n,"utf8")}var b=n(32064),w=n(74068),S=n(57033);let $="nodejs",k="force-dynamic",j=30;async function D(e){return a.NextResponse.json({error:"Method not allowed",message:"This endpoint only accepts POST requests",method:e.method},{status:405})}async function P(e){let t,n;console.log("Export API called:",{method:e.method,url:e.url,timestamp:new Date().toISOString()});try{let t=(0,b.d7)(e);if(!t.ok)return console.log("Guard check failed:",t.res),t.res;if((0,w.iE)().pauseExport)return a.NextResponse.json({code:"export_paused",message:"Export functionality is temporarily disabled"},{status:503});console.log("Guard check passed");let n=(0,S.db)({route:"export"});if(console.log("Trace started"),!(e.headers.get("content-type")||"").includes("application/json"))return a.NextResponse.json({code:"invalid_content_type",message:"Request must be JSON format"},{status:415});let{session_id:i,template:o="minimal",format:r="pdf",options:s={includeSummary:!0,includeSkills:!0},session_snapshot:c}=await e.json()||{},d=c??(i?(0,l.G)(i):null);if(!d)return a.NextResponse.json({code:"session_not_found",message:"No session data available"},{status:404});console.log("Export parameters:",{session_id:i?"present":"missing",template:o,format:r,options:s,has_snapshot:!!c}),console.log("Building resume object...");let p=d.tailored||d.preview_sections_json,u=d.original||d.original_sections_json,m={summary:s.includeSummary&&p.summary||"",skills:s.includeSkills&&p.skills_section||[],experience:(p.experience||[]).filter(e=>e.company&&e.role),education:u?.education||[],certifications:u?.certifications||[]};console.log("Resume object built"),console.log("Rendering HTML...");let g=await f(m,o,{includeSkills:!!s.includeSkills,includeSummary:!!s.includeSummary});if(console.log("HTML rendered successfully"),"pdf"===r){console.log("Generating PDF..."),console.log("HTML length:",g.length);try{let e=Date.now(),t=await y(g);if(console.log("PDF generated successfully, size:",t.length),!t||0===t.length)throw Error("PDF generation returned empty buffer");let i=Date.now()-e;(0,S.zJ)(1,!0,void 0,"external_service",t.length),n.end(!0,{size:t.length,pdf_ms:i});let o=t.buffer.slice(t.byteOffset,t.byteOffset+t.byteLength);return new a.NextResponse(o,{headers:{"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="resume.pdf"',"Content-Length":String(t.length)}})}catch(e){console.error("PDF generation failed:",e),console.error("PDF error stack:",e instanceof Error?e.stack:"No stack trace"),(0,S.zJ)(1,!1,String(e),"external_service"),(0,S.H)(e,{format:r,template:o,session_id:i,htmlLength:g.length}),n.end(!1,{error:String(e)});try{let e=Date.now(),t=await h(g);(0,S.zJ)(1,!0,void 0,"docx_fallback",t.length),n.end(!0,{size:t.length,fallback:"docx",docx_ms:Date.now()-e});let i=t.buffer.slice(t.byteOffset,t.byteOffset+t.byteLength);return new a.NextResponse(i,{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":'attachment; filename="resume.docx"',"Content-Length":String(t.length)}})}catch(e){return console.error("DOCX fallback failed:",e),a.NextResponse.json({code:"pdf_generation_failed",message:"Failed to generate PDF file",details:void 0},{status:500})}}}else{console.log("Generating DOCX...");try{let e=Date.now(),t=await h(g);console.log("DOCX generated successfully, size:",t.length),n.end(!0,{size:t.length,docx_ms:Date.now()-e});let i=t.buffer.slice(t.byteOffset,t.byteOffset+t.byteLength);return new a.NextResponse(i,{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":'attachment; filename="resume.docx"',"Content-Length":String(t.length)}})}catch(e){return console.error("DOCX generation failed:",e),n.end(!1,{error:String(e)}),a.NextResponse.json({code:"docx_generation_failed",message:"Failed to generate DOCX file",details:void 0},{status:500})}}}catch(e){console.error("Export API error:",e),console.error("Error stack:",e instanceof Error?e.stack:"No stack trace"),(0,S.H)(e,{route:"export",session_id:t||"unknown",format:n||"unknown",template:"minimal"});try{return a.NextResponse.json({code:"server_error",message:"An unexpected error occurred during export",details:void 0,timestamp:new Date().toISOString()},{status:500})}catch(e){return console.error("Failed to create JSON response:",e),a.NextResponse.json({code:"server_error",message:"An unexpected error occurred"},{status:500})}}}let F=new o.AppRouteRouteModule({definition:{kind:r.x.APP_ROUTE,page:"/api/export/route",pathname:"/api/export",filename:"route",bundlePath:"app/api/export/route"},resolvedPagePath:"/Users/yassinkhalil/Downloads/ai-resume-tailor_v2_full/app/api/export/route.ts",nextConfigOutput:"",userland:i}),{requestAsyncStorage:_,staticGenerationAsyncStorage:R,serverHooks:E}=F,N="/api/export/route";function O(){return(0,s.patchFetch)({serverHooks:E,staticGenerationAsyncStorage:R})}},74068:(e,t,n)=>{n.d(t,{iE:()=>a,rF:()=>l});var i=n(57147),o=n.n(i);let r="/tmp/ai-resume-tailor-config.json",s={rate:{ipPerMin:Number(process.env.RATE_IP_PER_MIN||30),sessionPerMin:Number(process.env.RATE_SESSION_PER_MIN||5)},invites:(process.env.INVITE_CODES||"").split(",").map(e=>e.trim()).filter(Boolean),openaiKey:void 0,pauseTailor:!1,pauseExport:!1};function a(){return s}function l(e){s={...s,...e,rate:{...s.rate,...e.rate||{}}},function(){try{o().writeFileSync(r,JSON.stringify(s,null,2))}catch{}}()}!function(){try{if(o().existsSync(r)){let e=o().readFileSync(r,"utf8"),t=JSON.parse(e);s={...s,...t}}}catch{}}()},32064:(e,t,n)=>{n.d(t,{M9:()=>p,d7:()=>u});var i=n(87070),o=n(74068);let r=new Map,s=new Map;function a(){return Date.now()}function l(e,t){let n=a();for(;e.length&&n-e[0]>t;)e.shift()}function c(e,t){let n=e.get(t)||[];return n.push(a()),e.set(t,n),n}function d(e,t){let n=(e.headers.get("cookie")||"").match(RegExp("(?:^|; )"+t+"=([^;]+)"));return n?decodeURIComponent(n[1]):null}function p(e){return d(e,"sid")||"anon"}function u(e){let t=(0,o.iE)();if(!function(e){let t=(0,o.iE)();if(!t.invites.length)return!0;let n=e.headers.get("x-invite-code")||"",i=d(e,"invite")||"",r=n||i;return!!r&&t.invites.includes(r)}(e))return{ok:!1,res:i.NextResponse.json({error:"Invite code required",code:"invite_required"},{status:403})};let n=(e.headers.get("x-forwarded-for")||"").split(",")[0].trim()||"0.0.0.0",u=p(e),m=c(r,n),g=c(s,u);return(l(m,6e4),l(g,6e4),function(e=6e4,t=5e3){let n=a();for(let[t,i]of r){for(;i.length&&n-i[0]>e;)i.shift();0===i.length&&r.delete(t)}for(let[t,i]of s){for(;i.length&&n-i[0]>e;)i.shift();0===i.length&&s.delete(t)}if(r.size>t){for(let e of r.keys())if(r.delete(e),r.size<=t)break}if(s.size>t){for(let e of s.keys())if(s.delete(e),s.size<=t)break}}(),m.length>t.rate.ipPerMin)?{ok:!1,res:i.NextResponse.json({error:"Rate limit exceeded (ip)",code:"rate_ip"},{status:429})}:g.length>t.rate.sessionPerMin?{ok:!1,res:i.NextResponse.json({error:"Rate limit exceeded (session)",code:"rate_session"},{status:429})}:{ok:!0}}},45647:(e,t,n)=>{n.d(t,{G:()=>a,e:()=>s});var i=n(9576);let o=new Map;function r(e=36e5){let t=Date.now();for(let[n,i]of o)t-i.createdAt>e&&o.delete(n)}function s(e,t,n,s){r();let a=(0,i.Z)(),l={id:a,createdAt:Date.now(),original:e,tailored:t,jdText:n,keywordStats:s};return o.set(a,l),l}function a(e){r();let t=o.get(e);return t?Date.now()-t.createdAt>36e5?(o.delete(e),null):t:null}},57033:(e,t,n)=>{n.d(t,{H:()=>p,Ud:()=>d,db:()=>c,dl:()=>m,zJ:()=>u});var i=n(57147),o=n.n(i),r=n(9576);let s="/tmp/telemetry.jsonl",a=process.env.LOG_DRAIN_URL||"",l=process.env.LOG_DRAIN_KEY||"";function c(e={}){let t=(0,r.Z)(),n=Date.now();return{id:t,end:function(i,r={}){let a={id:t,ok:i,ms:Date.now()-n,timestamp:new Date().toISOString(),...e,...r};try{o().appendFileSync(s,JSON.stringify(a)+"\n")}catch(e){console.warn("Failed to write telemetry:",e)}return g(a),a}}}function d(e,t,n,i,r){let s={timestamp:new Date().toISOString(),type:"ai_response",attempt:e,success:t,error:n?.substring(0,500),responseLength:i,model:r||process.env.OPENAI_MODEL||"gpt-4o-mini"};try{o().appendFileSync("/tmp/ai-responses.jsonl",JSON.stringify(s)+"\n")}catch(e){console.warn("Failed to log AI response:",e)}g(s)}function p(e,t={}){let n={timestamp:new Date().toISOString(),type:"error",message:e.message,stack:e.stack,context:JSON.stringify(t)};try{o().appendFileSync("/tmp/error-log.jsonl",JSON.stringify(n)+"\n")}catch(e){console.warn("Failed to log error:",e)}g(n)}function u(e,t,n,i,r){let a={timestamp:new Date().toISOString(),type:"pdf_generation",attempt:e,success:t,error:n?.substring(0,500),method:i,size:r};try{o().appendFileSync(s,JSON.stringify(a)+"\n")}catch(e){console.warn("Failed to log PDF generation:",e)}g(a)}function m(e,t,n={}){let i={timestamp:new Date().toISOString(),type:"session_activity",sessionId:e,activity:t,details:JSON.stringify(n)};try{o().appendFileSync(s,JSON.stringify(i)+"\n")}catch(e){console.warn("Failed to log session activity:",e)}g(i)}async function g(e){if(a)try{await fetch(a,{method:"POST",headers:{"Content-Type":"application/json",...l?{Authorization:`Bearer ${l}`}:{}},body:JSON.stringify(e)})}catch{}}},9576:(e,t,n)=>{n.d(t,{Z:()=>c});var i=n(6113),o=n.n(i);let r={randomUUID:o().randomUUID},s=new Uint8Array(256),a=s.length,l=[];for(let e=0;e<256;++e)l.push((e+256).toString(16).slice(1));let c=function(e,t,n){if(r.randomUUID&&!t&&!e)return r.randomUUID();let i=(e=e||{}).random||(e.rng||function(){return a>s.length-16&&(o().randomFillSync(s),a=0),s.slice(a,a+=16)})();if(i[6]=15&i[6]|64,i[8]=63&i[8]|128,t){n=n||0;for(let e=0;e<16;++e)t[n+e]=i[e];return t}return function(e,t=0){return l[e[t+0]]+l[e[t+1]]+l[e[t+2]]+l[e[t+3]]+"-"+l[e[t+4]]+l[e[t+5]]+"-"+l[e[t+6]]+l[e[t+7]]+"-"+l[e[t+8]]+l[e[t+9]]+"-"+l[e[t+10]]+l[e[t+11]]+l[e[t+12]]+l[e[t+13]]+l[e[t+14]]+l[e[t+15]]}(i)}}};var t=require("../../../webpack-runtime.js");t.C(e);var n=e=>t(t.s=e),i=t.X(0,[948,972],()=>n(87565));module.exports=i})();