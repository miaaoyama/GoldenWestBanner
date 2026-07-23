// Backend API URL — change this when deploying to AWS Amplify
  window.BACKEND_URL = 'https://bonus-junction-natural.ngrok-free.dev';
  window.CURRENT_STUDENT_CWID = '@30302410'; // Demo student (Kylie Sanchez)

  // Simple status-bar-on-hover behavior, mimicking the browser link preview in the screenshot
  document.querySelectorAll('a').forEach(function(a){
    a.addEventListener('mouseenter', function(){
      var bar = document.getElementById('statusBar');
      var href = a.getAttribute('href');
      if(href && href !== '#'){
        bar.textContent = href;
        bar.style.display = 'block';
      }
    });
    a.addEventListener('mouseleave', function(){
      document.getElementById('statusBar').style.display = 'none';
    });
  });

  // Add New Task -> simple prompt-based add, purely front-end demo
  document.getElementById('addTaskBtn').addEventListener('click', function(){
    var task = prompt('Enter a new task:');
    if(task){
      alert('Task added: ' + task + ' (demo only — not saved)');
    }
  });

  /* ---------------------------------------------------------
     Program eligibility matching — mock data & interactions
     (Illustrates the "automated eligibility matching + proactive
     notification" concept: uses info already on file instead of
     asking the student to apply program-by-program.)
  --------------------------------------------------------- */
  var programs = [
    {
      id: 'eops',
      name: 'EOPS — Extended Opportunity Programs & Services',
      status: 'qualified',
      description: 'Extra academic counseling, priority registration, textbook assistance, and grants for students who qualify based on financial aid status and academic standing.',
      decision: null
    },
    {
      id: 'calworks',
      name: 'CalWORKs',
      status: 'qualified',
      description: 'Work-study, childcare assistance, and academic support for students receiving CalWORKs benefits, coordinated with your county caseworker.',
      decision: null
    },
    {
      id: 'goldenpromise',
      name: 'Golden Promise',
      status: 'qualified',
      description: 'Waives enrollment fees for your first two years and adds a dedicated success counselor, based on your first-time-student status and unit load.',
      decision: null
    },
    {
      id: 'care',
      name: 'CARE — Cooperative Agencies Resources for Education',
      status: 'almost',
      description: 'Additional grants, school supplies, and counseling for EOPS students who are single parents receiving public assistance.',
      missing: 'We need proof of dependent care (a household/dependent verification form) to confirm eligibility.',
      decision: null
    },
    {
      id: 'freshsuccess',
      name: 'Fresh Success',
      status: 'not',
      description: 'Combines CalWORKs and EOPS support with career pathway planning for students moving toward economic self-sufficiency.',
      reason: 'Requires active CalWORKs enrollment, which is not currently on file for you.',
      decision: null
    }
  ];

  function statusLabel(status){
    if(status === 'qualified') return 'Qualified';
    if(status === 'almost') return 'Almost There';
    return 'Not Yet Eligible';
  }

  function renderProgramCard(p){
    var actionsHtml = '';
    if(p.decision === 'accepted'){
      actionsHtml = '<div class="decision-tag accepted">&#10003; You opted in — a program advisor will reach out.</div>';
    } else if(p.decision === 'optedout'){
      actionsHtml = '<div class="decision-tag optedout">You opted out of this program.</div>';
    } else if(p.status === 'qualified' || p.status === 'almost'){
      actionsHtml =
        '<div class="prog-actions">' +
          '<button class="btn-accept" data-id="'+p.id+'" data-action="accept">Opt In</button>' +
          '<button class="btn-optout" data-id="'+p.id+'" data-action="optout">Opt Out</button>' +
        '</div>';
    }

    var extra = '';
    if(p.status === 'almost' && p.missing){
      extra = '<div class="prog-missing">Still needed: ' + p.missing + '</div>';
    }
    if(p.status === 'not' && p.reason){
      extra = '<div class="prog-reason">' + p.reason + '</div>';
    }

    return (
      '<div class="prog-card" data-card="'+p.id+'">' +
        '<div class="prog-card-top">' +
          '<div class="prog-name">'+p.name+'</div>' +
          '<span class="status-pill '+p.status+'">'+statusLabel(p.status)+'</span>' +
        '</div>' +
        '<div class="prog-desc">'+p.description+'</div>' +
        extra +
        actionsHtml +
      '</div>'
    );
  }

  function renderEligibility(){
    var qualified = programs.filter(function(p){return p.status === 'qualified';});
    var almost = programs.filter(function(p){return p.status === 'almost';});
    var notYet = programs.filter(function(p){return p.status === 'not';});

    document.getElementById('qualifiedCount').textContent = qualified.length;
    document.getElementById('almostCount').textContent = almost.length;
    document.getElementById('notCount').textContent = notYet.length;

    var html = '';

    html += '<div class="modal-section-title qualified">You currently qualify for <span class="count-pill">'+qualified.length+'</span></div>';
    qualified.forEach(function(p){ html += renderProgramCard(p); });

    html += '<div class="modal-section-title almost">You almost qualify for <span class="count-pill">'+almost.length+'</span></div>';
    if(almost.length){
      almost.forEach(function(p){ html += renderProgramCard(p); });
    } else {
      html += '<div class="prog-reason">Nothing pending right now — check back after your next document upload.</div>';
    }

    html += '<div class="modal-section-title not">Not yet eligible <span class="count-pill">'+notYet.length+'</span></div>';
    notYet.forEach(function(p){ html += renderProgramCard(p); });

    document.getElementById('eligModalBody').innerHTML = html;

    // wire up accept/opt-out buttons
    document.querySelectorAll('.btn-accept, .btn-optout').forEach(function(btn){
      btn.addEventListener('click', function(){
        var id = btn.getAttribute('data-id');
        var action = btn.getAttribute('data-action');
        var prog = programs.filter(function(p){ return p.id === id; })[0];
        if(!prog) return;
        prog.decision = action === 'accept' ? 'accepted' : 'optedout';

        // Call backend API to record the decision
        var apiBase = window.BACKEND_URL || '';
        if(action === 'accept'){
          fetch(apiBase + '/api/send-email', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({cwid: window.CURRENT_STUDENT_CWID || 'demo', program: id})
          }).then(function(r){ return r.json(); }).then(function(data){
            console.log('[API] Opt-in recorded:', data);
          }).catch(function(err){
            console.log('[API] Backend not available, recorded locally only:', err.message);
          });
        }

        renderEligibility();
      });
    });
  }

  function openEligModal(){
    renderEligibility();
    document.getElementById('eligModal').classList.add('open');
    // mark the notification as read + drop badge count
    document.getElementById('notifEligibility').classList.add('read');
    var badge = document.getElementById('notifBadge');
    var count = Math.max(0, parseInt(badge.textContent || '0', 10) - 1);
    if(count > 0){
      badge.textContent = count;
    } else {
      badge.style.display = 'none';
    }
    document.getElementById('notifPanel').classList.remove('open');
  }

  document.getElementById('openEligBtn').addEventListener('click', openEligModal);
  document.getElementById('notifEligibility').addEventListener('click', openEligModal);
  document.getElementById('closeEligModal').addEventListener('click', function(){
    document.getElementById('eligModal').classList.remove('open');
  });
  document.getElementById('eligModal').addEventListener('click', function(e){
    if(e.target === document.getElementById('eligModal')){
      document.getElementById('eligModal').classList.remove('open');
    }
  });

  // Bell dropdown toggle
  document.getElementById('bellIcon').addEventListener('click', function(e){
    e.stopPropagation();
    document.getElementById('notifPanel').classList.toggle('open');
  });
  document.addEventListener('click', function(e){
    var panel = document.getElementById('notifPanel');
    if(panel.classList.contains('open') && !panel.contains(e.target) && e.target.id !== 'bellIcon'){
      panel.classList.remove('open');
    }
  });

  // initialize summary counts on load
  renderEligibility();