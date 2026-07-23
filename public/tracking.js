/* ============================================================================
   tracking.js — DO NOT DELETE OR OVERWRITE
   ──────────────────────────────────────────────────────────────────────────
   This file connects the portal UI to DynamoDB (via API Gateway + Lambda).
   It syncs student opt-in/opt-out status from email and SMS into the dashboard.
   
   It is SEPARATE from portal.js so UI updates don't break tracking.
   
   When updating the UI:
     - Replace portal.js, index.js, students.js, styles — fine
     - DO NOT remove tracking.js from index.html
     - DO NOT remove the _refreshAdmin hook from portal.js
   
   Requirements from portal.js:
     - window.TAFT must exist (students + matches)
     - window._refreshAdmin must be defined (calls renderAnalytics + renderRoster)
   ========================================================================== */
(function() {
  "use strict";

  var API = "https://3mag8ec9a2.execute-api.us-west-2.amazonaws.com/prod";
  var T = null;
  var retryCount = 0;

  function waitForTAFT() {
    T = window.TAFT;
    if (!T && retryCount < 20) {
      retryCount++;
      setTimeout(waitForTAFT, 250);
      return;
    }
    if (!T) { console.log("[Tracking] TAFT not found after retries"); return; }
    console.log("[Tracking] Connected to TAFT (" + T.STUDENTS.length + " students)");
    fetchAndApply();
    setInterval(fetchAndApply, 5000);
  }

  function fetchAndApply() {
    fetch(API + "/api/tracking")
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.tracking) return;
        var updated = 0;
        data.tracking.forEach(function(t) {
          var student = T.STUDENTS.filter(function(s) { return s.name === t.name; })[0];
          if (!student) return;
          Object.keys(t.programs).forEach(function(prog) {
            var status = t.programs[prog];
            if (!status) return;
            if (status.status === "opted_in" && student.decisions[prog] !== "accepted") {
              student.decisions[prog] = "accepted";
              updated++;
            } else if (status.status === "opted_out" && student.decisions[prog] !== "declined") {
              student.decisions[prog] = "declined";
              updated++;
            }
          });
        });
        if (updated > 0) {
          console.log("[Tracking] Updated " + updated + " decisions from DynamoDB");
          if (window._refreshAdmin) window._refreshAdmin();
        }
      })
      .catch(function(err) {
        console.log("[Tracking] API unavailable:", err.message);
      });
  }

  // Start
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitForTAFT);
  } else {
    waitForTAFT();
  }
})();
