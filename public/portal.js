/* ============================================================================
   Golden West College Student Portal — Extension Logic  (data/portal.js)
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
    if ($("notCount")) $("notCount").textContent = m.not.length;

    // Header avatar initial
    var avatar = document.querySelector(".avatar");
    if (avatar) avatar.textContent = s.name[0];

    // Modal greeting
    var h2 = document.querySelector("#eligModal .modal-head h2");
    var p = document.querySelector("#eligModal .modal-head p");
    if (h2) h2.textContent = "Congratulations, " + firstName(s) + "!";
    if (p) p.textContent = "Based on the information Golden West College already has on file, here's where you stand.";
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
    html += '<div class="modal-section-title qualified">You qualify for <span class="count-pill">' + m.qualified.length + "</span></div>";
    if (m.qualified.length) m.qualified.forEach(function (p) { html += progCardHtml(p); });
    else html += '<div class="prog-reason">No current qualifications on file.</div>';

    if (m.almost.length) {
      html += '<div class="modal-section-title almost">Needs action to complete <span class="count-pill">' + m.almost.length + "</span></div>";
      m.almost.forEach(function (p) { html += progCardHtml(p); });
    }

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
    if (state.adminOpen) { renderAnalytics(); renderRoster(); }
  }

  function decisionFileText(s, prog, decision) {
    return [
      "GOLDEN VALLEY COLLEGE — PROGRAM DECISION RECORD (DEMONSTRATION DATA)",
      "=====================================================================",
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

  var toastEl = null;

  function buildToast() {
    var s = current();
    var m = s.matches;
    var count = m.qualified.length;
    var programs = m.qualified.map(function(p) { return p.shortName; }).join(", ");

    toastEl = document.createElement("div");
    toastEl.className = "qual-toast";
    toastEl.innerHTML =
      '<button class="qt-close" aria-label="Close">&times;</button>' +
      '<div class="qt-emoji">🎉</div>' +
      '<div class="qt-title">Congratulations, ' + firstName(s) + '!</div>' +
      '<div class="qt-body">You qualify for <strong>' + count + ' program' + (count > 1 ? 's' : '') + '</strong>: ' + programs + '. Click below to review and accept.</div>' +
      '<div class="qt-cta">View My Programs</div>';

    document.body.appendChild(toastEl);

    // Close button
    toastEl.querySelector(".qt-close").addEventListener("click", function(e) {
      e.stopPropagation();
      hideToast();
    });

    // Click toast body to open modal
    toastEl.addEventListener("click", function() {
      hideToast();
      openMatchModal();
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
    var colors = ["#FFC522", "#0F603D", "#033F2B", "#1A9959", "#BADB3E", "#E5B01E"];
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
  function toggleAdmin() {
    state.adminOpen = !state.adminOpen;
    var btn = $("adminToggle");
    if (state.adminOpen) {
      btn.classList.add("active");
      btn.innerHTML = "&#128100; Exit Admin";
      rosterTab = "full";
      initRosterTabs();
      renderRoster();
    } else {
      btn.classList.remove("active");
      btn.innerHTML = "&#128100; Admin View";
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

  /* ---- Program dropdown under student name in roster ------------------- */
  function studentProgramListHtml(s) {
    var programs = s.matches.qualified.concat(s.matches.almost);
    var count = programs.length;

    var items = programs.map(function (p) {
      var dec = s.decisions[p.id];
      var iconHtml, labelClass, statusText;

      if (dec === "accepted") {
        iconHtml = '<span class="spl-icon spl-accepted">&#10003;</span>';
        labelClass = "spl-label-accepted";
        statusText = "Accepted";
      } else if (dec === "declined") {
        iconHtml = '<span class="spl-icon spl-declined">&times;</span>';
        labelClass = "spl-label-declined";
        statusText = "Declined";
      } else if (dec === "maybe") {
        iconHtml = '<span class="spl-icon spl-pending-img">&#9203;</span>';
        labelClass = "spl-label-pending";
        statusText = "Maybe Later";
      } else {
        iconHtml = '<span class="spl-icon spl-pending-img">&#9203;</span>';
        labelClass = "spl-label-pending";
        statusText = "Pending";
      }

      var almostHtml = "";
      if (p.status === "almost") {
        almostHtml =
          '<div class="spl-almost-detail">' +
            '<span class="spl-almost-badge">Needs Action</span>' +
            (p.missing ? '<span class="spl-missing">&#9888; ' + esc(p.missing) + '</span>' : '') +
          '</div>';
      }

      return '<li class="spl-item">' +
        '<div class="spl-row">' +
          iconHtml +
          '<span class="spl-name ' + labelClass + '">' + esc(p.shortName) + '</span>' +
          '<span class="spl-status ' + labelClass + '">' + statusText + '</span>' +
        '</div>' +
        almostHtml +
      '</li>';
    }).join("");

    if (!count) {
      return '<div class="spl-empty">No matched programs</div>';
    }

    return '<details class="prog-dropdown">' +
      '<summary class="prog-dropdown-btn">Programs (' + count + ') &#9660;</summary>' +
      '<ul class="spl-list">' + items + '</ul>' +
    '</details>';
  }

  /* ---- Status symbol helper for the roster ----------------------------- */
  function studentStatusHtml(s) {
    var decisions = Object.keys(s.decisions).map(function (k) { return s.decisions[k]; });
    var hasAccepted = decisions.some(function (d) { return d === "accepted"; });
    var hasDeclined = decisions.some(function (d) { return d === "declined"; });
    var hasQualified = s.matches.qualified.length > 0 || s.matches.almost.length > 0;

    if (hasAccepted) {
      return '<span class="roster-status status-accepted" title="Accepted">&#10003;</span>';
    }
    if (hasDeclined && !hasAccepted) {
      return '<span class="roster-status status-declined" title="Declined">&times;</span>';
    }
    if (hasQualified) {
      return '<span class="roster-status status-pending" title="Pending response">&#9203;</span>';
    }
    return '<span class="roster-status status-none" title="No programs matched">&mdash;</span>';
  }

  /* ---- Tab state for roster -------------------------------------------- */
  var rosterTab = "full";
  var rosterTabsInited = false;

  function initRosterTabs() {
    if (rosterTabsInited) {
      // Just sync active state without re-adding listeners
      document.querySelectorAll(".roster-tab").forEach(function (btn) {
        btn.classList.toggle("active", btn.getAttribute("data-tab") === rosterTab);
      });
      return;
    }
    rosterTabsInited = true;
    var tabs = document.querySelectorAll(".roster-tab");
    tabs.forEach(function (btn) {
      btn.addEventListener("click", function () {
        rosterTab = btn.getAttribute("data-tab");
        tabs.forEach(function (t) { t.classList.remove("active"); });
        btn.classList.add("active");
        renderRoster();
      });
    });
  }

  /* Returns true if the student is 100% eligible:
     qualified for at least one program (regardless of "almost" matches). */
  function isFullyEligible(s) {
    return s.matches.qualified.length > 0;
  }

  /* ---- Feature 8: priority-ranked roster ------------------------------- */
  function renderRoster() {
    var ranked = T.rankStudents(T.STUDENTS.slice());

    // Split into the two tab groups
    var fullGroup   = ranked.filter(function (r) { return isFullyEligible(r.student); });
    var othersGroup = ranked.filter(function (r) { return !isFullyEligible(r.student); });

    // Update tab counts
    var cFull   = $("tabFullCount");
    var cOthers = $("tabOthersCount");
    if (cFull)   cFull.textContent   = fullGroup.length;
    if (cOthers) cOthers.textContent = othersGroup.length;

    // Pick the list to render based on active tab
    var list = rosterTab === "full" ? fullGroup : othersGroup;

    var body = $("rosterBody");
    if (!body) return;
    body.innerHTML = list.map(function (r) {
      var s = r.student;
      var chips = r.reasons.slice(0, 4).map(function (x) {
        return '<span class="p-chip">' + esc(x) + "</span>";
      }).join("");
      var note = r.note ? '<div class="prog-reason">' + esc(r.note) + "</div>" : "";
      var sel = s.id === state.currentId ? ' style="background:#ffffff;border-left:3px solid var(--primary);"' : "";
      return "<tr" + sel + ">" +
        '<td><span class="plevel l' + r.level + '">P' + r.level + "</span> #" + (ranked.indexOf(r) + 1) + "</td>" +
        "<td><b>" + esc(s.name) + "</b>" + studentProgramListHtml(s) + "</td>" +
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
      // Let <details>/<summary> toggle natively — don't intercept it
      if (e.target.closest("details")) return;

      var b = e.target.closest("button");
      if (b && b.hasAttribute("data-doc")) {
        openDoc(b.getAttribute("data-doc"), b.getAttribute("data-sid"));
        return;
      }
      var tr = e.target.closest("tr");
      if (tr) {
        var name = tr.querySelector("td:nth-child(2) b");
        if (name) {
          var match = T.STUDENTS.filter(function (s) { return s.name === name.textContent; })[0];
          if (match) {
            state.currentId = match.id;
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
      '<div class="doc-seal">GV</div>' +
      '<div><div class="doc-org">Golden West College<small>' + esc(subtitle) + "</small></div></div></div>";
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
      '<div class="doc-note">Fictional demonstration record generated by the Golden West College Portal simulation. ' +
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
      '<div class="doc-note">Fictional demonstration record generated by the Golden West College Portal simulation.</div>';
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

    // Admin dashboard — now the main body, render immediately
    var adminBtn = $("adminToggle");
    if (adminBtn) adminBtn.addEventListener("click", toggleAdmin);
    renderStudentHome();
    renderAnalytics();
    renderProgramChart();
    initRosterTabs();
    renderRoster();

    // Expose refresh function for the tracking overlay to call
    window._refreshAdmin = function() {
      renderAnalytics();
      renderRoster();
    };

    // First-load notification toast
    setTimeout(showToast, 700);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();


/* ============================================================================
   TRACKING STATUS OVERLAY
   Fetches email tracking data from DynamoDB via /api/tracking and updates
   student decisions + admin panel badges to show:
     - "Opted In" (green) if student clicked accept
     - "Opted Out" (gray) if student clicked opt-out  
     - "Pending - X days" if waiting, with red background after 48h
   ========================================================================== */
(function() {
  "use strict";

  var T = window.TAFT;
  if (!T) return;

  function fetchAndApplyTracking() {
    fetch("/api/tracking")
      .then(function(r) { return r.json(); })
      .then(function(data) {
        applyTracking(data.tracking);
      })
      .catch(function(err) {
        console.log("[Tracking] API not available:", err.message);
      });
  }

  function applyTracking(trackingList) {
    trackingList.forEach(function(t) {
      // Find the matching student in TAFT
      var student = T.STUDENTS.filter(function(s) { return s.name === t.name; })[0];
      if (!student) return;

      // Apply tracking status as decisions
      ["eops","care","calworks","nextup","vrc","dsps","promise","basicneeds"].forEach(function(prog) {
        var status = t.programs[prog];
        if (!status) return;

        if (status.status === "opted_in") {
          student.decisions[prog] = "accepted";
        } else if (status.status === "opted_out") {
          student.decisions[prog] = "declined";
        }
        // For "pending" — add tracking info to the student for display
        if (status.status === "pending") {
          if (!student._tracking) student._tracking = {};
          student._tracking[prog] = status;
        }
      });
    });

    // Refresh the admin panel display if it exists
    updateAdminPanel(trackingList);
    
    // Trigger a re-render of the admin analytics if the function exists
    if (window._refreshAdmin) window._refreshAdmin();
  }

  function updateAdminPanel(trackingList) {
    // Find all student rows in the admin student list
    var rows = document.querySelectorAll(".spl-row");
    if (!rows.length) return;

    var trackingMap = {};
    trackingList.forEach(function(t) { trackingMap[t.name] = t.programs; });

    rows.forEach(function(row) {
      var nameEl = row.querySelector(".spl-name");
      if (!nameEl) return;
      var name = nameEl.textContent.trim();
      var tracking = trackingMap[name];
      if (!tracking) return;

      // Find or create badge container
      var badge = row.querySelector(".tracking-badge");
      if (!badge) {
        badge = document.createElement("div");
        badge.className = "tracking-badge";
        badge.style.cssText = "display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;";
        row.appendChild(badge);
      }
      badge.innerHTML = "";

      ["eops","care","calworks"].forEach(function(prog) {
        var s = tracking[prog];
        if (!s || s.status === "not_eligible" || s.status === "not_sent") return;

        var span = document.createElement("span");
        span.style.cssText = "font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700;";

        var label = prog.toUpperCase();
        if (s.status === "opted_in") {
          span.style.background = "#0F603D";
          span.style.color = "#fff";
          span.textContent = label + ": Opted In \u2713";
        } else if (s.status === "opted_out") {
          span.style.background = "#6b7280";
          span.style.color = "#fff";
          span.textContent = label + ": Opted Out";
        } else if (s.status === "pending") {
          if (s.urgent) {
            span.style.background = "#dc2626";
            span.style.color = "#fff";
            span.textContent = label + ": " + s.hoursSince + "h no response \u26A0";
          } else if (s.daysSince >= 1) {
            span.style.background = "#f59e0b";
            span.style.color = "#000";
            span.textContent = label + ": " + s.daysSince + "d waiting";
          } else {
            span.style.background = "#e5e7eb";
            span.style.color = "#374151";
            span.textContent = label + ": Sent today";
          }
        }
        badge.appendChild(span);
      });
    });

    // Also update the "pending" count in the admin stats
    var pendingEl = document.querySelector(".stat-pending-count");
    if (pendingEl) {
      var pending = 0;
      trackingList.forEach(function(t) {
        var hasPending = Object.values(t.programs).some(function(p) { return p.status === "pending"; });
        if (hasPending) pending++;
      });
      pendingEl.textContent = pending + " awaiting response";
    }
  }

  // Fetch on load and refresh every 15 seconds
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      setTimeout(fetchAndApplyTracking, 500); // slight delay for TAFT to init
      setInterval(fetchAndApplyTracking, 15000);
    });
  } else {
    setTimeout(fetchAndApplyTracking, 500);
    setInterval(fetchAndApplyTracking, 15000);
  }
})();
