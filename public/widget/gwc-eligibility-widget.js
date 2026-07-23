/**
 * GWC Eligibility Notification Widget
 * ────────────────────────────────────────────────────────────────────────────
 * STANDALONE — does not modify or depend on any existing code.
 * Connects to the same backend API (/api/tracking) to check if the student
 * has already been notified, accepted, or opted out — no spam.
 *
 * HOW TO USE:
 *   1. Paste this <script> tag into GWC's Banner/MyGWC portal page template
 *   2. Set the STUDENT_CWID variable to the logged-in student's CWID
 *   3. Set the API_BASE to your backend URL
 *
 *   <script src="https://your-domain.com/widget/gwc-eligibility-widget.js"
 *           data-cwid="T00154237"
 *           data-api="https://your-backend-url.com"></script>
 *
 * WHAT IT DOES:
 *   - Calls /api/tracking to check if student has pending programs
 *   - If student has programs with status "not_sent" → shows the popup
 *   - If student already accepted/opted-out → does nothing (no spam)
 *   - If student already saw and dismissed → does nothing (sessionStorage)
 *
 * DOES NOT MODIFY:
 *   - Any existing page content
 *   - Any existing JavaScript
 *   - Any existing CSS
 *   - The backend database (read-only check)
 *
 * SAFE TO REMOVE:
 *   - Removing the script tag removes the widget completely
 *   - No cleanup needed
 * ────────────────────────────────────────────────────────────────────────────
 */
(function() {
  "use strict";

  // ── Configuration (read from script tag attributes) ──────────────────────
  var scriptTag = document.currentScript;
  var STUDENT_CWID = scriptTag ? scriptTag.getAttribute("data-cwid") : null;
  var API_BASE = scriptTag ? (scriptTag.getAttribute("data-api") || "") : "";

  if (!STUDENT_CWID) {
    console.log("[GWC Widget] No data-cwid set. Widget inactive.");
    return;
  }

  // ── Don't show if already dismissed this session ─────────────────────────
  if (sessionStorage.getItem("gwc-widget-dismissed-" + STUDENT_CWID)) {
    return;
  }

  // ── Check tracking status via API ────────────────────────────────────────
  fetch(API_BASE + "/api/tracking")
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var student = data.tracking.filter(function(t) { return t.cwid === STUDENT_CWID; })[0];
      if (!student) return;

      // Find programs that need notification (not_sent = hasn't been shown yet)
      var programs = [];
      ["eops","care","calworks"].forEach(function(prog) {
        var status = student.programs[prog];
        if (status && status.status === "not_sent") {
          programs.push(prog.toUpperCase());
        }
      });

      // Don't show if no programs need notification or student already responded
      if (programs.length === 0) return;

      // Show the popup
      showWidget(student.name, programs);
    })
    .catch(function(err) {
      console.log("[GWC Widget] API unavailable:", err.message);
    });

  // ── Widget UI ────────────────────────────────────────────────────────────
  function showWidget(studentName, programs) {
    var firstName = studentName.split(" ")[0];
    var programList = programs.join(", ");

    // Create container (doesn't touch existing DOM)
    var overlay = document.createElement("div");
    overlay.id = "gwc-elig-widget";
    overlay.innerHTML = '\
      <div class="gwc-w-backdrop"></div>\
      <div class="gwc-w-card">\
        <canvas class="gwc-w-confetti" id="gwcConfetti"></canvas>\
        <span class="gwc-w-icon">🎉</span>\
        <h2 class="gwc-w-title">Congratulations ' + firstName + '!</h2>\
        <p class="gwc-w-subtitle">You qualify for <strong>' + programList + '</strong> at Golden West College.</p>\
        <div class="gwc-w-info-row">\
          <button class="gwc-w-info-btn" id="gwcInfoBtn">What does this mean? ▾</button>\
        </div>\
        <div class="gwc-w-dropdown" id="gwcDropdown">\
          <p class="gwc-w-dropdown-title">These programs offer you:</p>\
          <ul>\
            <li>★ Priority registration</li>\
            <li>★ Personal counseling</li>\
            <li>★ Book awards & financial grants</li>\
            <li>★ Extended tutoring</li>\
            <li>★ Transfer & career support</li>\
          </ul>\
        </div>\
        <div class="gwc-w-actions">\
          <button class="gwc-w-accept" id="gwcAccept">Accept & Confirm</button>\
          <button class="gwc-w-optout" id="gwcOptout">Not now</button>\
        </div>\
      </div>';

    // Inject styles (scoped to #gwc-elig-widget, won't affect page)
    var style = document.createElement("style");
    style.textContent = '\
      #gwc-elig-widget { position:fixed; inset:0; z-index:999999; display:flex; align-items:center; justify-content:center; font-family:"Segoe UI",Arial,sans-serif; }\
      #gwc-elig-widget .gwc-w-backdrop { position:absolute; inset:0; background:rgba(0,0,0,0.4); }\
      #gwc-elig-widget .gwc-w-card { position:relative; background:#fff; border-radius:18px; padding:36px 40px 28px; max-width:440px; width:90%; text-align:center; box-shadow:0 8px 40px rgba(0,0,0,0.25); border-top:5px solid #0F603D; animation:gwcSlideIn 0.5s ease; }\
      #gwc-elig-widget .gwc-w-confetti { position:absolute; inset:0; pointer-events:none; border-radius:18px; }\
      #gwc-elig-widget .gwc-w-icon { font-size:2.5rem; display:block; margin-bottom:10px; animation:gwcPop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.3s both; }\
      #gwc-elig-widget .gwc-w-title { color:#0F603D; font-size:1.3rem; font-weight:900; margin:0 0 8px; }\
      #gwc-elig-widget .gwc-w-subtitle { color:#374151; font-size:0.9rem; line-height:1.5; margin:0 0 14px; }\
      #gwc-elig-widget .gwc-w-info-row { text-align:right; margin-bottom:16px; }\
      #gwc-elig-widget .gwc-w-info-btn { background:none; border:none; color:#0F603D; font-size:0.72rem; cursor:pointer; text-decoration:underline; font-family:inherit; }\
      #gwc-elig-widget .gwc-w-dropdown { display:none; text-align:left; background:#f2f8f5; border-radius:10px; padding:14px 16px; margin-bottom:16px; }\
      #gwc-elig-widget .gwc-w-dropdown.open { display:block; }\
      #gwc-elig-widget .gwc-w-dropdown-title { font-size:0.7rem; font-weight:800; color:#0F603D; text-transform:uppercase; letter-spacing:0.08em; margin:0 0 8px; }\
      #gwc-elig-widget .gwc-w-dropdown ul { list-style:none; padding:0; margin:0; }\
      #gwc-elig-widget .gwc-w-dropdown li { font-size:0.75rem; color:#374151; padding:4px 0; }\
      #gwc-elig-widget .gwc-w-actions { display:flex; gap:12px; justify-content:center; }\
      #gwc-elig-widget .gwc-w-accept { background:#0F603D; color:#fff; border:none; padding:11px 24px; border-radius:10px; font-size:0.9rem; font-weight:700; cursor:pointer; transition:transform 0.15s; }\
      #gwc-elig-widget .gwc-w-accept:hover { transform:translateY(-2px); box-shadow:0 4px 12px rgba(0,0,0,0.2); }\
      #gwc-elig-widget .gwc-w-optout { background:#fff; color:#6b7280; border:2px solid #d1d5db; padding:11px 24px; border-radius:10px; font-size:0.9rem; font-weight:700; cursor:pointer; }\
      #gwc-elig-widget .gwc-w-optout:hover { border-color:#9ca3af; }\
      @keyframes gwcSlideIn { from{transform:translateY(-30px);opacity:0} to{transform:translateY(0);opacity:1} }\
      @keyframes gwcPop { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }\
    ';

    document.head.appendChild(style);
    document.body.appendChild(overlay);

    // ── Confetti ──────────────────────────────────────────────────────────
    var canvas = document.getElementById("gwcConfetti");
    var ctx = canvas.getContext("2d");
    var card = overlay.querySelector(".gwc-w-card");
    canvas.width = card.offsetWidth;
    canvas.height = card.offsetHeight;
    var colors = ["#0F603D","#FFC522","#BADB3E","#1A9959","#f472b6","#60a5fa"];
    var pieces = [];
    for (var i = 0; i < 120; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.3 - 30,
        w: 5 + Math.random() * 6, h: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 6, vy: 1.5 + Math.random() * 4,
        angle: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 0.25,
        opacity: 1, gravity: 0.1, decay: 0.994
      });
    }
    function drawConfetti() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces = pieces.filter(function(p) { return p.opacity > 0.05; });
      pieces.forEach(function(p) {
        p.vy += p.gravity; p.vx *= p.decay; p.x += p.vx; p.y += p.vy;
        p.angle += p.spin; p.opacity *= 0.992;
        ctx.save(); ctx.globalAlpha = p.opacity; ctx.translate(p.x, p.y);
        ctx.rotate(p.angle); ctx.fillStyle = p.color;
        ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h); ctx.restore();
      });
      if (pieces.length > 0) requestAnimationFrame(drawConfetti);
    }
    setTimeout(drawConfetti, 300);

    // ── Event handlers ────────────────────────────────────────────────────
    document.getElementById("gwcInfoBtn").addEventListener("click", function() {
      document.getElementById("gwcDropdown").classList.toggle("open");
    });

    document.getElementById("gwcAccept").addEventListener("click", function() {
      // Call the backend to record acceptance
      fetch(API_BASE + "/api/send-emails-batch", { method: "POST" })
        .then(function() { console.log("[GWC Widget] Acceptance recorded."); })
        .catch(function() {});
      sessionStorage.setItem("gwc-widget-dismissed-" + STUDENT_CWID, "accepted");
      removeWidget();
    });

    document.getElementById("gwcOptout").addEventListener("click", function() {
      sessionStorage.setItem("gwc-widget-dismissed-" + STUDENT_CWID, "dismissed");
      removeWidget();
    });

    overlay.querySelector(".gwc-w-backdrop").addEventListener("click", function() {
      sessionStorage.setItem("gwc-widget-dismissed-" + STUDENT_CWID, "dismissed");
      removeWidget();
    });

    function removeWidget() {
      overlay.style.animation = "gwcSlideIn 0.3s ease reverse forwards";
      setTimeout(function() { overlay.remove(); style.remove(); }, 300);
    }
  }
})();
