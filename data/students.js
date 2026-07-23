/* ============================================================================
   Taft College Student Portal — Mock Student Database & Rules Engine
   ----------------------------------------------------------------------------
   This file is ADDITIVE. It does not modify or remove any existing behavior.
   It exposes a single global namespace `window.TAFT` that the portal
   extension (data/portal.js) and the existing index.js can read from.

   Everything here is FICTIONAL demonstration data. Names, IDs, incomes and
   FAFSA/Banner figures are invented for a realistic-looking simulation and do
   not represent real people or records.

   Contents:
     1. PROGRAMS      — catalog of campus support programs (Features 2 & 8)
     2. STUDENTS      — ~25 realistic mock students w/ FAFSA + Banner + CCCApply
     3. matchPrograms() — rules engine that decides qualified/almost/not
     4. priorityScore() / rankStudents() — weighted priority engine (Feature 8)
     5. Helper formatters used across the UI and generated documents
   ========================================================================== */
(function () {
  "use strict";

  /* --------------------------------------------------------------------------
     1. PROGRAM CATALOG
     Each program carries the rich content the Program Match modal needs
     (Feature 2): funding, deadline, counseling, academic + career benefits,
     application process, and a long "What is this?" explanation.
     `qualifies(s)` returns 'qualified' | 'almost' | 'not' for a student `s`.
  -------------------------------------------------------------------------- */
  var PROGRAMS = [
    {
      id: "eops",
      name: "EOPS — Extended Opportunity Programs & Services",
      shortName: "EOPS",
      funding: "$1,100 – $2,400 / year in grants + textbook vouchers",
      deadline: "September 12, 2026",
      counseling: "3 required counseling contacts per term with a dedicated EOPS counselor.",
      academic: "Priority registration, book service, and personalized education plans.",
      career: "Transfer coaching, university tours, and internship referrals.",
      process: "Confirm your match here, then attend one EOPS orientation. Your counselor is auto-assigned.",
      about:
        "EOPS is a state-funded program for students who face economic and educational " +
        "barriers. It layers extra counseling, grant money, priority registration, and " +
        "book support on top of your regular financial aid. Students in EOPS transfer and " +
        "complete degrees at noticeably higher rates because someone is tracking their plan " +
        "with them every term. If you qualify, joining is one of the highest-value things " +
        "you can do at Taft College.",
      // Rules: low-income + educationally disadvantaged + Pell + enrolled full enough
      qualifies: function (s) {
        var econ = s.pellEligible || s.householdIncome <= 45000;
        var eduDisadv = s.firstGen || s.gpa < 2.5 || s.fafsa.sai < 1000;
        var load = s.currentUnits >= 12;
        if (econ && eduDisadv && load) return "qualified";
        if (econ && eduDisadv && s.currentUnits >= 9) return "almost";
        if (econ || eduDisadv) return "almost";
        return "not";
      },
      almostMissing: "Enroll in at least 12 units this term to complete EOPS eligibility.",
      notReason: "EOPS is for students with documented economic and educational barriers; your record does not currently show them."
    },
    {
      id: "care",
      name: "CARE — Cooperative Agencies Resources for Education",
      shortName: "CARE",
      funding: "$1,000 / year supplemental grant + meal & gas assistance",
      deadline: "September 12, 2026",
      counseling: "Single-parent support groups plus EOPS counseling.",
      academic: "Childcare referrals and flexible workshop scheduling.",
      career: "Career pathway planning aimed at economic self-sufficiency.",
      process: "Requires active EOPS membership; add CARE at your EOPS orientation.",
      about:
        "CARE supports EOPS students who are single parents receiving public assistance. " +
        "It recognizes that raising children while in college is a full-time job on its own, " +
        "and adds grants, childcare help, and a peer community so you can stay enrolled.",
      qualifies: function (s) {
        var eopsOk = PROGRAMS_BY_ID.eops.qualifies(s) === "qualified";
        if (eopsOk && s.survey.singleParent && s.survey.publicAssistance) return "qualified";
        if ((s.survey.singleParent || s.survey.publicAssistance) && eopsOk) return "almost";
        return "not";
      },
      almostMissing: "Upload proof of public assistance (CalWORKs/CalFresh) and dependent verification.",
      notReason: "CARE requires EOPS membership plus single-parent status receiving public assistance."
    },
    {
      id: "calworks",
      name: "CalWORKs Student Services",
      shortName: "CalWORKs",
      funding: "Work-study wages + childcare + book assistance",
      deadline: "Rolling — coordinated with your county caseworker",
      counseling: "Joint case management with your county CalWORKs worker.",
      academic: "On-campus work-study aligned to your class schedule.",
      career: "Vocational training and job-placement services.",
      process: "Confirm your county CalWORKs enrollment, then meet the campus CalWORKs coordinator.",
      about:
        "The CalWORKs program connects students already receiving CalWORKs cash aid with " +
        "on-campus work-study, childcare, and counseling so schooling counts toward your " +
        "welfare-to-work plan instead of competing with it.",
      qualifies: function (s) {
        if (s.survey.calworks) return "qualified";
        if (s.survey.publicAssistance) return "almost";
        return "not";
      },
      almostMissing: "Provide your county CalWORKs case number to activate campus services.",
      notReason: "Requires active county CalWORKs cash aid, which is not on file."
    },
    {
      id: "nextup",
      name: "NextUp / Guardian Scholars (Foster Youth)",
      shortName: "NextUp",
      funding: "$2,000+ / year + housing, transportation & food support",
      deadline: "August 22, 2026 (limited cohort)",
      counseling: "Dedicated foster-youth success coach and year-round contact.",
      academic: "Priority registration, laptop loan, and summer bridge.",
      career: "Independent-living skills, internships, and transfer support.",
      process: "Verify former/current foster youth status (up to age 26) with the NextUp coordinator.",
      about:
        "NextUp (and Guardian Scholars) wraps around current and former foster youth with " +
        "the practical things a family often provides — help with housing, food, transportation, " +
        "and a coach who checks in all year. It exists because foster youth face steeper odds, " +
        "and it measurably closes that gap.",
      qualifies: function (s) {
        if (s.fosterYouth) return "qualified";
        return "not";
      },
      almostMissing: "",
      notReason: "NextUp serves current or former foster youth (in foster care after age 13)."
    },
    {
      id: "vrc",
      name: "Veterans Resource Center",
      shortName: "Veterans",
      funding: "VA benefits certification + emergency grants",
      deadline: "Rolling enrollment",
      counseling: "VA-trained counselors and a veteran peer network.",
      academic: "Priority registration and a quiet study lounge.",
      career: "Skills-translation and veteran hiring-partner referrals.",
      process: "Bring your DD-214 or current service orders to the VRC to certify benefits.",
      about:
        "The Veterans Resource Center helps service members and veterans certify GI Bill and " +
        "other VA education benefits, and provides a community of peers plus priority " +
        "registration so deployments and drill schedules don't derail your degree.",
      qualifies: function (s) {
        if (s.veteran) return "qualified";
        return "not";
      },
      almostMissing: "",
      notReason: "The Veterans Resource Center serves veterans and active service members."
    },
    {
      id: "dsps",
      name: "DSPS — Disabled Students Programs & Services",
      shortName: "DSPS",
      funding: "Assistive technology + testing accommodations (no cost)",
      deadline: "Rolling enrollment",
      counseling: "Specialized DSPS counseling and accommodation planning.",
      academic: "Extended test time, note-takers, alternate-format materials.",
      career: "Workplace-accommodation coaching and Dept. of Rehab referrals.",
      process: "Submit disability documentation to schedule an accommodations intake.",
      about:
        "DSPS provides academic accommodations and support to students with a documented " +
        "disability, so the disability is never the reason a course is harder than it should be. " +
        "Accommodations are individualized and confidential.",
      qualifies: function (s) {
        if (s.disability) return "qualified";
        return "not";
      },
      almostMissing: "",
      notReason: "DSPS requires documentation of a disability on file."
    },
    {
      id: "promise",
      name: "Taft College Promise (First-Year Experience)",
      shortName: "Promise",
      funding: "Waives enrollment fees for two years + $300 book credit",
      deadline: "August 1, 2026",
      counseling: "First-Year Experience cohort counselor.",
      academic: "Guided pathways, tutoring, and a first-year seminar.",
      career: "Early major/career exploration and mentoring.",
      process: "Automatic for first-time, full-time California residents who file a FAFSA/CADAA.",
      about:
        "The Taft College Promise removes the enrollment-fee barrier for first-time, full-time " +
        "students in their first two years, and pairs you with a cohort and counselor so you " +
        "start with momentum instead of guesswork.",
      qualifies: function (s) {
        var firstTime = s.banner.completedUnits <= 15;
        var resident = s.residency === "California Resident";
        var fullTime = s.currentUnits >= 12;
        if (firstTime && resident && fullTime) return "qualified";
        if (resident && fullTime) return "almost";
        return "not";
      },
      almostMissing: "The Promise is strongest for first-time students; you may still qualify for continuing-student aid.",
      notReason: "The Promise is for first-time, full-time California residents."
    },
    {
      id: "basicneeds",
      name: "Basic Needs & Housing Support",
      shortName: "Basic Needs",
      funding: "Food pantry, emergency housing grants, CalFresh enrollment",
      deadline: "Immediate — walk-in support available",
      counseling: "Basic-needs case manager and community-resource navigation.",
      academic: "Emergency book and technology loans.",
      career: "Connections to stable-housing and employment resources.",
      process: "Meet the Basic Needs coordinator — no documentation required to start.",
      about:
        "The Basic Needs Center makes sure food and housing insecurity don't end your education. " +
        "It connects you to the campus pantry, emergency grants, CalFresh, and housing resources, " +
        "confidentially and fast.",
      qualifies: function (s) {
        if (s.homeless) return "qualified";
        if (s.householdIncome <= 20000 || s.survey.foodInsecure) return "almost";
        return "not";
      },
      almostMissing: "Meet with a Basic Needs coordinator to review food and housing resources you may be missing.",
      notReason: "Prioritized for students reporting housing or food insecurity."
    }
  ];

  var PROGRAMS_BY_ID = {};
  PROGRAMS.forEach(function (p) { PROGRAMS_BY_ID[p.id] = p; });

  /* --------------------------------------------------------------------------
     2. MOCK STUDENTS (~25). Realistic, varied names/majors/finances.
        `_base` holds raw attributes; FAFSA + Banner + program matches +
        priority are derived so the data stays internally consistent.
  -------------------------------------------------------------------------- */
  var ADVISORS = [
    "Dr. Elena Marquez", "Prof. Daniel Okafor", "Ms. Priya Raman",
    "Mr. Curtis Bell", "Dr. Sofia Nakamura", "Ms. Angela Ruiz"
  ];

  // Compact base records. Fields:
  // name, major, gpa, completedUnits, currentUnits, residency, householdSize,
  // householdIncome, studentIncome, parentIncome, saiRaw, pell, veteran,
  // homeless, foster, firstGen, disability, dependency, calworks,
  // singleParent, publicAssistance, foodInsecure
  var BASE = [
    ["Maria Delgado","Nursing (RN)",3.42,12,15,"California Resident",5,28000,0,26000,-450,true,false,false,false,true,false,"Dependent",false,false,false,true],
    ["Jamal Carter","Business Administration",2.18,9,13,"California Resident",4,19500,4200,15000,320,true,false,true,false,true,false,"Independent",false,true,true,true],
    ["Emily Nguyen","Biology (Pre-Med)",3.88,24,16,"California Resident",4,61000,1200,59000,2100,false,false,false,false,false,false,"Dependent",false,false,false,false],
    ["Carlos Ramirez","Petroleum Technology",2.95,30,12,"California Resident",6,34000,8000,24000,780,true,false,false,false,true,true,"Independent",false,false,true,false],
    ["Ashley Thompson","Psychology",3.15,15,15,"California Resident",3,47000,3000,42000,1450,true,false,false,true,false,false,"Dependent",false,false,false,false],
    ["Diego Herrera","Administration of Justice",2.62,6,12,"California Resident",5,22000,5000,15000,90,true,true,false,false,true,false,"Independent",false,false,false,true],
    ["Sarah Kim","Computer Science",3.71,18,16,"California Resident",4,88000,2000,85000,3600,false,false,false,false,false,true,"Dependent",false,false,false,false],
    ["Michael Johnson","Kinesiology",2.05,12,9,"California Resident",2,15000,15000,0,-120,true,false,true,false,true,false,"Independent",true,true,true,true],
    ["Fatima Al-Hassan","Early Childhood Education",3.55,21,14,"California Resident",7,31000,2500,27000,410,true,false,false,false,true,false,"Dependent",false,true,true,false],
    ["Tyler Brooks","Welding Technology",2.40,3,12,"California Resident",4,26000,6000,18000,260,true,false,false,false,true,false,"Independent",false,false,false,false],
    ["Grace Okoro","Chemistry",3.92,27,15,"California Resident",5,54000,0,53000,1980,false,false,false,false,true,false,"Dependent",false,false,false,false],
    ["Antonio Rossi","Music",2.88,14,12,"California Resident",3,40000,3500,35000,1240,true,false,false,true,false,true,"Dependent",false,false,false,false],
    ["Destiny Williams","Social Work",2.33,10,15,"California Resident",6,17000,2000,13000,-300,true,false,true,true,true,false,"Independent",false,true,true,true],
    ["Kevin Tran","Engineering",3.64,20,16,"California Resident",4,72000,1800,69000,2850,false,true,false,false,false,false,"Dependent",false,false,false,false],
    ["Isabella Flores","Communication Studies",3.02,12,13,"California Resident",5,29000,4000,23000,560,true,false,false,false,true,false,"Independent",false,false,false,false],
    ["Marcus Green","Automotive Technology",2.11,6,12,"California Resident",3,21000,7000,12000,150,true,false,false,false,true,true,"Independent",false,false,true,true],
    ["Hannah Martinez","Art History",3.28,16,12,"California Resident",4,45000,2200,41000,1600,true,false,false,true,false,false,"Dependent",false,false,false,false],
    ["Omar Farah","Mathematics",3.79,22,16,"California Resident",8,33000,1000,31000,720,true,false,false,false,true,false,"Dependent",false,false,true,false],
    ["Chloe Anderson","Dental Hygiene",3.10,15,14,"California Resident",3,58000,3000,54000,2050,false,false,false,false,false,true,"Dependent",false,false,false,false],
    ["Luis Mendoza","Agriculture Business",2.74,9,13,"California Resident",6,25000,6500,17000,340,true,false,false,false,true,true,"Independent",false,false,true,false],
    ["Nia Robinson","Sociology",2.57,12,12,"California Resident",4,23500,3000,19000,180,true,false,false,true,true,false,"Independent",false,true,false,true],
    ["Ethan Walker","Fire Technology",2.99,18,12,"California Resident",3,49000,9000,38000,1360,true,true,false,false,false,false,"Independent",false,false,false,false],
    ["Priscilla Vega","Liberal Arts",3.20,14,15,"California Resident",5,30000,2000,27000,640,true,false,true,false,true,false,"Independent",false,true,true,true],
    ["Brandon Lee","Physics",3.85,26,16,"California Resident",4,95000,2500,91000,4200,false,false,false,false,false,false,"Dependent",false,false,false,false],
    ["Aaliyah Jackson","Respiratory Therapy",2.66,11,14,"California Resident",5,20000,3500,15000,-80,true,false,true,true,true,false,"Independent",false,true,true,true],
    ["Jacob Torres","Business Administration",3.05,17,13,"California Resident",4,42000,4000,37000,1180,true,false,false,false,true,false,"Dependent",false,false,false,false]
  ];

  // Deterministic pseudo-random helper so generated IDs are stable per reload.
  function pad(num, size) {
    var s = String(num);
    while (s.length < size) s = "0" + s;
    return s;
  }

  var STUDENTS = BASE.map(function (b, i) {
    var idx = i + 1;
    var name = b[0];
    var bannerId = "T00" + pad(154200 + idx * 37, 6);      // e.g. T00154237
    var fafsaId = "DS" + pad(9000000 + idx * 4111, 7) + "XG"; // FSA ID style
    var initials = name.split(" ").map(function (w) { return w[0]; }).join("");

    var s = {
      idx: idx,
      id: "stu" + idx,
      name: name,
      initials: initials,
      major: b[1],
      gpa: b[2],
      residency: b[5],
      householdSize: b[6],
      householdIncome: b[7],
      studentIncome: b[8],
      parentIncome: b[9],
      pellEligible: b[11],
      veteran: b[12],
      homeless: b[13],
      fosterYouth: b[14],
      firstGen: b[15],
      disability: b[16],

      currentUnits: b[4],

      // Survey / CCCApply self-reported responses
      survey: {
        calworks: b[18],
        singleParent: b[19],
        publicAssistance: b[20],
        foodInsecure: b[21],
        dependency: b[17]
      },

      // FAFSA record (Feature 6)
      fafsa: {
        studentName: name,
        studentId: bannerId,
        fafsaId: fafsaId,
        sai: b[10],
        householdSize: b[6],
        parentIncome: b[9],
        studentIncome: b[8],
        dependency: b[17],
        verification: (idx % 4 === 0) ? "Selected — In Progress" : "Not Selected",
        pellEligible: b[11],
        // EFC only shown for non-Pell / higher SAI records
        efc: b[11] ? 0 : Math.max(0, Math.round(b[10] * 1.15))
      },

      // Banner student record (Feature 7)
      banner: {
        studentId: bannerId,
        major: b[1],
        academicStanding:
          b[2] >= 3.0 ? (b[2] >= 3.5 ? "Dean's List" : "Good Standing")
                      : (b[2] >= 2.0 ? "Good Standing" : "Academic Probation"),
        currentUnits: b[4],
        completedUnits: b[3],
        advisor: ADVISORS[i % ADVISORS.length],
        registrationStatus: "Registered — Fall 2026",
        residency: b[5],
        holds: (b[2] < 2.0) ? ["Academic Progress Advising Hold"]
                            : (idx % 6 === 0 ? ["Immunization Records Hold"] : []),
        degreeObjective: "Associate Degree for Transfer (ADT)",
        expectedGraduation: (b[3] >= 24) ? "Spring 2027" : "Spring 2028"
      },

      // CCCApply record
      cccApply: {
        applicationId: "CCC" + pad(700000 + idx * 53, 6),
        termApplied: "Fall 2026",
        enrollmentGoal: "Transfer to a 4-year institution",
        highSchoolStatus: "Received high school diploma",
        firstGeneration: b[15]
      },

      financialAidStatus: b[11]
        ? "Pell Grant Awarded — Disbursing"
        : (b[10] < 3000 ? "Aid Offered — Action Needed" : "Not Eligible for Need-Based Aid"),

      // program decisions made in-session (Feature 3)
      decisions: {}
    };

    return s;
  });

  var STUDENTS_BY_ID = {};
  STUDENTS.forEach(function (s) { STUDENTS_BY_ID[s.id] = s; });

  /* --------------------------------------------------------------------------
     3. PROGRAM MATCHING (Feature 2)
        Returns { qualified:[], almost:[], not:[] } of program view-models
        for a given student, computed live from the rules above.
  -------------------------------------------------------------------------- */
  function matchPrograms(student) {
    var out = { qualified: [], almost: [], not: [] };
    PROGRAMS.forEach(function (p) {
      var status = p.qualifies(student);
      var vm = {
        id: p.id,
        name: p.name,
        shortName: p.shortName,
        status: status,
        funding: p.funding,
        deadline: p.deadline,
        counseling: p.counseling,
        academic: p.academic,
        career: p.career,
        process: p.process,
        about: p.about,
        missing: status === "almost" ? p.almostMissing : "",
        reason: status === "not" ? p.notReason : "",
        satisfied: buildSatisfied(p, student, status),
        decision: student.decisions[p.id] || null
      };
      out[status].push(vm);
    });
    return out;
  }

  // Human-readable "requirements satisfied" bullets per program/student.
  function buildSatisfied(p, s, status) {
    if (status === "not") return [];
    var list = [];
    if (s.pellEligible) list.push("Pell Grant eligible");
    if (s.householdIncome <= 45000) list.push("Household income within program limits ($" + fmtMoney(s.householdIncome) + ")");
    if (s.firstGen) list.push("First-generation college student");
    if (s.currentUnits >= 12) list.push("Enrolled full-time (" + s.currentUnits + " units)");
    if (p.id === "nextup" && s.fosterYouth) list.push("Verified foster-youth status");
    if (p.id === "vrc" && s.veteran) list.push("Verified veteran / service member");
    if (p.id === "dsps" && s.disability) list.push("Disability accommodations on file");
    if (p.id === "calworks" && s.survey.calworks) list.push("Active CalWORKs cash aid");
    if (p.id === "basicneeds" && s.homeless) list.push("Reported housing insecurity");
    if (!list.length) list.push("Meets baseline enrollment requirements");
    return list;
  }

  /* --------------------------------------------------------------------------
     4. PRIORITY ENGINE (Feature 8)
        Weighted, in the required order:
        Homeless > Foster Youth > Lowest SAI > Pell > Household Income >
        Household Size > Veteran > First Generation > Disability.
        Lower SAI => significantly higher priority.
  -------------------------------------------------------------------------- */
  var W = {
    homeless: 1000,
    foster: 500,
    sai: 250,      // scaled by how low the SAI is
    pell: 120,
    income: 100,   // scaled by how low the income is
    household: 60, // scaled by size
    veteran: 40,
    firstGen: 25,
    disability: 15
  };

  var SAI_MIN = -1500, SAI_MAX = 6000, INCOME_CAP = 150000;

  function priorityScore(s) {
    var score = 0;
    var reasons = [];

    if (s.homeless) { score += W.homeless; reasons.push("Experiencing homelessness"); }
    if (s.fosterYouth) { score += W.foster; reasons.push("Current/former foster youth"); }

    // Lower SAI -> higher score. Clamp into range first.
    var sai = Math.max(SAI_MIN, Math.min(SAI_MAX, s.fafsa.sai));
    var saiComponent = ((SAI_MAX - sai) / (SAI_MAX - SAI_MIN)) * W.sai;
    score += saiComponent;
    reasons.push("SAI " + s.fafsa.sai + (s.fafsa.sai < 0 ? " (maximum need)" : ""));

    if (s.pellEligible) { score += W.pell; reasons.push("Pell eligible"); }

    var incomeComponent = (Math.max(0, INCOME_CAP - s.householdIncome) / INCOME_CAP) * W.income;
    score += incomeComponent;
    reasons.push("Household income $" + fmtMoney(s.householdIncome));

    var hh = Math.min(8, s.householdSize);
    score += (hh / 8) * W.household;
    if (s.householdSize >= 5) reasons.push("Large household (" + s.householdSize + ")");

    if (s.veteran) { score += W.veteran; reasons.push("Veteran / service member"); }
    if (s.firstGen) { score += W.firstGen; reasons.push("First-generation"); }
    if (s.disability) { score += W.disability; reasons.push("Disability accommodations"); }

    return { score: Math.round(score), reasons: reasons };
  }

  // Returns students sorted highest -> lowest priority, annotated with
  // .priority { score, reasons, level, note }.
  function rankStudents(list) {
    var ranked = (list || STUDENTS).map(function (s) {
      var p = priorityScore(s);
      return { student: s, score: p.score, reasons: p.reasons };
    });
    ranked.sort(function (a, b) { return b.score - a.score; });

    var n = ranked.length;
    ranked.forEach(function (r, i) {
      // 5 priority bands across the sorted list.
      var level = Math.min(5, Math.floor((i / n) * 5) + 1);
      var note = "";
      if (r.student.fafsa.sai >= 3500) {
        note = "SAI is 3,500+ — may qualify depending on funding availability.";
      }
      r.level = level;
      r.note = note;
      // attach to the student object too, for convenience
      r.student.priority = { score: r.score, reasons: r.reasons, level: level, note: note, rank: i + 1 };
    });
    return ranked;
  }

  /* --------------------------------------------------------------------------
     5. FORMAT HELPERS (shared by UI + generated documents)
  -------------------------------------------------------------------------- */
  function fmtMoney(n) {
    return Number(n).toLocaleString("en-US");
  }
  function todayStr() {
    var d = new Date();
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }

  // Compute matches + priority once up front so consumers have data ready.
  rankStudents(STUDENTS);
  STUDENTS.forEach(function (s) { s.matches = matchPrograms(s); });

  /* --------------------------------------------------------------------------
     EXPORT
  -------------------------------------------------------------------------- */
  window.TAFT = {
    PROGRAMS: PROGRAMS,
    PROGRAMS_BY_ID: PROGRAMS_BY_ID,
    STUDENTS: STUDENTS,
    STUDENTS_BY_ID: STUDENTS_BY_ID,
    matchPrograms: matchPrograms,
    priorityScore: priorityScore,
    rankStudents: rankStudents,
    fmtMoney: fmtMoney,
    todayStr: todayStr
  };
})();
