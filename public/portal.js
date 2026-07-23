/* ============================================================================
   Taft College Student Portal — Extension Logic  (data/portal.js)
   ----------------------------------------------------------------------------
   ADDITIVE layer that runs AFTER index.js. It reads the mock database from
   window.TAFT (data/students.js) and powers:

     Feature 1  Slide-in qualification notification + confetti + bell restore
     Feature 2  Enhanced Program Match modal (per-program detail + accordion)
     Feature 3  Accept / Maybe Later / Decline decisions + /txt file download
     Feature 4  Administrator Dashboard with live student switching
     Feature 8  Priority ranking display
     Feature 10 Readable FAFSA / Banner / Qualification documents in modals
     Feature 11 Admin analytics cards + CSS bar chart

   It does NOT remove existing behavior: the original bell panel, To-Do list,
   status bar and eligibility modal shell all keep working. Where index.js and
   this file both target the same control, we swap the control's listeners by
   cloning the node so only the student-aware handler runs.
   ========================================================================== */
(function () {
  "use strict";

  var T = window.TAFT;
  if (!T) { console.error("TAFT data not loaded"); return; }

  /* ---- session state --------------------------------------------------- */
  var state = {
    currentId: "stu1",     // default "logged-in" student (Maria Delgado)
    confettiShown: false,
    adminOpen: false
  };

  function current() { return T.STUDENTS_BY_ID[state.currentId]; }

  /* ---- tiny DOM helpers ------------------------------------------------ */
  function $(id) { return document.getElementById(id); }
  function firstName(s) { return s.name.split(" ")[0]; }

  // Replace a node's event listeners by cloning it (drops index.js handlers).
  function reset(node) {
    var clone = node.cloneNode(true);
    node.parentNode.replaceChild(clone, node);
    return clone;
  }

  // Trigger a client-side file download (mock /txt + document exports).
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function esc(str) {
    return String(str).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ======================================================================
     STUDENT HOME VIEW  (counts, avatar, greeting, context bar)
     ====================================================================== */
  function renderStudentHome() {
    var s = current();
    var m = s.matches;

    // Program Matches summary card counts
    if ($("qualifiedCount")) $("qualifiedCount").textContent = m.qualified.length;
    if ($("almostCount")) $("almostCount").textContent = m.almost.length;
    if ($("notCount")) $("notCount").textContent = m.not.length;

    // Header avatar initial
    var avatar = document.querySelector(".avatar");
    if (avatar) avatar.textContent = s.name[0];

    // Modal greeting
    var h2 = document.querySelector("#eligModal .modal-head h2");
    var p = document.querySelector("#eligModal .modal-head p");
    if (h2) h2.textContent = "Congratulations, " + firstName(s) + "!";
    if (p) p.textContent = "Based on the information Taft College already has on file, here's where you stand.";

    // Context bar (shown while Admin View is active)
    var bar = $("studentContextBar");
    if (bar) {
      bar.innerHTML =
        '<span class="scb-chip">Previewing: ' + esc(s.name) + '</span>' +
        '<span class="scb-chip">Priority Level ' + s.priority.level +
          ' <span class="sub">(rank #' + s.priority.rank + ' of ' + T.STUDENTS.length + ')</span></span>' +
        '<span class="scb-chip">SAI ' + s.fafsa.sai + '</span>' +
        '<span class="scb-chip">' + m.qualified.length + ' qualified programs</span>';
    }
  }

  /* ======================================================================
     FEATURE 2 + 3 — ENHANCED PROGRAM MATCH MODAL
     ====================================================================== */
  function statusLabel(status) {
    return status === "qualified" ? "Qualified"
         : status === "almost" ? "Almost There"
         : "Not Yet Eligible";
  }

  function progCardHtml(p) {
    // Meta grid (funding, deadline, counseling, benefits, process)
    var meta =
      '<div class="prog-meta">' +
        metaItem("Estimated funding", p.funding) +
        metaItem("Deadline", p.deadline) +
        metaItem("Counseling services", p.counseling) +
        metaItem("Academic benefits", p.academic) +
        metaItem("Career benefits", p.career) +
        metaItem("How to apply", p.process) +
      '</div>';

    // Requirements satisfied / missing / reason
    var reqs = "";
    if (p.satisfied && p.satisfied.length) {
      reqs += '<ul class="prog-satisfied">';
      p.satisfied.forEach(function (r) { reqs += "<li>&#10003; " + esc(r) + "</li>"; });
      reqs += "</ul>";
    }
    if (p.status === "almost" && p.missing) {
      reqs += '<div class="prog-missing">Still needed: ' + esc(p.missing) + "</div>";
    }
    if (p.status === "not" && p.reason) {
      reqs += '<div class="prog-reason">' + esc(p.reason) + "</div>";
    }

    // "What is this?" accordion
    var accordion =
      '<button class="whatis-toggle" data-whatis="' + p.id + '">' +
        '<span class="chev">&#9656;</span> What is this program?</button>' +
      '<div class="whatis-panel" data-panel="' + p.id + '">' +
        '<div class="whatis-inner">' + esc(p.about) + "</div></div>";

    // Decision actions (Feature 3) — only for qualified/almost programs
    var actions = "";
    if (p.decision) {
      var tagClass = p.decision === "accepted" ? "accepted"
                    : p.decision === "maybe" ? "maybe" : "declined";
      var tagText = p.decision === "accepted" ? "\u2713 Accepted — a team w will reach out."
                    : p.decision === "maybe" ? "Marked \u201CMaybe Later.\u201D"
                    : "Declined for now.";
      actions = '<div class="decision-tag ' + tagClass + '">' + tagText +
                '<button class="decision-reset" data-reset="' + p.id + '">change</button></div>';
    } else if (p.status === "qualified" || p.status === "almost") {
      actions =
        '<div class="prog-actions">' +
          '<button class="btn-accept" data-decide="accepted" data-id="' + p.id + '">Accept</button>' +
          '<button class="btn-maybe" data-decide="maybe" data-id="' + p.id + '">Maybe Later</button>' +
          '<button class="btn-decline" data-decide="declined" data-id="' + p.id + '">Decline</button>' +
        '</div>';
    }

    return (
      '<div class="prog-card" data-card="' + p.id + '">' +
        '<div class="prog-card-top">' +
          '<div class="prog-name">' + esc(p.name) + "</div>" +
          '<span class="status-pill ' + p.status + '">' + statusLabel(p.status) + "</span>" +
        "</div>" +
        meta +
        reqs +
        accordion +
        actions +
      "</div>"
    );
  }

  function metaItem(label, value) {
    return '<div class="m-item"><span class="m-label">' + esc(label) +
           '</span><span class="m-value">' + esc(value) + "</span></div>";
  }

  function renderMatchModal() {
    var s = current();
    var m = s.matches;
    var body = $("eligModalBody");
    if (!body) return;

    var html = "";
    html += '<div class="modal-section-title qualified">You currently qualify for <span class="count-pill">' + m.qualified.length + "</span></div>";
    if (m.qualified.length) m.qualified.forEach(function (p) { html += progCardHtml(p); });
    else html += '<div class="prog-reason">No current qualifications on file.</div>';

    html += '<div class="modal-section-title almost">You almost qualify for <span class="count-pill">' + m.almost.length + "</span></div>";
    if (m.almost.length) m.almost.forEach(function (p) { html += progCardHtml(p); });
    else html += '<div class="prog-reason">Nothing pending right now — check back after your next document upload.</div>';

    html += '<div class="modal-section-title not">Not yet eligible <span class="count-pill">' + m.not.length + "</span></div>";
    m.not.forEach(function (p) { html += progCardHtml(p); });

    body.innerHTML = html;
  }

  function openMatchModal() {
    renderMatchModal();
    $("eligModal").classList.add("open");
    // mark eligibility notification read + drop badge (mirrors index.js intent)
    var item = $("notifEligibility");
    if (item) item.classList.add("read");
    var badge = $("notifBadge");
    if (badge) {
      var c = Math.max(0, parseInt(badge.textContent || "0", 10) - 1);
      if (c > 0) { badge.textContent = c; } else { badge.style.display = "none"; }
    }
    var panel = $("notifPanel");
    if (panel) panel.classList.remove("open");
  }

  // Delegated clicks inside the modal body: accordion, decisions, reset.
  function wireModalDelegation() {
    var body = $("eligModalBody");
    if (!body) return;
    body.addEventListener("click", function (e) {
      var t = e.target.closest("button");
      if (!t) return;

      if (t.hasAttribute("data-whatis")) {
        var id = t.getAttribute("data-whatis");
        var panel = body.querySelector('[data-panel="' + id + '"]');
        t.classList.toggle("open");
        if (panel.style.maxHeight && panel.style.maxHeight !== "0px") {
          panel.style.maxHeight = "0px";
        } else {
          panel.style.maxHeight = panel.scrollHeight + 40 + "px";
        }
        return;
      }

      if (t.hasAttribute("data-decide")) {
        setDecision(t.getAttribute("data-id"), t.getAttribute("data-decide"));
        return;
      }
      if (t.hasAttribute("data-reset")) {
        var pid = t.getAttribute("data-reset");
        delete current().decisions[pid];
        current().matches = T.matchPrograms(current());
        renderMatchModal();
        return;
      }
    });
  }

  /* ---- Feature 3: record decision + generate mock /txt file ------------ */
  var REASONS = {
    accepted: "Student opted in and requested advisor contact.",
    maybe: "Student deferred the decision to review later.",
    declined: "Student declined participation at this time."
  };

  function setDecision(progId, decision) {
    var s = current();
    s.decisions[progId] = decision;
    s.matches = T.matchPrograms(s);   // refresh view-models with decision
    renderMatchModal();

    // Generate demonstration text file into the browser's download folder.
    var prog = T.PROGRAMS_BY_ID[progId];
    var txt = decisionFileText(s, prog, decision);
    var fname = "decision_" + s.banner.studentId + "_" + progId + ".txt";
    download(fname, txt);

    // keep analytics live if admin dashboard is open
    if (state.adminOpen) { renderAnalytics(); }
  }

  function decisionFileText(s, prog, decision) {
    return [
      "TAFT COLLEGE — PROGRAM DECISION RECORD (DEMONSTRATION DATA)",
      "==========================================================",
      "Student Name : " + s.name,
      "Student ID   : " + s.banner.studentId,
      "Program      : " + prog.name,
      "Decision     : " + decision.toUpperCase(),
      "Date         : " + T.todayStr(),
      "Reason       : " + REASONS[decision],
      "",
      "This record was generated by the Golden West College Student Portal simulation.",
      "It does not represent a real enrollment action."
    ].join("\n");
  }

  /* ======================================================================
     FEATURE 1 — SLIDE-IN NOTIFICATION + CONFETTI + BELL RESTORE
     ====================================================================== */
  var toastEl = null;
  var bellCount = 0;
  function buildToast() {
    toastEl = document.createElement("div");
    toastEl.className = "qual-toast";
    toastEl.id = "qualToast";
    toastEl.innerHTML =
      '<button class="qt-close" id="qtClose" aria-label="Close">&times;</button>' +
      '<div class="qt-emoji">&#127881;</div>' +
      '<div class="qt-title">Congratulations!</div>' +
      '<div class="qt-body">You qualify for multiple student success programs. ' +
        "Review your opportunities now.</div>" +
      '<span class="qt-cta">Review my programs &#8594;</span>';
    document.body.appendChild(toastEl);

    // Clicking the toast opens the match modal
    toastEl.addEventListener("click", function (e) {
      if (e.target.id === "qtClose") return;
      openMatchModal();
      hideToast();
    });
    $("qtClose").addEventListener("click", function (e) {
      e.stopPropagation();
      hideToast();  // minimize into the bell (notification stays in panel)
    });
  }

  function showToast() {
    if (!toastEl) buildToast();
    requestAnimationFrame(function () {
      toastEl.classList.remove("hide");
      toastEl.classList.add("show");
    });
    // Confetti only the FIRST time the notification appears
    if (!state.confettiShown) {
      fireConfetti();
      state.confettiShown = true;
    }
  }

  function hideToast() {
    if (!toastEl) return;
    toastEl.classList.remove("show");
    toastEl.classList.add("hide");
  }

  function fireConfetti() {
    var layer = document.createElement("div");
    layer.className = "confetti-layer";
    document.body.appendChild(layer);
    var colors = ["#f0b429", "#4b2e83", "#7a1f2b", "#1e8e3e", "#0b57d0", "#d99e1f"];
    var count = 90;
    for (var i = 0; i < count; i++) {
      var piece = document.createElement("div");
      piece.className = "confetti-piece";
      piece.style.left = Math.random() * 100 + "vw";
      piece.style.background = colors[i % colors.length];
      var dur = 2.4 + Math.random() * 1.8;
      piece.style.animationDuration = dur + "s";
      piece.style.animationDelay = Math.random() * 0.6 + "s";
      piece.style.transform = "rotateZ(" + Math.random() * 360 + "deg)";
      if (i % 3 === 0) piece.style.borderRadius = "50%";
      layer.appendChild(piece);
    }
    setTimeout(function () { layer.remove(); }, 5200);
  }

  /* ======================================================================
     FEATURE 4 + 8 + 11 — ADMINISTRATOR DASHBOARD
     ====================================================================== */
  function buildStudentSelect() {
    var sel = $("studentSelect");
    if (!sel) return;
    var ranked = T.rankStudents(T.STUDENTS.slice());
    // options in priority order for convenience
    sel.innerHTML = ranked.map(function (r) {
      var s = r.student;
      return '<option value="' + s.id + '">' + esc(s.name) +
             "  —  " + esc(s.major) + "  (P" + s.priority.level + ")</option>";
    }).join("");
    sel.value = state.currentId;
    sel.addEventListener("change", function () {
      state.currentId = sel.value;
      renderStudentHome();
      if ($("eligModal").classList.contains("open")) renderMatchModal();
      renderRoster();      // re-highlight selected row
    });
  }

  function toggleAdmin() {
    state.adminOpen = !state.adminOpen;
    var panel = $("adminPanel");
    var btn = $("adminToggle");
    var bar = $("studentContextBar");
    var main = document.querySelector("main");
    if (state.adminOpen) {
      panel.classList.add("open");
      btn.classList.add("active");
      btn.innerHTML = "&#128100; Exit Admin";
      bar.classList.add("show");
      if (main) main.style.display = "none";       // focus the dashboard
      renderAnalytics();
      renderProgramChart();
      renderRoster();
    } else {
      panel.classList.remove("open");
      btn.classList.remove("active");
      btn.innerHTML = "&#128100; Admin View";
      bar.classList.remove("show");
      if (main) main.style.display = "";
    }
  }

  /* ---- Feature 11: analytics metric cards ------------------------------ */
  function computeAnalytics() {
    var all = T.STUDENTS;
    var qualified = 0, accepted = 0, declined = 0, pending = 0;
    var gpaSum = 0, saiSum = 0;
    var progCounts = {}, totalDecisions = 0, acceptDecisions = 0;

    all.forEach(function (s) {
      gpaSum += s.gpa; saiSum += s.fafsa.sai;
      var hasQual = s.matches.qualified.length > 0;
      if (hasQual) qualified++;
      var decisions = Object.keys(s.decisions);
      var hasAccept = decisions.some(function (k) { return s.decisions[k] === "accepted"; });
      var hasDecline = decisions.some(function (k) { return s.decisions[k] === "declined"; });
      if (hasAccept) accepted++;
      if (hasDecline) declined++;
      if (hasQual && decisions.length === 0) pending++;
      decisions.forEach(function (k) {
        totalDecisions++;
        if (s.decisions[k] === "accepted") acceptDecisions++;
      });
      s.matches.qualified.forEach(function (p) {
        progCounts[p.shortName] = (progCounts[p.shortName] || 0) + 1;
      });
    });

    var ranked = T.rankStudents(all.slice());
    var popular = Object.keys(progCounts).sort(function (a, b) {
      return progCounts[b] - progCounts[a];
    })[0] || "—";

    return {
      total: all.length,
      qualified: qualified,
      pending: pending,
      accepted: accepted,
      declined: declined,
      avgGpa: (gpaSum / all.length).toFixed(2),
      avgSai: Math.round(saiSum / all.length),
      highest: ranked[0].student.name,
      lowest: ranked[ranked.length - 1].student.name,
      popular: popular,
      acceptRate: totalDecisions ? Math.round((acceptDecisions / totalDecisions) * 100) + "%" : "—",
      progCounts: progCounts
    };
  }

  function renderAnalytics() {
    var a = computeAnalytics();
    var cards = [
      { label: "Total Students", value: a.total },
      { label: "Qualified Students", value: a.qualified, foot: a.pending + " pending decision" },
      { label: "Accepted", value: a.accepted },
      { label: "Declined", value: a.declined },
      { label: "Average GPA", value: a.avgGpa },
      { label: "Average SAI", value: a.avgSai },
      { label: "Highest Priority", value: a.highest, small: true },
      { label: "Lowest Priority", value: a.lowest, small: true },
      { label: "Most Popular Program", value: a.popular, small: true },
      { label: "Program Acceptance Rate", value: a.acceptRate }
    ];
    $("analyticsGrid").innerHTML = cards.map(function (c) {
      var val = '<div class="m-value"' + (c.small ? ' style="font-size:18px;"' : "") + ">" + esc(c.value) + "</div>";
      return '<div class="metric-card">' + val +
             '<div class="m-label">' + esc(c.label) + "</div>" +
             (c.foot ? '<div class="m-foot">' + esc(c.foot) + "</div>" : "") + "</div>";
    }).join("");
  }

  /* ---- Feature 11: program qualification bar chart --------------------- */
  function renderProgramChart() {
    var a = computeAnalytics();
    var total = T.STUDENTS.length;
    var rows = T.PROGRAMS.map(function (p) {
      var count = a.progCounts[p.shortName] || 0;
      var pct = Math.round((count / total) * 100);
      return '<div class="bar-row">' +
               '<div class="bar-label">' + esc(p.shortName) + "</div>" +
               '<div class="bar-track"><div class="bar-fill" data-pct="' + pct + '">' + pct + "%</div></div>" +
               '<div class="bar-count">' + count + "</div>" +
             "</div>";
    }).join("");
    $("programChart").innerHTML = rows;
    // animate widths after paint
    requestAnimationFrame(function () {
      document.querySelectorAll("#programChart .bar-fill").forEach(function (el) {
        el.style.width = el.getAttribute("data-pct") + "%";
      });
    });
  }

  /* ---- Feature 8: priority-ranked roster ------------------------------- */
  function renderRoster() {
    var ranked = T.rankStudents(T.STUDENTS.slice());
    var body = $("rosterBody");
    if (!body) return;
    body.innerHTML = ranked.map(function (r) {
      var s = r.student;
      var chips = r.reasons.slice(0, 4).map(function (x) {
        return '<span class="p-chip">' + esc(x) + "</span>";
      }).join("");
      var note = r.note ? '<div class="prog-reason">' + esc(r.note) + "</div>" : "";
      var sel = s.id === state.currentId ? ' style="background:#f3ecff;"' : "";
      return "<tr" + sel + ">" +
        '<td><span class="plevel l' + r.level + '">P' + r.level + "</span> #" + (ranked.indexOf(r) + 1) + "</td>" +
        "<td><b>" + esc(s.name) + "</b></td>" +
        "<td>" + esc(s.banner.studentId) + "</td>" +
        "<td>" + esc(s.major) + "</td>" +
        "<td>" + s.fafsa.sai + "</td>" +
        "<td>" + s.gpa.toFixed(2) + "</td>" +
        '<td><div class="p-reasons">' + chips + "</div>" + note + "</td>" +
        '<td class="row-actions">' +
          '<button data-doc="fafsa" data-sid="' + s.id + '">FAFSA</button>' +
          '<button class="ghost" data-doc="banner" data-sid="' + s.id + '">Banner</button>' +
          '<button class="ghost" data-doc="qual" data-sid="' + s.id + '">Match</button>' +
        "</td>" +
      "</tr>";
    }).join("");

    // wire preview + document buttons (delegation)
    body.onclick = function (e) {
      var b = e.target.closest("button");
      if (b && b.hasAttribute("data-doc")) {
        openDoc(b.getAttribute("data-doc"), b.getAttribute("data-sid"));
        return;
      }
      var tr = e.target.closest("tr");
      if (tr) {
        var name = tr.querySelector("td:nth-child(2) b");
        if (name) {
          // find student by name and preview
          var match = T.STUDENTS.filter(function (s) { return s.name === name.textContent; })[0];
          if (match) {
            state.currentId = match.id;
            $("studentSelect").value = match.id;
            renderStudentHome();
            renderRoster();
          }
        }
      }
    };
  }

  /* ======================================================================
     FEATURE 10 — READABLE DOCUMENTS (FAFSA / Banner / Qualification)
     ====================================================================== */
  function letterhead(subtitle) {
    return '<div class="doc-letterhead">' +
      '<div class="doc-seal">TC</div>' +
      '<div><div class="doc-org">Taft College<small>' + esc(subtitle) + "</small></div></div></div>";
  }
  function docRow(label, value) {
    return '<div class="dg-row"><span>' + esc(label) + "</span><span>" + esc(value) + "</span></div>";
  }

  function fafsaDocHtml(s) {
    var f = s.fafsa;
    var pell = f.pellEligible ? "Eligible" : "Not eligible";
    var stamp = f.pellEligible
      ? '<div class="doc-stamp">PELL ELIGIBLE</div>'
      : '<div class="doc-stamp pending">REVIEW REQUIRED</div>';
    return letterhead("Office of Financial Aid — 2026–27 FAFSA Summary") +
      '<h2 class="doc-h">Student Aid Report (SAR) — Summary</h2>' +
      '<div class="doc-grid">' +
        docRow("Student Name", f.studentName) +
        docRow("Student ID", f.studentId) +
        docRow("FSA ID", f.fafsaId) +
        docRow("Student Aid Index (SAI)", f.sai) +
        docRow("Household Size", f.householdSize) +
        docRow("Parent Income", "$" + T.fmtMoney(f.parentIncome)) +
        docRow("Student Income", "$" + T.fmtMoney(f.studentIncome)) +
        docRow("Dependency Status", f.dependency) +
        docRow("Verification Status", f.verification) +
        docRow("Pell Grant", pell) +
        docRow("Expected Family Contribution", f.pellEligible ? "N/A (Pell)" : "$" + T.fmtMoney(f.efc)) +
      "</div>" + stamp +
      '<div class="doc-note">Fictional demonstration record generated by the Taft College Portal simulation. ' +
      "Not an official Student Aid Report.</div>";
  }

  function bannerDocHtml(s) {
    var b = s.banner;
    return letterhead("Banner Student Information System — Academic Record") +
      '<h2 class="doc-h">Banner Academic Summary</h2>' +
      '<div class="doc-grid">' +
        docRow("Student ID", b.studentId) +
        docRow("Major / Program", b.major) +
        docRow("Academic Standing", b.academicStanding) +
        docRow("Current Units", b.currentUnits) +
        docRow("Completed Units", b.completedUnits) +
        docRow("Advisor", b.advisor) +
        docRow("Registration Status", b.registrationStatus) +
        docRow("Residency", b.residency) +
        docRow("Degree Objective", b.degreeObjective) +
        docRow("Expected Graduation", b.expectedGraduation) +
        docRow("Active Holds", b.holds.length ? b.holds.join(", ") : "None") +
      "</div>" +
      '<div class="doc-note">Fictional demonstration record. Not an official Banner transcript.</div>';
  }

  function qualDocHtml(s) {
    var m = s.matches;
    function block(title, list, kind) {
      if (!list.length) return "";
      var items = list.map(function (p) {
        var extra = kind === "almost" && p.missing ? " — Needed: " + p.missing
                  : kind === "not" && p.reason ? " — " + p.reason : "";
        var dec = p.decision ? "  [" + p.decision.toUpperCase() + "]" : "";
        return "<li><b>" + esc(p.name) + "</b> — " + esc(p.funding) + esc(extra) + esc(dec) + "</li>";
      }).join("");
      return '<h2 class="doc-h">' + esc(title) + "</h2><ul>" + items + "</ul>";
    }
    return letterhead("Student Success — Program Qualification Summary") +
      '<div class="doc-grid">' +
        docRow("Student Name", s.name) +
        docRow("Student ID", s.banner.studentId) +
        docRow("Priority Level", "Level " + s.priority.level + " (rank #" + s.priority.rank + ")") +
        docRow("Priority Score", s.priority.score) +
        docRow("SAI", s.fafsa.sai) +
      "</div>" +
      block("Qualified Programs", m.qualified, "qualified") +
      block("Almost Qualified", m.almost, "almost") +
      block("Not Yet Eligible", m.not, "not") +
      '<h2 class="doc-h">Why This Priority Ranking</h2><p>' + esc(s.priority.reasons.join("; ")) +
        (s.priority.note ? " " + esc(s.priority.note) : "") + "</p>" +
      '<div class="doc-note">Fictional demonstration record generated by the Taft College Portal simulation.</div>';
  }

  var docState = { title: "", plain: "", file: "document.txt" };

  function openDoc(type, sid) {
    var s = T.STUDENTS_BY_ID[sid];
    if (!s) return;
    var html, title, file;
    if (type === "fafsa") { html = fafsaDocHtml(s); title = "FAFSA Summary — " + s.name; file = "FAFSA_" + s.banner.studentId + ".txt"; }
    else if (type === "banner") { html = bannerDocHtml(s); title = "Banner Summary — " + s.name; file = "Banner_" + s.banner.studentId + ".txt"; }
    else { html = qualDocHtml(s); title = "Program Qualification — " + s.name; file = "Qualification_" + s.banner.studentId + ".txt"; }

    $("docTitle").textContent = title;
    $("docSheet").innerHTML = html;
    $("docOverlay").classList.add("open");

    // build a plain-text version for download
    docState.file = file;
    docState.plain = $("docSheet").innerText;
  }

  function wireDocViewer() {
    $("docClose").addEventListener("click", function () { $("docOverlay").classList.remove("open"); });
    $("docOverlay").addEventListener("click", function (e) {
      if (e.target === $("docOverlay")) $("docOverlay").classList.remove("open");
    });
    $("docDownload").addEventListener("click", function () {
      download(docState.file, docState.plain);
    });
  }

  /* ======================================================================
     INIT — re-wire existing controls to the student-aware handlers
     ====================================================================== */
  function init() {
    // Re-bind "View My Matches" + eligibility notification to rich modal.
    var openBtn = $("openEligBtn");
    if (openBtn) reset(openBtn).addEventListener("click", openMatchModal);
    var notifItem = $("notifEligibility");
    if (notifItem) reset(notifItem).addEventListener("click", openMatchModal);

    // Bell also restores the toast if it was dismissed (Feature 1).
    var bell = $("bellIcon");
    if (bell) {
      bell.addEventListener("click", function () {
        if (toastEl && !toastEl.classList.contains("show")) showToast();
      });
    }

    wireModalDelegation();
    wireDocViewer();

    // Admin dashboard
    $("adminToggle").addEventListener("click", toggleAdmin);
    buildStudentSelect();

    // Initial student view + first-load notification
    renderStudentHome();
    setTimeout(showToast, 700);   // slide in shortly after load
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
