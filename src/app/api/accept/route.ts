// src/app/api/accept/route.ts
// GET /api/accept?token=<uuid>
// Student clicks their email link → records the click, marks accepted.

import { NextRequest } from "next/server";
import { getAcceptToken, markTokenClicked, getStudent, upsertStudent, addOutreachEntry } from "@/lib/db/store";

export const dynamic = "force-dynamic";

function htmlPage(title: string, body: string): Response {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;background:#f2f8f5;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
    .card{background:#fff;border-radius:16px;padding:40px;max-width:480px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.1);border-top:5px solid #0F603D}
    h1{color:#0F603D;font-size:24px;margin-bottom:12px}p{color:#374151;font-size:15px;line-height:1.6}
    .gold{color:#FFC522;font-size:48px;margin-bottom:16px}</style></head>
    <body><div class="card">${body}</div></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return htmlPage("Invalid Link", "<h1>Invalid Link</h1><p>No token provided.</p>");
  }

  const acceptToken = await getAcceptToken(token);
  if (!acceptToken || acceptToken.expired) {
    return htmlPage("Link Expired", "<h1>This link has expired</h1><p>Please contact your counselor for assistance.</p>");
  }

  if (acceptToken.clicked_at) {
    return htmlPage("Already Accepted", '<div class="gold">✅</div><h1>You already accepted</h1><p>No further action needed. If you have questions, contact your program coordinator.</p>');
  }

  // Mark token as clicked
  await markTokenClicked(token);

  // Update student record
  const now = new Date().toISOString();
  const program = acceptToken.program;
  const student = await getStudent(acceptToken.cwid);

  if (student) {
    (student as unknown as Record<string, unknown>)[`ep_${program}_email_clicked`] = now;
    (student as unknown as Record<string, unknown>)[`ep_${program}_accepted_date`] = now;
    (student as unknown as Record<string, unknown>)[`ep_${program}_outreach_status`] = "not_needed";
    await upsertStudent(student);
  }

  // Log the acceptance
  await addOutreachEntry({
    cwid:       acceptToken.cwid,
    program,
    action:     "accepted",
    timestamp:  now,
    details:    `Student clicked accept link for ${program.toUpperCase()}`,
    staff_name: null,
  });

  const programName = program.toUpperCase();
  const studentName = student ? `${student.first_name} ${student.last_name}` : "Student";
  return htmlPage(
    "Confirmed!",
    `<div class="gold">🎉</div>
     <h1>${studentName}, you're confirmed for ${programName}!</h1>
     <p>A confirmation email has been sent to your GWC student email. The ${programName} office will be in touch with next steps and orientation details.</p>
     <p style="margin-top:16px;font-size:13px;color:#6b7280;">You can close this page.</p>
     <canvas id="confetti" style="position:fixed;inset:0;pointer-events:none;z-index:99;"></canvas>
     <script>
     (function(){
       var c=document.getElementById("confetti"),ctx=c.getContext("2d");
       c.width=window.innerWidth;c.height=window.innerHeight;
       var colors=["#0F603D","#FFC522","#34d399","#f472b6","#60a5fa","#BADB3E"];
       var pieces=[];
       for(var i=0;i<200;i++){
         pieces.push({x:Math.random()*c.width,y:Math.random()*c.height*0.3-50,w:7+Math.random()*7,h:4+Math.random()*5,
           color:colors[Math.floor(Math.random()*colors.length)],vx:(Math.random()-0.5)*8,vy:2+Math.random()*5,
           angle:Math.random()*Math.PI*2,spin:(Math.random()-0.5)*0.3,opacity:1,gravity:0.12,decay:0.995});
       }
       function draw(){
         ctx.clearRect(0,0,c.width,c.height);
         pieces=pieces.filter(function(p){return p.opacity>0.05;});
         pieces.forEach(function(p){
           p.vy+=p.gravity;p.vx*=p.decay;p.x+=p.vx;p.y+=p.vy;p.angle+=p.spin;p.opacity*=0.993;
           ctx.save();ctx.globalAlpha=p.opacity;ctx.translate(p.x,p.y);ctx.rotate(p.angle);
           ctx.fillStyle=p.color;ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);ctx.restore();
         });
         if(pieces.length>0)requestAnimationFrame(draw);
       }
       draw();
     })();
     </script>`
  );
}
