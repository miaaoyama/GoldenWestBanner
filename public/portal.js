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
    if ($("almostCount")) $("almostCount").textContent = m.almost.length;
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
               '<div class="bar-track"><div class="bar-fill" data-pct="' + pct + '">' + count + '</div></div>' +
               '<div class="bar-count" title="' + count + ' of ' + total + ' students">' + pct + "%</div>" +
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
        var needsEmail = !dec || dec === "maybe";
        almostHtml =
          '<div class="spl-almost-detail">' +
            '<span class="spl-almost-badge">Almost</span>' +
            (p.missing ? '<span class="spl-missing">&#9888; Missing: ' + esc(p.missing) + '</span>' : '') +
            (needsEmail ? '<span class="spl-email-flag">&#9993; Follow-up email needed</span>' : '') +
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
      '<summary class="prog-dropdown-btn">Programs (' + count + ')</summary>' +
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
     qualified for at least one program AND has zero "almost" matches. */
  function isFullyEligible(s) {
    return s.matches.qualified.length > 0 && s.matches.almost.length === 0;
  }

  /* ======================================================================
     PROGRAM FILTER (custom animated dropdown)
     ---------------------------------------------------------------------- */
  var programFilter = "all";          // session-only state, persists across tab switches
  var timeFilter = "all";             // time-period filter state

  /* Mock data source. TODO: Replace with fetch('/api/programs') when the
     backend is ready — keep the { id, name } shape so callers don't change. */
  function getProgramOptions() {
    return [{ id: "all", name: "All Programs" }].concat(
      T.PROGRAMS.map(function (p) { return { id: p.id, name: p.shortName }; })
    );
  }

  function getTimeOptions() {
    return [
      { id: "all",   name: "All Time" },
      { id: "24h",   name: "Last 24 Hours" },
      { id: "48h",   name: "Last 48 Hours" },
      { id: "7d",    name: "Last 7 Days" },
      { id: "30d",   name: "Last 30 Days" }
    ];
  }

  function getTimeThreshold(filterId) {
    var now = Date.now();
    switch (filterId) {
      case "24h": return now - (24 * 60 * 60 * 1000);
      case "48h": return now - (48 * 60 * 60 * 1000);
      case "7d":  return now - (7 * 24 * 60 * 60 * 1000);
      case "30d": return now - (30 * 24 * 60 * 60 * 1000);
      default:    return 0;  // "all" — everything passes
    }
  }

  /* True when the student matches the active program filter (qualified OR
     almost qualified for the selected program). "all" matches everyone. */
  function matchesProgramFilter(s) {
    if (programFilter === "all") return true;
    return s.matches.qualified.concat(s.matches.almost).some(function (p) {
      return p.id === programFilter;
    });
  }

  /* True when the student's matchedAt timestamp falls within the selected period. */
  function matchesTimeFilter(s) {
    if (timeFilter === "all") return true;
    return s.matchedAt >= getTimeThreshold(timeFilter);
  }

  /* ---- Feature 8: priority-ranked roster ------------------------------- */
  function renderRoster() {
    var ranked = T.rankStudents(T.STUDENTS.slice());

    // Apply the active program filter before splitting into tab groups
    ranked = ranked.filter(function (r) { return matchesProgramFilter(r.student); });

    // Apply the active time-period filter
    ranked = ranked.filter(function (r) { return matchesTimeFilter(r.student); });

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
      var sel = s.id === state.currentId ? ' style="background:#f3ecff;"' : "";
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
      '<img id="college-logo" src="/images/images (1).png" height="40" width="60">' +
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

  /* ---- Program filter: build options + wire interactions --------------- */
  var pfInited = false;

  function wireProgramFilter() {
    var wrap = $("programFilter");
    var trigger = $("pfTrigger");
    var listbox = $("pfListbox");
    var valueEl = $("pfValue");
    if (!wrap || !trigger || !listbox || !valueEl || pfInited) return;
    pfInited = true;

    // Build options from the (mock) data source
    var options = getProgramOptions();
    listbox.innerHTML = options.map(function (o) {
      var selected = o.id === programFilter ? "true" : "false";
      return '<li class="pf-option" role="option" id="pf-opt-' + o.id + '" ' +
             'data-value="' + o.id + '" aria-selected="' + selected + '">' +
             esc(o.name) + "</li>";
    }).join("");

    var optionEls = Array.prototype.slice.call(listbox.querySelectorAll(".pf-option"));
    var activeIndex = -1;

    function isOpen() { return wrap.classList.contains("open"); }

    function setActive(i) {
      if (activeIndex > -1 && optionEls[activeIndex]) {
        optionEls[activeIndex].classList.remove("pf-active");
      }
      activeIndex = i;
      if (i > -1 && optionEls[i]) {
        optionEls[i].classList.add("pf-active");
        trigger.setAttribute("aria-activedescendant", optionEls[i].id);
        optionEls[i].scrollIntoView({ block: "nearest" });
      } else {
        trigger.removeAttribute("aria-activedescendant");
      }
    }

    function openList() {
      wrap.classList.add("open");
      trigger.setAttribute("aria-expanded", "true");
      // Start keyboard focus on the currently selected option
      var selIdx = optionEls.findIndex(function (el) {
        return el.getAttribute("aria-selected") === "true";
      });
      setActive(selIdx > -1 ? selIdx : 0);
    }

    function closeList(returnFocus) {
      wrap.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      setActive(-1);
      if (returnFocus) trigger.focus();
    }

    function selectOption(el) {
      var id = el.getAttribute("data-value");
      programFilter = id;
      optionEls.forEach(function (o) {
        o.setAttribute("aria-selected", o === el ? "true" : "false");
      });
      valueEl.textContent = el.textContent;
      closeList(true);
      renderRoster();          // reactive, client-side update
    }

    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      if (isOpen()) { closeList(); } else { openList(); }
    });

    optionEls.forEach(function (el, i) {
      el.addEventListener("click", function (e) { e.stopPropagation(); selectOption(el); });
      el.addEventListener("mousemove", function () { setActive(i); });
    });

    // Keyboard support on the trigger
    trigger.addEventListener("keydown", function (e) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (!isOpen()) { openList(); }
          else { setActive(Math.min(optionEls.length - 1, activeIndex + 1)); }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (!isOpen()) { openList(); }
          else { setActive(Math.max(0, activeIndex - 1)); }
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (!isOpen()) { openList(); }
          else if (activeIndex > -1) { selectOption(optionEls[activeIndex]); }
          break;
        case "Escape":
          if (isOpen()) { e.preventDefault(); closeList(true); }
          break;
        case "Home":
          if (isOpen()) { e.preventDefault(); setActive(0); }
          break;
        case "End":
          if (isOpen()) { e.preventDefault(); setActive(optionEls.length - 1); }
          break;
      }
    });

    // Click outside closes the dropdown
    document.addEventListener("click", function (e) {
      if (isOpen() && !wrap.contains(e.target)) closeList();
    });
  }

  /* ---- Time-period filter: build options + wire interactions ------------ */
  var tfInited = false;

  function wireTimeFilter() {
    var wrap = $("timeFilterWrap");
    var trigger = $("tfTrigger");
    var listbox = $("tfListbox");
    var valueEl = $("tfValue");
    if (!wrap || !trigger || !listbox || !valueEl || tfInited) return;
    tfInited = true;

    var options = getTimeOptions();
    listbox.innerHTML = options.map(function (o) {
      var selected = o.id === timeFilter ? "true" : "false";
      return '<li class="pf-option" role="option" id="tf-opt-' + o.id + '" ' +
             'data-value="' + o.id + '" aria-selected="' + selected + '">' +
             esc(o.name) + "</li>";
    }).join("");

    var optionEls = Array.prototype.slice.call(listbox.querySelectorAll(".pf-option"));
    var activeIndex = -1;

    function isOpen() { return wrap.classList.contains("open"); }

    function setActive(i) {
      if (activeIndex > -1 && optionEls[activeIndex]) {
        optionEls[activeIndex].classList.remove("pf-active");
      }
      activeIndex = i;
      if (i > -1 && optionEls[i]) {
        optionEls[i].classList.add("pf-active");
        trigger.setAttribute("aria-activedescendant", optionEls[i].id);
        optionEls[i].scrollIntoView({ block: "nearest" });
      } else {
        trigger.removeAttribute("aria-activedescendant");
      }
    }

    function openList() {
      wrap.classList.add("open");
      trigger.setAttribute("aria-expanded", "true");
      var selIdx = optionEls.findIndex(function (el) {
        return el.getAttribute("aria-selected") === "true";
      });
      setActive(selIdx > -1 ? selIdx : 0);
    }

    function closeList(returnFocus) {
      wrap.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
      setActive(-1);
      if (returnFocus) trigger.focus();
    }

    function selectOption(el) {
      var id = el.getAttribute("data-value");
      timeFilter = id;
      optionEls.forEach(function (o) {
        o.setAttribute("aria-selected", o === el ? "true" : "false");
      });
      valueEl.textContent = el.textContent;
      closeList(true);
      renderRoster();
    }

    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      if (isOpen()) { closeList(); } else { openList(); }
    });

    optionEls.forEach(function (el, i) {
      el.addEventListener("click", function (e) { e.stopPropagation(); selectOption(el); });
      el.addEventListener("mousemove", function () { setActive(i); });
    });

    trigger.addEventListener("keydown", function (e) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (!isOpen()) { openList(); }
          else { setActive(Math.min(optionEls.length - 1, activeIndex + 1)); }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (!isOpen()) { openList(); }
          else { setActive(Math.max(0, activeIndex - 1)); }
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (!isOpen()) { openList(); }
          else if (activeIndex > -1) { selectOption(optionEls[activeIndex]); }
          break;
        case "Escape":
          if (isOpen()) { e.preventDefault(); closeList(true); }
          break;
        case "Home":
          if (isOpen()) { e.preventDefault(); setActive(0); }
          break;
        case "End":
          if (isOpen()) { e.preventDefault(); setActive(optionEls.length - 1); }
          break;
      }
    });

    document.addEventListener("click", function (e) {
      if (isOpen() && !wrap.contains(e.target)) closeList();
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
    wireProgramFilter();
    wireTimeFilter();
    renderRoster();

    // First-load notification toast
    setTimeout(showToast, 700);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
