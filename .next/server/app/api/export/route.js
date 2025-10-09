"use strict";(()=>{var e={};e.id=711,e.ids=[711],e.modules={98860:e=>{e.exports=require("jsdom")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78018:e=>{e.exports=require("puppeteer")},6113:e=>{e.exports=require("crypto")},57147:e=>{e.exports=require("fs")},64086:(e,t,i)=>{i.r(t),i.d(t,{originalPathname:()=>N,patchFetch:()=>q,requestAsyncStorage:()=>F,routeModule:()=>E,serverHooks:()=>O,staticGenerationAsyncStorage:()=>T});var s={};i.r(s),i.d(s,{GET:()=>j,POST:()=>P,dynamic:()=>_,maxDuration:()=>R,runtime:()=>k});var n=i(49303),r=i(88716),o=i(60670),a=i(87070),l=i(45647);function c(e){return(e||"").replace(/[&<>]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;"})[e])}function d(e){return(e||"").replace(/[&<>]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;"})[e])}function u(e){return(e||"").replace(/[&<>]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;"})[e])}function m(e){return(e||"").replace(/[&<>]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;"})[e])}function p(e,t){return t&&t.length?`<div class="sec"><h2>${e}</h2><ul>${t.map(e=>`<li>${e}</li>`).join("")}</ul></div>`:""}function h(e){return(e||"").replace(/[&<>]/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;"})[e])}var f=i(57033);async function g(e,t,i){return"classic"===t?`<!doctype html>
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
  ${i.includeSummary&&e.summary?`<div class="sec"><h2>Summary</h2><div>${u(e.summary)}</div></div>`:""}
  <div class="sec"><h2>Experience</h2>
    ${e.experience.map(e=>`
      <div class="entry">
        <div class="role">${u(e.role)} — ${u(e.company)}</div>
        <div class="dates" style="color:#666">${u(e.dates)}</div>
        <ul>${e.bullets.map(e=>`<li>${u(e)}</li>`).join("")}</ul>
      </div>
    `).join("")}
  </div>
  ${i.includeSkills&&e.skills?.length?`<div class="sec"><h2>Skills</h2><div class="chips">${(e.skills||[]).map(e=>`<span>${u(e)}</span>`).join("")}</div></div>`:""}
  ${e.education?.length?`<div class="sec"><h2>Education</h2><ul>${(e.education||[]).map(e=>`<li>${u(e)}</li>`).join("")}</ul></div>`:""}
  ${e.certifications?.length?`<div class="sec"><h2>Certifications</h2><ul>${(e.certifications||[]).map(e=>`<li>${u(e)}</li>`).join("")}</ul></div>`:""}
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
  ${i.includeSummary&&e.summary?`<div class="sec"><h2>Summary</h2><div>${d(e.summary)}</div></div>`:""}
  <div class="sec"><h2>Experience</h2><div class="divider"></div>
    ${e.experience.map(e=>`
      <div class="entry">
        <div class="row"><div class="role">${d(e.role)} — ${d(e.company)}</div><div style="color:#666">${d(e.dates)}</div></div>
        <ul>${e.bullets.map(e=>`<li>${d(e)}</li>`).join("")}</ul>
      </div>
    `).join("")}
  </div>
  ${i.includeSkills&&e.skills?.length?`<div class="sec"><h2>Skills</h2><div class="chips">${(e.skills||[]).map(e=>`<span>${d(e)}</span>`).join("")}</div></div>`:""}
  ${e.education?.length?`<div class="sec"><h2>Education</h2><ul>${(e.education||[]).map(e=>`<li>${d(e)}</li>`).join("")}</ul></div>`:""}
</body></html>`:"executive"===t?function(e,t){var i;let s=`
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
  `,n=e.contact?.name||"",r=(i=e.contact)?[i.email,i.phone,i.location,i.website].filter(Boolean):[];return`<!doctype html><html><head><meta charset="utf-8" /><style>${s}</style></head><body><div class="wrap">
  <div class="hdr">
    <div class="name">${m(n)}</div>
    <div class="contact">${r.join(" \xb7 ")}</div>
  </div>
  ${t.includeSummary&&e.summary?`<div class="sec"><h2>Executive Summary</h2><div>${m(e.summary)}</div></div>`:""}
  <div class="sec"><h2>Experience</h2>
    ${e.experience.map(e=>`
      <div class="entry">
        <div class="role">${m(e.role)} — ${m(e.company)} <span class="meta">(${m(e.dates)})</span></div>
        <ul>${e.bullets.map(e=>`<li>${m(e)}</li>`).join("")}</ul>
      </div>
    `).join("")}
  </div>
  ${t.includeSkills&&e.skills?.length?`<div class="sec"><h2>Core Skills</h2><div>${(e.skills||[]).join(" • ")}</div></div>`:""}
  ${e.education?.length?`<div class="sec"><h2>Education</h2><ul>${(e.education||[]).map(e=>`<li>${m(e)}</li>`).join("")}</ul></div>`:""}
  </div></body></html>`}(e,i):"academic"===t?function(e,t){let i=`
  body{font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, "Helvetica Neue", Helvetica, sans-serif; color:#111; font-size:11.5pt; line-height:1.4}
  .wrap{max-width:820px; margin:0 auto}
  h1{font-size:18pt; margin:0 0 6px; font-weight:700}
  h2{font-size:12.5pt; margin:12px 0 6px}
  .sec{margin: 6px 0 10px}
  ul{margin:4px 0 0 16px; padding:0}
  li{margin:2px 0}
  .meta{color:#666}
  `,s=e.contact||{};return`<!doctype html><html><head><meta charset="utf-8" /><style>${i}</style></head><body><div class="wrap">
    <h1>${h(s.name||"")}</h1>
    ${t.includeSummary&&e.summary?`<div class="sec"><h2>Research Summary</h2><div>${h(e.summary)}</div></div>`:""}
    ${p("Projects",e.projects?.map(e=>`${h(e.name)} — ${e.bullets.map(e=>h(e)).join("; ")}`)||[])}
    ${p("Publications",e.publications||[])}
    ${p("Teaching",e.teaching||[])}
    ${p("Experience",(e.experience||[]).map(e=>`${h(e.role)} — ${h(e.company)} <span class=meta>(${h(e.dates)})</span>`))}
    ${t.includeSkills&&e.skills?.length?`<div class="sec"><h2>Skills</h2><div>${(e.skills||[]).join(" • ")}</div></div>`:""}
    ${e.education?.length?`<div class="sec"><h2>Education</h2><ul>${(e.education||[]).map(e=>`<li>${h(e)}</li>`).join("")}</ul></div>`:""}
  </div></body></html>`}(e,i):`<!doctype html>
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
  ${i.includeSummary&&e.summary?`<div class="sec"><h2>Summary</h2><div>${c(e.summary)}</div></div>`:""}
  <div class="sec"><h2>Experience</h2><div class="sep"></div>
    ${e.experience.map(e=>`
      <div class="entry">
        <div class="role">${c(e.role)} — ${c(e.company)} <span style="color:#666; font-weight:400">(${c(e.dates)})</span></div>
        <ul>${e.bullets.map(e=>`<li>${c(e)}</li>`).join("")}</ul>
      </div>
    `).join("")}
  </div>
  ${i.includeSkills&&e.skills?.length?`<div class="sec"><h2>Skills</h2><div>${(e.skills||[]).join(" • ")}</div></div>`:""}
  ${e.education?.length?`<div class="sec"><h2>Education</h2><ul>${(e.education||[]).map(e=>`<li>${c(e)}</li>`).join("")}</ul></div>`:""}
</body></html>`}async function y(e){let{convertHtmlToDocument:t}=await Promise.all([i.e(969),i.e(511)]).then(i.bind(i,9511));return await t(e)}async function v(e){let t=process.env.PDF_SERVICE_API_KEY,i=process.env.PDF_SERVICE_URL||"https://api.html-pdf-service.com/generate";if(!t)throw Error("PDF service API key not configured");let s=await fetch(i,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},body:JSON.stringify({html:e,format:"A4",margin:{top:"18mm",right:"16mm",bottom:"18mm",left:"16mm"},printBackground:!0,preferCSSPageSize:!0,timeout:3e4})});if(!s.ok){let e=await s.text();throw Error(`PDF service API failed: ${s.status} ${s.statusText} - ${e}`)}let n=await s.arrayBuffer();return Buffer.from(n)}async function x(e){try{let t=await Promise.resolve().then(i.t.bind(i,78018,23)),s=await t.launch({headless:!0,args:["--no-sandbox","--disable-setuid-sandbox"]});try{let t=await s.newPage();return await t.emulateMediaType("screen"),await t.setContent(e,{waitUntil:"domcontentloaded"}),await t.pdf({format:"a4",printBackground:!0,preferCSSPageSize:!0,margin:{top:"18mm",right:"16mm",bottom:"18mm",left:"16mm"}})}finally{await s.close()}}catch(e){throw Error(`Puppeteer failed: ${e}`)}}async function w(e){let t=function(e){let t=e.split(" "),i=[],s="";for(let e of t)(s+" "+e).length>80&&s.length>0?(i.push(s.trim()),s=e):s+=(s.length>0?" ":"")+e;s.trim()&&i.push(s.trim());let n=Math.min(i.length,50),r=i.slice(0,n),o="",a=750;for(let e of r){if(a<30)break;let t=e.replace(/[()\\]/g,"\\$&");o+=`50 ${a} Td (${t}) Tj 0 0 Td `,a-=15}let l=`BT /F1 12 Tf ${o}ET`,c=l.length;return`%PDF-1.4
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
/Length ${c}
>>
stream
${l}endstream
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
${600+c}
%%EOF`}(e.replace(/<style[^>]*>.*?<\/style>/gis,"").replace(/class="[^"]*"/g,"").replace(/style="[^"]*"/g,"").replace(/<div[^>]*>/g,"<p>").replace(/<\/div>/g,"</p>").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim());return Buffer.from(t,"utf8")}async function b(e){for(let t of[{name:"external_service",fn:()=>v(e),quality:"high"},{name:"puppeteer",fn:()=>x(e),quality:"high"},{name:"basic_pdf",fn:()=>w(e),quality:"low"}])try{let e=await t.fn();if(e&&e.length>0)return{buffer:e,method:t.name,quality:t.quality}}catch(e){console.warn(`PDF method ${t.name} failed:`,e);continue}return console.warn("All PDF methods failed, creating basic PDF"),{buffer:await w(e),method:"basic_fallback",quality:"low"}}i(37188);var S=i(32064),$=i(74068);let k="nodejs",_="force-dynamic",R=30,D=new Map;async function j(e){return a.NextResponse.json({error:"Method not allowed",message:"This endpoint only accepts POST requests",method:e.method},{status:405})}async function P(e){let t,i;console.log("Export API called:",{method:e.method,url:e.url,timestamp:new Date().toISOString()});try{let t=(0,S.d7)(e);if(!t.ok)return console.log("Guard check failed:",t.res),t.res;if((0,$.iE)().pauseExport)return a.NextResponse.json({code:"export_paused",message:"Export functionality is temporarily disabled"},{status:503});console.log("Guard check passed");let i=(0,f.db)({route:"export"});if(console.log("Trace started"),!(e.headers.get("content-type")||"").includes("application/json"))return a.NextResponse.json({code:"invalid_content_type",message:"Request must be JSON format"},{status:415});let{session_id:s,template:n="minimal",format:r="pdf",options:o={includeSummary:!0,includeSkills:!0},session_snapshot:c}=await e.json()||{};if(!function(e){let t=Date.now(),i=`export_${e}`,s=D.get(i);return!s||t>s.resetTime?(D.set(i,{count:1,resetTime:t+6e4}),!0):!(s.count>=10)&&(s.count++,!0)}(s||"anonymous"))return a.NextResponse.json({code:"rate_limit_exceeded",message:"Too many export requests. Please wait 1 minute before trying again.",retryAfter:60},{status:429});let d=c??(s?(0,l.Gg)(s):null);if(!d)return a.NextResponse.json({code:"session_not_found",message:"No session data available"},{status:404});console.log("Export parameters:",{session_id:s?"present":"missing",template:n,format:r,options:o,has_snapshot:!!c}),console.log("Building resume object...");let u=d.tailored||d.preview_sections_json,m=d.original||d.original_sections_json,p={summary:o.includeSummary&&u.summary||"",skills:o.includeSkills&&u.skills_section||[],experience:(u.experience||[]).filter(e=>e.company&&e.role),education:m?.education||[],certifications:m?.certifications||[]};console.log("Resume object built"),console.log("Rendering HTML...");let h=await g(p,n,{includeSkills:!!o.includeSkills,includeSummary:!!o.includeSummary});if(console.log("HTML rendered successfully"),"pdf"===r){console.log("Generating PDF..."),console.log("HTML length:",h.length);try{let e=Date.now(),t=await b(h),s=t.buffer,r=t.method,o=t.quality;if(console.log(`PDF generated successfully using ${r} (${o} quality), size:`,s.length),!s||0===s.length)throw Error("PDF generation returned empty buffer");let l=Date.now()-e;(0,f.zJ)(1,!0,void 0,r,s.length),(0,f.Jf)({req_id:i.id,route:"export",timing:Date.now()-i.startTime,pdf_launch_ms:l,pdf_render_ms:l,final_status:"success",was_snapshot_used:!!c,additional_metrics:{format:"pdf",template:n,html_length:h.length,pdf_size:s.length,pdf_method:r,pdf_quality:o}}),i.end(!0,{size:s.length,pdf_ms:l,method:r,quality:o});let d=s.buffer.slice(s.byteOffset,s.byteOffset+s.byteLength),u={"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="resume.pdf"',"Content-Length":String(s.length)};return"low"===o&&(u["X-PDF-Quality"]="low",u["X-PDF-Method"]=r),new a.NextResponse(d,{headers:u})}catch(e){console.error("All PDF generation methods failed:",e),console.error("PDF error stack:",e instanceof Error?e.stack:"No stack trace"),(0,f.zJ)(1,!1,String(e),"all_methods_failed"),(0,f.H)(e,{format:r,template:n,session_id:s,htmlLength:h.length}),i.end(!1,{error:String(e)});try{console.log("Attempting DOCX fallback...");let e=Date.now(),t=await y(h),s=Date.now()-e;(0,f.zJ)(1,!0,void 0,"docx_fallback",t.length),(0,f.Jf)({req_id:i.id,route:"export",timing:Date.now()-i.startTime,docx_ms:s,final_status:"success",was_snapshot_used:!!c,additional_metrics:{format:"docx_fallback",template:n,html_length:h.length,docx_size:t.length,pdf_failed:!0}}),i.end(!0,{size:t.length,fallback:"docx",docx_ms:s});let r=t.buffer.slice(t.byteOffset,t.byteOffset+t.byteLength);return new a.NextResponse(r,{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":'attachment; filename="resume.docx"',"Content-Length":String(t.length),"X-Fallback-Reason":"PDF generation failed"}})}catch(e){return console.error("DOCX fallback also failed:",e),a.NextResponse.json({code:"export_generation_failed",message:"Failed to generate both PDF and DOCX files. Please try again or contact support.",details:void 0,fallback_suggestion:"Try exporting as DOCX format instead"},{status:500})}}}else{console.log("Generating DOCX...");try{let e=Date.now(),t=await y(h);console.log("DOCX generated successfully, size:",t.length);let s=Date.now()-e;(0,f.Jf)({req_id:i.id,route:"export",timing:Date.now()-i.startTime,docx_ms:s,final_status:"success",was_snapshot_used:!!c,additional_metrics:{format:"docx",template:n,html_length:h.length,docx_size:t.length}}),i.end(!0,{size:t.length,docx_ms:s});let r=t.buffer.slice(t.byteOffset,t.byteOffset+t.byteLength);return new a.NextResponse(r,{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":'attachment; filename="resume.docx"',"Content-Length":String(t.length)}})}catch(e){return console.error("DOCX generation failed:",e),i.end(!1,{error:String(e)}),a.NextResponse.json({code:"docx_generation_failed",message:"Failed to generate DOCX file. Please try PDF export instead.",details:void 0},{status:500})}}}catch(e){console.error("Export API error:",e),console.error("Error stack:",e instanceof Error?e.stack:"No stack trace"),(0,f.H)(e,{route:"export",session_id:t||"unknown",format:i||"unknown",template:"minimal"});try{return a.NextResponse.json({code:"server_error",message:"An unexpected error occurred during export",details:void 0,timestamp:new Date().toISOString()},{status:500})}catch(e){return console.error("Failed to create JSON response:",e),a.NextResponse.json({code:"server_error",message:"An unexpected error occurred"},{status:500})}}}let E=new n.AppRouteRouteModule({definition:{kind:r.x.APP_ROUTE,page:"/api/export/route",pathname:"/api/export",filename:"route",bundlePath:"app/api/export/route"},resolvedPagePath:"/Users/yassinkhalil/Downloads/ai-resume-tailor_v2_full/app/api/export/route.ts",nextConfigOutput:"",userland:s}),{requestAsyncStorage:F,staticGenerationAsyncStorage:T,serverHooks:O}=E,N="/api/export/route";function q(){return(0,o.patchFetch)({serverHooks:O,staticGenerationAsyncStorage:T})}},74068:(e,t,i)=>{i.d(t,{iE:()=>a,rF:()=>l});var s=i(57147),n=i.n(s);let r="/tmp/ai-resume-tailor-config.json",o={rate:{ipPerMin:Number(process.env.RATE_IP_PER_MIN||30),sessionPerMin:Number(process.env.RATE_SESSION_PER_MIN||5)},invites:(process.env.INVITE_CODES||"").split(",").map(e=>e.trim()).filter(Boolean),openaiKey:void 0,pauseTailor:!1,pauseExport:!1};function a(){return o}function l(e){o={...o,...e,rate:{...o.rate,...e.rate||{}}},function(){try{n().writeFileSync(r,JSON.stringify(o,null,2))}catch{}}()}!function(){try{if(n().existsSync(r)){let e=n().readFileSync(r,"utf8"),t=JSON.parse(e);o={...o,...t}}}catch{}}()},32064:(e,t,i)=>{i.d(t,{d7:()=>u});var s=i(87070),n=i(74068);let r=new Map,o=new Map;function a(){return Date.now()}function l(e,t){let i=a();for(;e.length&&i-e[0]>t;)e.shift()}function c(e,t){let i=e.get(t)||[];return i.push(a()),e.set(t,i),i}function d(e,t){let i=(e.headers.get("cookie")||"").match(RegExp("(?:^|; )"+t+"=([^;]+)"));return i?decodeURIComponent(i[1]):null}function u(e){let t=(0,n.iE)();if(!function(e){let t=(0,n.iE)();if(!t.invites.length)return!0;let i=e.headers.get("x-invite-code")||"",s=d(e,"invite")||"",r=i||s;return!!r&&t.invites.includes(r)}(e))return{ok:!1,res:s.NextResponse.json({code:"invite_required",message:"Invite code required"},{status:403})};let i=(e.headers.get("x-forwarded-for")||"").split(",")[0].trim()||"0.0.0.0",u=d(e,"sid")||"anon",m=c(r,i),p=c(o,u);return(l(m,6e4),l(p,6e4),function(e=6e4,t=5e3){let i=a();for(let[t,s]of r){for(;s.length&&i-s[0]>e;)s.shift();0===s.length&&r.delete(t)}for(let[t,s]of o){for(;s.length&&i-s[0]>e;)s.shift();0===s.length&&o.delete(t)}if(r.size>t){for(let e of r.keys())if(r.delete(e),r.size<=t)break}if(o.size>t){for(let e of o.keys())if(o.delete(e),o.size<=t)break}}(),m.length>t.rate.ipPerMin||p.length>t.rate.sessionPerMin)?{ok:!1,res:s.NextResponse.json({code:"rate_limited",message:"Too many requests"},{status:429})}:{ok:!0}}},37188:(e,t,i)=>{i.d(t,{XB:()=>a,lN:()=>o});var s=i(57033);class n{async trackPDFRequest(e,t,i,s,n){this.metrics.totalRequests++,t?this.metrics.successfulRequests++:this.metrics.failedRequests++,this.metrics.successRate=this.metrics.successfulRequests/this.metrics.totalRequests*100,this.metrics.averageResponseTime=(this.metrics.averageResponseTime*(this.metrics.totalRequests-1)+i)/this.metrics.totalRequests,this.metrics.methodBreakdown[e]||(this.metrics.methodBreakdown[e]={count:0,successRate:0}),this.metrics.methodBreakdown[e].count++,this.metrics.methodBreakdown[e].successRate=(this.metrics.methodBreakdown[e].count*this.metrics.methodBreakdown[e].successRate+(t?1:0))/this.metrics.methodBreakdown[e].count,n&&(this.metrics.qualityBreakdown[n]=(this.metrics.qualityBreakdown[n]||0)+1),s&&(this.metrics.errorBreakdown[s]=(this.metrics.errorBreakdown[s]||0)+1),t||await this.checkAlertConditions(e,s||"Unknown error")}async checkAlertConditions(e,t){let i=Date.now(),s=this.metrics.failedRequests,n="low";s>=this.failureThresholds.critical?n="critical":s>=this.failureThresholds.high?n="high":s>=this.failureThresholds.medium&&(n="medium");let r=`${e}-${n}`;i-(this.alertCooldowns.get(r)||0)<("critical"===n?6e4:3e5)||(await this.sendAlert({timestamp:new Date().toISOString(),sessionId:"system",method:e,error:t,htmlLength:0,retryCount:0,fallbackUsed:!1,severity:n}),this.alertCooldowns.set(r,i))}async sendAlert(e){if(console.error(`🚨 PDF ALERT [${e.severity.toUpperCase()}]:`,{method:e.method,error:e.error,severity:e.severity,timestamp:e.timestamp}),(0,s.H)(Error(`PDF Alert: ${e.error}`),{alert:e,severity:e.severity,method:e.method}),process.env.MONITORING_WEBHOOK_URL)try{await fetch(process.env.MONITORING_WEBHOOK_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:`🚨 PDF Generation Alert [${e.severity.toUpperCase()}]`,attachments:[{color:"critical"===e.severity?"danger":"high"===e.severity?"warning":"good",fields:[{title:"Method",value:e.method,short:!0},{title:"Error",value:e.error,short:!1},{title:"Severity",value:e.severity,short:!0},{title:"Time",value:e.timestamp,short:!0}]}]})})}catch(e){console.error("Failed to send monitoring webhook:",e)}"critical"===e.severity&&process.env.ALERT_EMAIL&&await this.sendEmailAlert(e)}async sendEmailAlert(e){console.error(`📧 CRITICAL PDF FAILURE - Email alert would be sent to ${process.env.ALERT_EMAIL}`)}getMetrics(){return{...this.metrics}}resetMetrics(){this.metrics={totalRequests:0,successfulRequests:0,failedRequests:0,successRate:0,averageResponseTime:0,methodBreakdown:{},qualityBreakdown:{},errorBreakdown:{}}}getHealthStatus(){let e=this.metrics.successRate,t=this.metrics.averageResponseTime,i="healthy",s=[];return e<80?(i="unhealthy",s.push(`Low success rate: ${e.toFixed(1)}%`)):e<95&&(i="degraded",s.push(`Degraded success rate: ${e.toFixed(1)}%`)),t>1e4&&(i="healthy"===i?"degraded":i,s.push(`Slow response time: ${t.toFixed(0)}ms`)),{status:i,issues:s,metrics:this.metrics,timestamp:new Date().toISOString()}}constructor(){this.failureThresholds={low:5,medium:10,high:20,critical:50},this.alertCooldowns=new Map,this.metrics={totalRequests:0,successfulRequests:0,failedRequests:0,successRate:0,averageResponseTime:0,methodBreakdown:{},qualityBreakdown:{},errorBreakdown:{}}}}let r=new n;async function o(){return r.getHealthStatus()}function a(){return r.getMetrics()}},45647:(e,t,i)=>{i.d(t,{CT:()=>l,Gg:()=>a,ed:()=>o});var s=i(9576);let n=new Map;function r(e=36e5){let t=Date.now();for(let[i,s]of n)t-s.createdAt>e&&n.delete(i)}function o(e,t,i,o){r();let a=(0,s.Z)(),l={id:a,version:c(e,t),createdAt:Date.now(),original:e,tailored:t,jdText:i,keywordStats:o};return n.set(a,l),l}function a(e){r();let t=n.get(e);return t?Date.now()-t.createdAt>36e5?(n.delete(e),null):t:null}function l(e,t){let i=n.get(e);if(!i)return null;let s={...i,...t};return(t.original||t.tailored)&&(s.version=c(s.original,s.tailored)),n.set(e,s),s}function c(e,t){let i=JSON.stringify({original:e,tailored:t});return Buffer.from(i,"utf8").toString("base64").slice(0,16)}},57033:(e,t,i)=>{i.d(t,{H:()=>u,Jf:()=>p,Ud:()=>d,db:()=>c,zJ:()=>m});var s=i(57147),n=i.n(s),r=i(9576);let o="/tmp/telemetry.jsonl",a=process.env.LOG_DRAIN_URL||"",l=process.env.LOG_DRAIN_KEY||"";function c(e={}){let t=(0,r.Z)(),i=Date.now();return{id:t,end:function(s,r={}){let a={req_id:t,route:e.route||"unknown",timing:Date.now()-i,timestamp:new Date().toISOString(),final_status:s?"success":"error",...e,...r};try{n().appendFileSync(o,JSON.stringify(a)+"\n")}catch(e){console.warn("Failed to write telemetry:",e)}return h(a),a}}}function d(e,t,i,s,r){let o={timestamp:new Date().toISOString(),type:"ai_response",attempt:e,success:t,error:i?.substring(0,500),responseLength:s,model:r||process.env.OPENAI_MODEL||"gpt-4o-mini"};try{n().appendFileSync("/tmp/ai-responses.jsonl",JSON.stringify(o)+"\n")}catch(e){console.warn("Failed to log AI response:",e)}h(o)}function u(e,t={}){let i={timestamp:new Date().toISOString(),type:"error",message:e.message,stack:e.stack,context:JSON.stringify(t)};try{n().appendFileSync("/tmp/error-log.jsonl",JSON.stringify(i)+"\n")}catch(e){console.warn("Failed to log error:",e)}h(i)}function m(e,t,i,s,r){let a={timestamp:new Date().toISOString(),type:"pdf_generation",attempt:e,success:t,error:i?.substring(0,500),method:s,size:r};try{n().appendFileSync(o,JSON.stringify(a)+"\n")}catch(e){console.warn("Failed to log PDF generation:",e)}h(a)}function p(e){let t={timestamp:new Date().toISOString(),type:"request_telemetry",...e};try{n().appendFileSync(o,JSON.stringify(t)+"\n")}catch(e){console.warn("Failed to log request telemetry:",e)}h(t)}async function h(e){if(a)try{await fetch(a,{method:"POST",headers:{"Content-Type":"application/json",...l?{Authorization:`Bearer ${l}`}:{}},body:JSON.stringify(e)})}catch{}}},9576:(e,t,i)=>{i.d(t,{Z:()=>c});var s=i(6113),n=i.n(s);let r={randomUUID:n().randomUUID},o=new Uint8Array(256),a=o.length,l=[];for(let e=0;e<256;++e)l.push((e+256).toString(16).slice(1));let c=function(e,t,i){if(r.randomUUID&&!t&&!e)return r.randomUUID();let s=(e=e||{}).random||(e.rng||function(){return a>o.length-16&&(n().randomFillSync(o),a=0),o.slice(a,a+=16)})();if(s[6]=15&s[6]|64,s[8]=63&s[8]|128,t){i=i||0;for(let e=0;e<16;++e)t[i+e]=s[e];return t}return function(e,t=0){return l[e[t+0]]+l[e[t+1]]+l[e[t+2]]+l[e[t+3]]+"-"+l[e[t+4]]+l[e[t+5]]+"-"+l[e[t+6]]+l[e[t+7]]+"-"+l[e[t+8]]+l[e[t+9]]+"-"+l[e[t+10]]+l[e[t+11]]+l[e[t+12]]+l[e[t+13]]+l[e[t+14]]+l[e[t+15]]}(s)}}};var t=require("../../../webpack-runtime.js");t.C(e);var i=e=>t(t.s=e),s=t.X(0,[948,972],()=>i(64086));module.exports=s})();