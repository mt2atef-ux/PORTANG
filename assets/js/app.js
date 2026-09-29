/**
 * Portage Assessment & IEP Application Logic
 * Portage Early Education System (FTDA Accredited)
 * Includes Multi-Specialist Accounts, Isolated Child Databases, Historical Progress Tracking, and Per-Skill Administration Guides
 */

// Application State with Multi-Specialist Architecture
const AppState = {
  // Collection of Specialist Accounts
  specialists: {
    "spec_1": {
      id: "spec_1",
      name: "أ. منى زكي",
      title: "أخصائية تربية خاصة وتعديل سلوك",
      center: "مركز التنمية الشاملة للطفل",
      phone: "01012345678",
      createdAt: "2025-01-10"
    },
    "spec_2": {
      id: "spec_2",
      name: "د. خالد النجار",
      title: "استشاري أمراض التخاطب والتأهيل النمائي",
      center: "عيادة الأمل للتأهيل التخصصي",
      phone: "01198765432",
      createdAt: "2025-02-15"
    }
  },
  activeSpecialistId: "spec_1",

  // Specialist-specific Child Databases: Map of specialistId -> { childId -> childObject }
  specialistStores: {},

  // Current Active Specialist's Children Collection
  children: {},
  activeChildId: "demo_child_1",
  
  // Current active evaluation workspace
  child: {
    id: "demo_child_1",
    name: "يوسف أحمد السعيد",
    dob: "2023-03-15",
    evalDate: new Date().toISOString().split('T')[0],
    gender: "male",
    specialist: "أ. منى زكي (أخصائية تربية خاصة)",
    notes: "يعاني الطفل من تأخر بسيط في النمو اللغوي والاندماج الاجتماعي مع مهارات حركية جيدة.",
    chronologicalAgeMonths: 0,
    chronologicalAgeFormatted: "",
    sessions: []
  },
  
  currentDomainId: "social",
  currentAgeFilter: "auto_child_age",
  autoFilterByAge: true,
  
  // Map of skillKey -> status ('acquired', 'emerging', 'missing')
  evaluations: {},
  iepSelectedGoals: new Set(),
  theme: localStorage.getItem('portage_theme') || 'light'
};

function getChildAgeGroupIndex(chronologicalAgeMonths) {
  if (chronologicalAgeMonths <= 0) return 0;
  if (chronologicalAgeMonths < 12) return 0; // 0-1
  if (chronologicalAgeMonths < 24) return 1; // 1-2
  if (chronologicalAgeMonths < 36) return 2; // 2-3
  if (chronologicalAgeMonths < 48) return 3; // 3-4
  if (chronologicalAgeMonths < 60) return 4; // 4-5
  return 5; // 5-6
}

let timelineChartInstance = null;
let radarChartInstance = null;
let barChartInstance = null;

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadSavedState();
  initEventListeners();
  renderSpecialistSelectDropdown();
  renderSpecialistSummaryCard();
  renderChildSelectDropdown();
  renderChildrenDirectoryTable();
  renderDomainButtons();
  renderAssessmentView();
  updateChronologicalAge();
  calculateAllResults();
});

// Theme Management
function initTheme() {
  document.documentElement.setAttribute('data-theme', AppState.theme);
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn) {
    themeToggleBtn.innerHTML = AppState.theme === 'dark' 
      ? '<i class="fas fa-sun"></i> النهاري' 
      : '<i class="fas fa-moon"></i> الليلي';
  }
}

function toggleTheme() {
  AppState.theme = AppState.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('portage_theme', AppState.theme);
  initTheme();
  if (radarChartInstance) renderCharts();
  if (timelineChartInstance) renderTimelineChart();
}

// Event Listeners
function initEventListeners() {
  // Theme Button
  document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);

  // Tabs Navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      switchTab(tabId);
    });
  });

  // Active Specialist Select Change
  document.getElementById('activeSpecialistSelect')?.addEventListener('change', (e) => {
    switchActiveSpecialist(e.target.value);
  });

  // Specialist Modal Open Button
  document.getElementById('btnOpenSpecialistModal')?.addEventListener('click', () => {
    renderSpecialistModalList();
    openModal('specialistModal');
  });

  // Active Child Select Change
  document.getElementById('activeChildSelect')?.addEventListener('change', (e) => {
    switchActiveChild(e.target.value);
  });

  // Add Child Modal Button
  document.getElementById('btnAddNewChildModal')?.addEventListener('click', () => {
    const spec = AppState.specialists[AppState.activeSpecialistId];
    const specInput = document.getElementById('newChildSpecialistInput');
    if (specInput && spec) specInput.value = spec.name;
    openModal('newChildModal');
  });

  // Child Info Form inputs
  const childInputs = ['childName', 'childDob', 'evalDate', 'childGender', 'specialistName', 'evalNotes'];
  childInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', handleChildInfoChange);
      el.addEventListener('change', handleChildInfoChange);
    }
  });

  // Quick Action Buttons
  document.getElementById('btnMarkAllAcquired')?.addEventListener('click', () => markDomainSkills('acquired'));
  document.getElementById('btnMarkAllMissing')?.addEventListener('click', () => markDomainSkills('missing'));
  document.getElementById('btnResetDomain')?.addEventListener('click', () => markDomainSkills(null));

  // Search skills input
  document.getElementById('searchSkillInput')?.addEventListener('input', (e) => {
    filterSkills(e.target.value);
  });

  // Search children directory input
  document.getElementById('searchChildrenDirectoryInput')?.addEventListener('input', (e) => {
    renderChildrenDirectoryTable(e.target.value);
  });

  // History / Timeline Session Save
  document.getElementById('btnSaveCurrentSession')?.addEventListener('click', saveCurrentSessionToHistory);

  // Export / Import / Print
  document.getElementById('btnPrintReport')?.addEventListener('click', triggerPrintReport);
  document.getElementById('btnExportJson')?.addEventListener('click', exportAssessmentJSON);
  document.getElementById('btnImportJson')?.addEventListener('click', () => document.getElementById('importFileInput').click());
  document.getElementById('importFileInput')?.addEventListener('change', importAssessmentJSON);

  // Demo Data Button
  document.getElementById('btnLoadDemoData')?.addEventListener('click', loadDemoData);
}

// Modal Helpers
function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add('open');
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove('open');
}

// Switch Tab
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-view').forEach(view => {
    view.classList.toggle('active', view.id === `tab-${tabId}`);
  });

  if (tabId === 'intake') {
    renderChildrenDirectoryTable();
    renderSpecialistSummaryCard();
  } else if (tabId === 'results') {
    calculateAllResults();
    setTimeout(renderCharts, 100);
  } else if (tabId === 'history') {
    renderHistoryTab();
  } else if (tabId === 'iep') {
    renderIEPPlan();
  } else if (tabId === 'report') {
    renderOfficialReport();
  }
}

// ==========================================================
// SPECIALISTS MANAGEMENT & ISOLATED DATABASE ENGINES
// ==========================================================

function renderSpecialistSelectDropdown() {
  const select = document.getElementById('activeSpecialistSelect');
  if (!select) return;

  select.innerHTML = Object.values(AppState.specialists).map(spec => `
    <option value="${spec.id}" ${spec.id === AppState.activeSpecialistId ? 'selected' : ''}>
      ${spec.name} (${spec.title.split(' ')[0]})
    </option>
  `).join('');
}

function renderSpecialistSummaryCard() {
  const spec = AppState.specialists[AppState.activeSpecialistId];
  if (!spec) return;

  const nameEl = document.getElementById('currentSpecialistNameDisplay');
  if (nameEl) nameEl.textContent = spec.name;

  const titleBadge = document.getElementById('currentSpecialistTitleBadge');
  if (titleBadge) titleBadge.textContent = spec.title;

  const centerEl = document.getElementById('currentSpecialistCenterDisplay');
  if (centerEl) centerEl.textContent = `${spec.center || 'عيادة خاصة'} | قاعدة البيانات المستقلة`;

  const totalBadge = document.getElementById('specialistTotalChildrenBadge');
  const count = Object.keys(AppState.children || {}).length;
  if (totalBadge) totalBadge.innerHTML = `<i class="fas fa-children"></i> <strong>${count}</strong> أطفال مسجلين`;
}

function renderSpecialistModalList() {
  const container = document.getElementById('specialistsListModalContainer');
  if (!container) return;

  container.innerHTML = Object.values(AppState.specialists).map(spec => {
    const isActive = spec.id === AppState.activeSpecialistId;
    const childCount = AppState.specialistStores[spec.id] ? Object.keys(AppState.specialistStores[spec.id]).length : 0;

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; background:${isActive ? 'var(--primary-light)' : 'var(--bg-elevated)'}; border:1px solid ${isActive ? 'var(--primary)' : 'var(--border-color)'}; padding:0.75rem 1rem; border-radius:var(--radius-md);">
        <div>
          <div style="font-weight:800; color:var(--text-main); font-size:0.95rem;">
            ${spec.name} ${isActive ? '<span class="badge badge-ftda" style="font-size:0.7rem; margin-right:0.4rem;">الحساب النشط</span>' : ''}
          </div>
          <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.2rem;">
            ${spec.title} | ${spec.center || ''} (${childCount} أطفال)
          </div>
        </div>
        <div style="display:flex; gap:0.4rem;">
          ${!isActive ? `
            <button class="btn btn-primary btn-xs" onclick="switchActiveSpecialist('${spec.id}'); closeModal('specialistModal');">
              <i class="fas fa-check"></i> تفعيل الحساب
            </button>
            <button class="btn btn-outline btn-xs" style="color:var(--danger);" onclick="deleteSpecialistAccount('${spec.id}')" title="حذف حساب الأخصائي">
              <i class="fas fa-trash"></i>
            </button>
          ` : `
            <span style="font-size:0.8rem; color:var(--primary); font-weight:700;">قيد العمل</span>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function handleCreateNewSpecialistSubmit() {
  const name = document.getElementById('newSpecNameInput')?.value.trim();
  const title = document.getElementById('newSpecTitleInput')?.value.trim();
  const center = document.getElementById('newSpecCenterInput')?.value.trim() || "عيادة خاصة";
  const phone = document.getElementById('newSpecPhoneInput')?.value.trim() || "";

  if (!name || !title) {
    alert("يرجى إدخال اسم الأخصائي والمسمى الوظيفي");
    return;
  }

  const newId = "spec_" + Date.now();
  const newSpec = {
    id: newId,
    name: name,
    title: title,
    center: center,
    phone: phone,
    createdAt: new Date().toISOString().split('T')[0]
  };

  AppState.specialists[newId] = newSpec;
  AppState.specialistStores[newId] = {};

  document.getElementById('createSpecialistForm')?.reset();
  closeModal('specialistModal');

  switchActiveSpecialist(newId);
  alert(`تم إنشاء حساب الأخصائي (${name}) بنجاح مع قاعدة بيانات أطفال مستقلة!`);
}

function deleteSpecialistAccount(specId) {
  if (Object.keys(AppState.specialists).length <= 1) {
    alert("لا يمكن حذف الأخصائي الوحيد المتبقي في النظام.");
    return;
  }

  const spec = AppState.specialists[specId];
  if (!confirm(`هل أنت متأكد من حذف حساب الأخصائي (${spec?.name}) وكافة ملفات الأطفال التابعة له؟`)) {
    return;
  }

  delete AppState.specialists[specId];
  delete AppState.specialistStores[specId];

  saveState();
  renderSpecialistModalList();
  renderSpecialistSelectDropdown();
}

function switchActiveSpecialist(specId) {
  if (!AppState.specialists[specId]) return;

  // 1. Save current specialist children store first
  saveCurrentSpecialistStore();

  // 2. Switch Active Specialist
  AppState.activeSpecialistId = specId;
  const spec = AppState.specialists[specId];

  // 3. Load or Initialize this specialist's children database
  if (!AppState.specialistStores[specId] || Object.keys(AppState.specialistStores[specId]).length === 0) {
    const defaultChildId = `child_${specId}_1`;
    const defaultChild = {
      id: defaultChildId,
      name: "طفل جديد (" + spec.name + ")",
      dob: "2023-01-01",
      evalDate: new Date().toISOString().split('T')[0],
      gender: "male",
      specialist: spec.name,
      notes: "",
      chronologicalAgeMonths: 0,
      chronologicalAgeFormatted: "",
      sessions: [],
      currentEvaluations: {},
      currentIepGoals: []
    };
    AppState.specialistStores[specId] = { [defaultChildId]: defaultChild };
  }

  AppState.children = AppState.specialistStores[specId];
  const firstChildId = Object.keys(AppState.children)[0];
  AppState.activeChildId = firstChildId;
  AppState.child = { ...AppState.children[firstChildId] };
  AppState.evaluations = AppState.child.currentEvaluations || {};
  AppState.iepSelectedGoals = new Set(AppState.child.currentIepGoals || []);

  // 4. Update Form Inputs
  document.getElementById('childName').value = AppState.child.name || "";
  document.getElementById('childDob').value = AppState.child.dob || "";
  document.getElementById('evalDate').value = AppState.child.evalDate || new Date().toISOString().split('T')[0];
  document.getElementById('childGender').value = AppState.child.gender || "male";
  document.getElementById('specialistName').value = spec.name;
  document.getElementById('evalNotes').value = AppState.child.notes || "";

  // 5. Refresh UI
  updateChronologicalAge();
  renderSpecialistSelectDropdown();
  renderSpecialistSummaryCard();
  renderChildSelectDropdown();
  renderChildrenDirectoryTable();
  renderDomainButtons();
  renderAssessmentView();
  calculateAllResults();
  saveState();
}

function saveCurrentSpecialistStore() {
  if (!AppState.activeSpecialistId) return;
  saveCurrentChildToMap();
  AppState.specialistStores[AppState.activeSpecialistId] = { ...AppState.children };
}

// ==========================================================
// CHILD PROFILES & DATABASE DIRECTORY MANAGEMENT
// ==========================================================

function renderChildSelectDropdown() {
  const select = document.getElementById('activeChildSelect');
  if (!select) return;

  // If no children in state, initialize with default child
  if (Object.keys(AppState.children).length === 0) {
    const spec = AppState.specialists[AppState.activeSpecialistId];
    const newId = "child_" + Date.now();
    AppState.children[newId] = {
      id: newId,
      name: "طفل جديد",
      dob: "2023-01-01",
      evalDate: new Date().toISOString().split('T')[0],
      gender: "male",
      specialist: spec?.name || "",
      notes: "",
      chronologicalAgeMonths: 0,
      chronologicalAgeFormatted: "",
      sessions: [],
      currentEvaluations: {},
      currentIepGoals: []
    };
    AppState.activeChildId = newId;
    AppState.child = { ...AppState.children[newId] };
  }

  select.innerHTML = Object.values(AppState.children).map(c => `
    <option value="${c.id}" ${c.id === AppState.activeChildId ? 'selected' : ''}>
      ${c.name || 'طفل بدون اسم'}
    </option>
  `).join('');
}

function renderChildrenDirectoryTable(searchQuery = '') {
  const tbody = document.getElementById('specialistChildrenTableBody');
  if (!tbody) return;

  const query = searchQuery.trim().toLowerCase();
  const childrenList = Object.values(AppState.children || {}).filter(c => {
    return !query || (c.name && c.name.toLowerCase().includes(query)) || (c.specialist && c.specialist.toLowerCase().includes(query));
  });

  if (childrenList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">
          لا توجد ملفات أطفال مطابقة في قاعدة بيانات هذا الأخصائي. اضغط على زر "طفل جديد" لإنشاء ملف.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = childrenList.map(c => {
    const isCurrent = c.id === AppState.activeChildId;
    const sessCount = (c.sessions || []).length;
    const lastSession = sessCount > 0 ? c.sessions[sessCount - 1] : null;
    const dqText = lastSession ? `${lastSession.dq}%` : (isCurrent ? `${calculateAllResults().overallDevelopmentalQuotient}%` : '—');

    return `
      <tr style="${isCurrent ? 'background:rgba(79, 70, 229, 0.05); font-weight:700;' : ''}">
        <td>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <i class="fas fa-${c.gender === 'female' ? 'venus' : 'mars'}" style="color:${c.gender === 'female' ? 'var(--domain-infant)' : 'var(--domain-social)'};"></i>
            <strong>${c.name || 'طفل بدون اسم'}</strong>
            ${isCurrent ? '<span class="badge badge-ftda" style="font-size:0.68rem; padding:0.1rem 0.4rem;">المحدد حالياً</span>' : ''}
          </div>
        </td>
        <td>${c.dob || '—'}</td>
        <td>${c.chronologicalAgeMonths ? c.chronologicalAgeMonths + ' شهر' : '—'}</td>
        <td><span class="badge badge-info">${dqText}</span></td>
        <td><strong>${sessCount}</strong> جلسات</td>
        <td>${c.evalDate || '—'}</td>
        <td>
          <div style="display:flex; gap:0.35rem;">
            <button class="btn btn-xs ${isCurrent ? 'btn-primary' : 'btn-outline'}" onclick="switchActiveChild('${c.id}'); switchTab('assessment');" title="تقييم مهارات هذا الطفل">
              <i class="fas fa-tasks"></i> تقييم
            </button>
            <button class="btn btn-xs btn-outline" onclick="switchActiveChild('${c.id}'); switchTab('report');" title="عرض التقرير الرسمي">
              <i class="fas fa-file-alt"></i> التقرير
            </button>
            <button class="btn btn-xs btn-outline" style="color:var(--danger);" onclick="deleteChildProfile('${c.id}')" title="حذف ملف الطفل">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function switchActiveChild(childId) {
  if (!AppState.children[childId]) return;

  // Save current child state first
  saveCurrentChildToMap();

  // Load new child
  AppState.activeChildId = childId;
  AppState.child = { ...AppState.children[childId] };
  
  // Load evaluations from child profile
  AppState.evaluations = AppState.child.currentEvaluations || {};
  AppState.iepSelectedGoals = new Set(AppState.child.currentIepGoals || []);

  // Sync Form UI
  document.getElementById('childName').value = AppState.child.name || "";
  document.getElementById('childDob').value = AppState.child.dob || "";
  document.getElementById('evalDate').value = AppState.child.evalDate || new Date().toISOString().split('T')[0];
  document.getElementById('childGender').value = AppState.child.gender || "male";
  document.getElementById('specialistName').value = AppState.specialists[AppState.activeSpecialistId]?.name || AppState.child.specialist || "";
  document.getElementById('evalNotes').value = AppState.child.notes || "";

  updateChronologicalAge();
  renderChildSelectDropdown();
  renderChildrenDirectoryTable();
  renderDomainButtons();
  renderAssessmentView();
  calculateAllResults();
  saveState();
}

function handleCreateNewChildSubmit() {
  const name = document.getElementById('newChildNameInput')?.value.trim();
  const dob = document.getElementById('newChildDobInput')?.value;
  const gender = document.getElementById('newChildGenderInput')?.value || "male";
  const spec = AppState.specialists[AppState.activeSpecialistId];
  const specialist = document.getElementById('newChildSpecialistInput')?.value.trim() || spec?.name || "";

  if (!name || !dob) {
    alert("يرجى إدخال اسم الطفل وتاريخ الميلاد");
    return;
  }

  const newId = "child_" + Date.now();
  const newChildObj = {
    id: newId,
    name: name,
    dob: dob,
    evalDate: new Date().toISOString().split('T')[0],
    gender: gender,
    specialist: specialist,
    notes: "",
    chronologicalAgeMonths: 0,
    chronologicalAgeFormatted: "",
    sessions: [],
    currentEvaluations: {},
    currentIepGoals: []
  };

  AppState.children[newId] = newChildObj;
  saveCurrentSpecialistStore();
  closeModal('newChildModal');
  document.getElementById('createNewChildForm')?.reset();
  
  switchActiveChild(newId);
  switchTab('intake');
  alert(`تم إنشاء ملف الطفل (${name}) وإضافته بنجاح لقاعدة بيانات (${spec?.name})!`);
}

function deleteChildProfile(childId) {
  if (Object.keys(AppState.children).length <= 1) {
    alert("يجب أن يحتوي حساب الأخصائي على ملف طفل واحد على الأقل.");
    return;
  }

  const child = AppState.children[childId];
  if (!confirm(`هل أنت متأكد من حذف ملف الطفل (${child?.name || 'المحدد'}) نهائياً؟`)) {
    return;
  }

  delete AppState.children[childId];
  saveCurrentSpecialistStore();
  saveState();

  const remainingIds = Object.keys(AppState.children);
  switchActiveChild(remainingIds[0]);
}

function saveCurrentChildToMap() {
  if (!AppState.activeChildId) return;
  AppState.child.currentEvaluations = { ...AppState.evaluations };
  AppState.child.currentIepGoals = Array.from(AppState.iepSelectedGoals);
  AppState.children[AppState.activeChildId] = { ...AppState.child };
}

// Handle Child Info Form changes
function handleChildInfoChange() {
  AppState.child.name = document.getElementById('childName')?.value || "";
  AppState.child.dob = document.getElementById('childDob')?.value || "";
  AppState.child.evalDate = document.getElementById('evalDate')?.value || "";
  AppState.child.gender = document.getElementById('childGender')?.value || "male";
  AppState.child.specialist = document.getElementById('specialistName')?.value || "";
  AppState.child.notes = document.getElementById('evalNotes')?.value || "";

  updateChronologicalAge();
  saveCurrentChildToMap();
  saveCurrentSpecialistStore();
  saveState();
  renderChildSelectDropdown();
  renderChildrenDirectoryTable();
  updateReportHeader();
}

// Calculate Chronological Age accurately
function updateChronologicalAge() {
  if (!AppState.child.dob || !AppState.child.evalDate) {
    const chip = document.getElementById('chronologicalAgeChip');
    if (chip) chip.innerHTML = '<i class="fas fa-info-circle"></i> يرجى إدخال تاريخ الميلاد وتاريخ التقييم لحساب العمر الزمني';
    AppState.child.chronologicalAgeMonths = 0;
    AppState.child.chronologicalAgeFormatted = "غير محدد";
    return;
  }

  const birth = new Date(AppState.child.dob);
  const evalD = new Date(AppState.child.evalDate);

  if (evalD < birth) {
    const chip = document.getElementById('chronologicalAgeChip');
    if (chip) chip.innerHTML = '<i class="fas fa-exclamation-triangle" style="color:var(--danger)"></i> تاريخ التقييم يسبق تاريخ الميلاد!';
    return;
  }

  let years = evalD.getFullYear() - birth.getFullYear();
  let months = evalD.getMonth() - birth.getMonth();
  let days = evalD.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthLastDay = new Date(evalD.getFullYear(), evalD.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalExactMonths = (years * 12) + months + (days / 30.4375);
  AppState.child.chronologicalAgeMonths = parseFloat(totalExactMonths.toFixed(1));
  AppState.child.chronologicalAgeFormatted = `${years} سنة و ${months} شهر و ${days} يوم (${AppState.child.chronologicalAgeMonths} شهر)`;

  // Automatically set active age filter to match child's chronological age
  const childAgeGroupIdx = getChildAgeGroupIndex(AppState.child.chronologicalAgeMonths);
  if (AppState.autoFilterByAge) {
    AppState.currentAgeFilter = String(childAgeGroupIdx);
  }

  const chip = document.getElementById('chronologicalAgeChip');
  if (chip) {
    chip.innerHTML = `<i class="fas fa-birthday-cake"></i> العمر الزمني للطفل: <strong>${years} سنة، ${months} شهر، ${days} يوم</strong> (الإجمالي: ${AppState.child.chronologicalAgeMonths} شهر) — <span style="color:var(--primary); font-weight:800;"><i class="fas fa-filter"></i> الفئة العمرية المطابقة: الفئة ${childAgeGroupIdx + 1}</span>`;
  }
}

// Render Domain Selection Cards
function renderDomainButtons() {
  const container = document.getElementById('domainButtonsContainer');
  if (!container) return;

  container.innerHTML = PORTAGE_DATA.domains.map(domain => {
    const stats = getDomainStats(domain.id);
    const percentage = stats.total > 0 ? Math.round((stats.acquired / stats.total) * 100) : 0;
    const isActive = domain.id === AppState.currentDomainId;

    return `
      <div class="domain-card-btn ${isActive ? 'active' : ''}" onclick="selectDomain('${domain.id}')" style="--domain-color: ${domain.color}">
        <div class="domain-btn-header">
          <div class="domain-btn-icon" style="background-color: ${domain.color}">
            <i class="fas fa-${domain.icon}"></i>
          </div>
          <span class="badge" style="background:${domain.color}15; color:${domain.color}; font-size:0.75rem;">
            ${stats.acquired} / ${stats.total}
          </span>
        </div>
        <h3>${domain.name}</h3>
        <div class="domain-progress-mini">
          <div class="domain-progress-bar" style="width: ${percentage}%; background-color: ${domain.color}"></div>
        </div>
        <div class="domain-stats-text">
          <span>نسبة الإنجاز</span>
          <strong>${percentage}%</strong>
        </div>
      </div>
    `;
  }).join('');
}

function selectDomain(domainId) {
  AppState.currentDomainId = domainId;
  if (AppState.autoFilterByAge) {
    const childAgeGroupIdx = getChildAgeGroupIndex(AppState.child.chronologicalAgeMonths || 0);
    AppState.currentAgeFilter = String(childAgeGroupIdx);
  }
  renderDomainButtons();
  renderAssessmentView();
}

// Render Assessment View for Current Domain
function renderAssessmentView() {
  const domain = PORTAGE_DATA.domains.find(d => d.id === AppState.currentDomainId);
  if (!domain) return;

  const childAgeGroupIdx = getChildAgeGroupIndex(AppState.child.chronologicalAgeMonths || 0);
  const childMatchedGroup = domain.ageGroups[childAgeGroupIdx] || domain.ageGroups[0];

  // Set Domain Title
  const titleEl = document.getElementById('currentDomainTitle');
  if (titleEl) {
    titleEl.innerHTML = `<i class="fas fa-${domain.icon}" style="color:${domain.color}"></i> تقييم: ${domain.name}`;
  }

  // Render Age Filter Chips with prominent Child Age Button
  const filterContainer = document.getElementById('ageFilterChipsContainer');
  if (filterContainer) {
    const isChildAgeActive = AppState.currentAgeFilter === String(childAgeGroupIdx) && AppState.autoFilterByAge;

    let chipsHtml = `
      <button class="filter-chip ${isChildAgeActive ? 'active' : ''}" 
              style="${isChildAgeActive ? 'background:linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); font-weight:800;' : 'border-color:var(--primary); color:var(--primary);'}" 
              onclick="filterByChildAgeOnly(${childAgeGroupIdx})" 
              title="عرض بنود الفئة العمرية المطابقة لعمر الطفل فقط">
        🎯 فئة عمر الطفل فقط (${childMatchedGroup.ageLabel})
      </button>
      <button class="filter-chip ${AppState.currentAgeFilter === 'all' ? 'active' : ''}" onclick="filterByAgeGroup('all')">
        عرض جميع الفئات (0-6 سنوات)
      </button>
    `;

    domain.ageGroups.forEach((group, idx) => {
      const isSelected = AppState.currentAgeFilter === String(idx) && !AppState.autoFilterByAge;
      const isTargetAge = idx === childAgeGroupIdx;
      chipsHtml += `
        <button class="filter-chip ${isSelected ? 'active' : ''}" onclick="filterBySpecificAgeGroup('${idx}')">
          ${group.ageLabel} ${isTargetAge ? '⭐' : ''} (${group.skills.length})
        </button>
      `;
    });
    filterContainer.innerHTML = chipsHtml;
  }

  // Render Accordions for each Age Group (filtered to child's age group if active)
  const accordionContainer = document.getElementById('skillsAccordionContainer');
  if (!accordionContainer) return;

  accordionContainer.innerHTML = domain.ageGroups.map((group, groupIndex) => {
    // If filtering by specific age, hide non-matching groups
    if (AppState.currentAgeFilter !== 'all' && AppState.currentAgeFilter !== String(groupIndex)) {
      return '';
    }

    const groupStats = getAgeGroupStats(domain.id, groupIndex, group.skills);
    const denominator = domain.denominators[groupIndex] || group.totalSkills;
    const devMonths = ((groupStats.acquired / denominator) * 12).toFixed(2);
    const isChildAgeGroup = groupIndex === childAgeGroupIdx;

    return `
      <div class="age-group-accordion open" id="accordion-${domain.id}-${groupIndex}" style="${isChildAgeGroup ? 'border: 2px solid var(--primary); box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15);' : ''}">
        <div class="accordion-header" onclick="toggleAccordion('${domain.id}-${groupIndex}')">
          <div class="accordion-title-group">
            <span class="badge" style="background:${domain.color}20; color:${domain.color}">
              ${isChildAgeGroup ? '🎯 فئة عمر الطفل المطابقة' : 'الفئة ' + (groupIndex + 1)}
            </span>
            <span class="accordion-title">${group.ageLabel}</span>
            <span class="accordion-stats">المكتسب: ${groupStats.acquired} من ${group.totalSkills}</span>
          </div>
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <span class="calc-formula-badge">العمر التطوري لهذه السنة: <strong>${devMonths} شهر</strong></span>
            <i class="fas fa-chevron-down accordion-chevron"></i>
          </div>
        </div>
        <div class="accordion-content">
          <div class="skills-list">
            ${group.skills.map(skill => {
              const skillKey = `${domain.id}_${groupIndex}_${skill.id}`;
              const status = AppState.evaluations[skillKey] || 'none';
              const escapedSkillText = skill.text.replace(/'/g, "\\'");

              return `
                <div class="skill-item ${status !== 'none' ? 'status-' + status : ''}" id="skill-row-${skillKey}">
                  <div class="skill-info">
                    <span class="skill-number">${skill.id}</span>
                    <span class="skill-text">${skill.text}</span>
                    <button type="button" class="skill-help-btn" title="دليل التقييم وشرح النماذج" 
                            onclick="openSkillGuide('${domain.id}', ${groupIndex}, ${skill.id}, '${escapedSkillText}', '${group.ageLabel}')">
                      <i class="fas fa-question"></i>
                    </button>
                  </div>
                  <div class="skill-status-controls">
                    <button type="button" class="status-btn ${status === 'acquired' ? 'active' : ''}" 
                            data-status="acquired" 
                            title="مكتسب (+)" 
                            onclick="setSkillStatus('${skillKey}', 'acquired')">
                      <i class="fas fa-check"></i> مكتسب (+)
                    </button>
                    <button type="button" class="status-btn ${status === 'emerging' ? 'active' : ''}" 
                            data-status="emerging" 
                            title="بزوغ / قيد التدريب (±)" 
                            onclick="setSkillStatus('${skillKey}', 'emerging')">
                      <i class="fas fa-adjust"></i> قيد التدريب (±)
                    </button>
                    <button type="button" class="status-btn ${status === 'missing' ? 'active' : ''}" 
                            data-status="missing" 
                            title="غير مكتسب / مفقود (-)" 
                            onclick="setSkillStatus('${skillKey}', 'missing')">
                      <i class="fas fa-times"></i> غير مكتسب (-)
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterByChildAgeOnly(ageIndex) {
  AppState.autoFilterByAge = true;
  AppState.currentAgeFilter = String(ageIndex);
  renderAssessmentView();
}

function filterBySpecificAgeGroup(ageIndex) {
  AppState.autoFilterByAge = false;
  AppState.currentAgeFilter = String(ageIndex);
  renderAssessmentView();
}

function filterByAgeGroup(filter) {
  AppState.autoFilterByAge = false;
  AppState.currentAgeFilter = filter;
  renderAssessmentView();
}

// Open Skill Guide Modal with Realistic Examples & Administration Procedure
function openSkillGuide(domainId, groupIndex, skillId, skillText, ageLabel) {
  const domain = PORTAGE_DATA.domains.find(d => d.id === domainId);
  const guide = SKILL_GUIDES.getGuide(domainId, groupIndex, skillId, skillText);

  document.getElementById('modalGuideDomainName').textContent = `${domain?.name || ''} - بند رقم ${skillId}`;
  document.getElementById('modalGuideAgeLabel').textContent = ageLabel;
  document.getElementById('modalGuideSkillText').textContent = skillText;
  document.getElementById('modalGuideObjective').textContent = guide.objective;
  document.getElementById('modalGuideProcedure').textContent = guide.procedure;

  document.getElementById('modalGuideCritAcquired').textContent = guide.criteria.acquired;
  document.getElementById('modalGuideCritEmerging').textContent = guide.criteria.emerging;
  document.getElementById('modalGuideCritMissing').textContent = guide.criteria.missing;

  const examplesList = document.getElementById('modalGuideExamples');
  if (examplesList) {
    examplesList.innerHTML = guide.examples.map(ex => `<li>${ex}</li>`).join('');
  }

  document.getElementById('modalGuideMaterials').textContent = guide.materials;
  document.getElementById('modalGuideTips').textContent = guide.tips;

  openModal('skillGuideModal');
}

// Set Skill Status
function setSkillStatus(skillKey, status) {
  if (AppState.evaluations[skillKey] === status) {
    delete AppState.evaluations[skillKey];
  } else {
    AppState.evaluations[skillKey] = status;
  }
  
  saveCurrentChildToMap();
  saveState();
  renderDomainButtons();
  
  // Update item UI directly
  const row = document.getElementById(`skill-row-${skillKey}`);
  if (row) {
    row.classList.remove('status-acquired', 'status-emerging', 'status-missing');
    const currentStatus = AppState.evaluations[skillKey];
    if (currentStatus) row.classList.add(`status-${currentStatus}`);

    const buttons = row.querySelectorAll('.status-btn');
    buttons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.status === currentStatus);
    });
  }

  // Update Accordion Header calculations
  const [domainId, groupIndex] = skillKey.split('_');
  const domain = PORTAGE_DATA.domains.find(d => d.id === domainId);
  if (domain) {
    const group = domain.ageGroups[parseInt(groupIndex)];
    const groupStats = getAgeGroupStats(domainId, parseInt(groupIndex), group.skills);
    const denominator = domain.denominators[parseInt(groupIndex)] || group.totalSkills;
    const devMonths = ((groupStats.acquired / denominator) * 12).toFixed(2);
    
    const accHeader = document.querySelector(`#accordion-${domainId}-${groupIndex} .accordion-header`);
    if (accHeader) {
      const statsBadge = accHeader.querySelector('.accordion-stats');
      if (statsBadge) statsBadge.textContent = `المكتسب: ${groupStats.acquired} من ${group.totalSkills}`;
      const formulaBadge = accHeader.querySelector('.calc-formula-badge');
      if (formulaBadge) formulaBadge.innerHTML = `العمر التطوري لهذه السنة: <strong>${devMonths} شهر</strong>`;
    }
  }
}

// Quick Actions: Mark all skills in domain
function markDomainSkills(status) {
  const domain = PORTAGE_DATA.domains.find(d => d.id === AppState.currentDomainId);
  if (!domain) return;

  domain.ageGroups.forEach((group, groupIndex) => {
    if (AppState.currentAgeFilter !== 'all' && AppState.currentAgeFilter !== String(groupIndex)) {
      return;
    }
    group.skills.forEach(skill => {
      const skillKey = `${domain.id}_${groupIndex}_${skill.id}`;
      if (status === null) {
        delete AppState.evaluations[skillKey];
      } else {
        AppState.evaluations[skillKey] = status;
      }
    });
  });

  saveCurrentChildToMap();
  saveState();
  renderDomainButtons();
  renderAssessmentView();
}

// Search & Filter skills
function filterSkills(query) {
  const text = query.trim().toLowerCase();
  document.querySelectorAll('.skill-item').forEach(item => {
    const skillText = item.querySelector('.skill-text')?.textContent.toLowerCase() || '';
    if (!text || skillText.includes(text)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
}

// Statistics Helpers
function getAgeGroupStats(domainId, groupIndex, skills) {
  let acquired = 0;
  let emerging = 0;
  let missing = 0;
  let unrated = 0;

  skills.forEach(skill => {
    const skillKey = `${domainId}_${groupIndex}_${skill.id}`;
    const st = AppState.evaluations[skillKey];
    if (st === 'acquired') acquired++;
    else if (st === 'emerging') emerging++;
    else if (st === 'missing') missing++;
    else unrated++;
  });

  return { acquired, emerging, missing, unrated, total: skills.length };
}

function getDomainStats(domainId) {
  const domain = PORTAGE_DATA.domains.find(d => d.id === domainId);
  if (!domain) return { acquired: 0, total: 0 };

  let acquired = 0;
  let total = 0;

  domain.ageGroups.forEach((group, groupIndex) => {
    total += group.skills.length;
    group.skills.forEach(skill => {
      const skillKey = `${domain.id}_${groupIndex}_${skill.id}`;
      if (AppState.evaluations[skillKey] === 'acquired') acquired++;
    });
  });

  return { acquired, total };
}

// Core Portage Calculation Engine
function calculateAllResults() {
  const results = {
    domains: [],
    overallDevAgeMonths: 0,
    overallChronologicalAgeMonths: AppState.child.chronologicalAgeMonths || 0,
    overallDevelopmentalQuotient: 0,
    totalSkillsAcquired: 0,
    totalSkillsAssessed: 0,
    totalSkillsCount: 0
  };

  let mainDomainsDevSum = 0;
  let mainDomainsCount = 0;

  PORTAGE_DATA.domains.forEach(domain => {
    let domainDevAgeMonths = 0;
    let domainAcquiredCount = 0;
    let domainTotalSkills = 0;
    const yearBreakdowns = [];

    domain.ageGroups.forEach((group, gIdx) => {
      const gStats = getAgeGroupStats(domain.id, gIdx, group.skills);
      const denominator = domain.denominators[gIdx] || group.totalSkills;
      
      // Formula: (Acquired / Denominator) * 12
      const yearDevMonths = (gStats.acquired / denominator) * 12;
      
      domainDevAgeMonths += yearDevMonths;
      domainAcquiredCount += gStats.acquired;
      domainTotalSkills += group.totalSkills;

      yearBreakdowns.push({
        groupLabel: group.ageLabel,
        acquired: gStats.acquired,
        denominator: denominator,
        total: group.totalSkills,
        months: yearDevMonths
      });
    });

    const domainAgeMonthsFixed = parseFloat(domainDevAgeMonths.toFixed(2));
    const chronAge = AppState.child.chronologicalAgeMonths || 0;
    
    const dq = chronAge > 0 ? Math.round((domainAgeMonthsFixed / chronAge) * 100) : 100;
    const gapMonths = chronAge > 0 ? parseFloat((chronAge - domainAgeMonthsFixed).toFixed(1)) : 0;

    let delayClassification = "نمو مناسب";
    let delayClass = "delay-normal";
    if (chronAge > 0) {
      if (gapMonths > 12) {
        delayClassification = "تأخر شديد";
        delayClass = "delay-severe";
      } else if (gapMonths >= 6) {
        delayClassification = "تأخر متوسط";
        delayClass = "delay-mild";
      } else if (gapMonths > 2) {
        delayClassification = "تأخر بسيط";
        delayClass = "delay-mild";
      } else if (gapMonths < -2) {
        delayClassification = "تطور متقدم";
        delayClass = "delay-normal";
      }
    }

    const domainResult = {
      id: domain.id,
      name: domain.name,
      icon: domain.icon,
      color: domain.color,
      devAgeMonths: domainAgeMonthsFixed,
      devAgeFormatted: formatMonthsToYears(domainAgeMonthsFixed),
      dq: dq,
      gapMonths: gapMonths,
      delayClassification: delayClassification,
      delayClass: delayClass,
      acquired: domainAcquiredCount,
      total: domainTotalSkills,
      yearBreakdowns: yearBreakdowns
    };

    results.domains.push(domainResult);

    if (domain.id !== 'infant') {
      mainDomainsDevSum += domainAgeMonthsFixed;
      mainDomainsCount++;
    }

    results.totalSkillsAcquired += domainAcquiredCount;
    results.totalSkillsCount += domainTotalSkills;
  });

  results.overallDevAgeMonths = mainDomainsCount > 0 ? parseFloat((mainDomainsDevSum / mainDomainsCount).toFixed(2)) : 0;
  results.overallDevelopmentalQuotient = results.overallChronologicalAgeMonths > 0 
    ? Math.round((results.overallDevAgeMonths / results.overallChronologicalAgeMonths) * 100)
    : 100;

  renderResultsUI(results);
  return results;
}

function formatMonthsToYears(totalMonths) {
  const yrs = Math.floor(totalMonths / 12);
  const m = Math.round(totalMonths % 12);
  if (yrs === 0) return `${m} شهر`;
  if (m === 0) return `${yrs} سنة`;
  return `${yrs} سنة و ${m} شهر`;
}

// Render Results UI Tab
function renderResultsUI(results) {
  const devAgeValEl = document.getElementById('statOverallDevAge');
  if (devAgeValEl) {
    devAgeValEl.textContent = `${results.overallDevAgeMonths} شهر`;
    const subEl = document.getElementById('statOverallDevAgeSub');
    if (subEl) subEl.textContent = `يعادل ${formatMonthsToYears(results.overallDevAgeMonths)}`;
  }

  const dqValEl = document.getElementById('statOverallDQ');
  if (dqValEl) {
    dqValEl.textContent = `${results.overallDevelopmentalQuotient}%`;
  }

  const acquiredValEl = document.getElementById('statTotalAcquired');
  if (acquiredValEl) {
    acquiredValEl.textContent = `${results.totalSkillsAcquired} / ${results.totalSkillsCount}`;
  }

  const tbody = document.getElementById('resultsTableBody');
  if (tbody) {
    tbody.innerHTML = results.domains.map(d => {
      const breakdownTooltip = d.yearBreakdowns.map(y => `[${y.groupLabel}: (${y.acquired}÷${y.denominator})×12 = ${y.months.toFixed(1)}ش]`).join(' + ');

      return `
        <tr>
          <td>
            <div class="domain-name-cell">
              <i class="fas fa-${d.icon}" style="color:${d.color}"></i>
              <strong>${d.name}</strong>
            </div>
          </td>
          <td><strong>${d.devAgeMonths} شهر</strong> (${d.devAgeFormatted})</td>
          <td>${AppState.child.chronologicalAgeMonths || '—'} شهر</td>
          <td>
            <span class="calc-formula-badge" title="${breakdownTooltip}">
              ${d.acquired} / ${d.total} بند
            </span>
          </td>
          <td><strong>${d.dq}%</strong></td>
          <td>
            <span class="delay-badge ${d.delayClass}">
              ${d.delayClassification} (${d.gapMonths > 0 ? '-' + d.gapMonths + ' شهر' : '+' + Math.abs(d.gapMonths) + ' شهر'})
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }
}

// Chart.js Visualizations
function renderCharts() {
  const results = calculateAllResults();
  const isDark = AppState.theme === 'dark';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';

  const primaryDomains = results.domains.filter(d => d.id !== 'infant');
  const labels = primaryDomains.map(d => d.name);
  const devAges = primaryDomains.map(d => d.devAgeMonths);
  const chronAgeArray = primaryDomains.map(() => results.overallChronologicalAgeMonths);

  // 1. Radar Chart
  const radarCtx = document.getElementById('radarChartCanvas')?.getContext('2d');
  if (radarCtx) {
    if (radarChartInstance) radarChartInstance.destroy();

    radarChartInstance = new Chart(radarCtx, {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'العمر التطوري بالشهور',
            data: devAges,
            backgroundColor: 'rgba(79, 70, 229, 0.25)',
            borderColor: '#4f46e5',
            pointBackgroundColor: '#4f46e5',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: '#4f46e5',
            borderWidth: 2
          },
          {
            label: 'العمر الزمني الفعلي',
            data: chronAgeArray,
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            borderColor: '#f59e0b',
            borderDash: [5, 5],
            pointBackgroundColor: '#f59e0b',
            pointBorderColor: '#fff',
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: { color: gridColor },
            grid: { color: gridColor },
            pointLabels: {
              color: textColor,
              font: { family: 'Cairo', size: 12, weight: 'bold' }
            },
            ticks: { color: textColor, backdropColor: 'transparent' }
          }
        },
        plugins: {
          legend: {
            labels: { color: textColor, font: { family: 'Cairo', size: 12 } }
          }
        }
      }
    });
  }

  // 2. Bar Chart
  const barCtx = document.getElementById('barChartCanvas')?.getContext('2d');
  if (barCtx) {
    if (barChartInstance) barChartInstance.destroy();

    barChartInstance = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'العمر التطوري (شهور)',
            data: devAges,
            backgroundColor: primaryDomains.map(d => d.color),
            borderRadius: 6
          },
          {
            label: 'العمر الزمني (شهور)',
            data: chronAgeArray,
            backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { family: 'Cairo' } }
          },
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: { color: textColor, font: { family: 'Cairo' } }
          }
        },
        plugins: {
          legend: {
            labels: { color: textColor, font: { family: 'Cairo', size: 12 } }
          }
        }
      }
    });
  }
}

// Session History & Timeline Tracking
function saveCurrentSessionToHistory() {
  const currentResults = calculateAllResults();
  if (!AppState.child.sessions) AppState.child.sessions = [];

  const sessionNum = AppState.child.sessions.length + 1;
  const newSession = {
    sessionId: "sess_" + Date.now(),
    sessionNumber: sessionNum,
    date: AppState.child.evalDate || new Date().toISOString().split('T')[0],
    chronologicalAgeMonths: AppState.child.chronologicalAgeMonths,
    overallDevAgeMonths: currentResults.overallDevAgeMonths,
    dq: currentResults.overallDevelopmentalQuotient,
    totalAcquired: currentResults.totalSkillsAcquired,
    totalSkillsCount: currentResults.totalSkillsCount,
    evaluations: { ...AppState.evaluations },
    results: currentResults
  };

  AppState.child.sessions.push(newSession);
  saveCurrentChildToMap();
  saveState();
  renderHistoryTab();
  alert(`تم حفظ الجلسة رقم (${sessionNum}) في سجل متابعة الطفل بنجاح!`);
}

function renderHistoryTab() {
  const sessions = AppState.child.sessions || [];
  const tbody = document.getElementById('sessionsHistoryTableBody');
  
  if (tbody) {
    if (sessions.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">
            لا توجد جلسات تقييم سابقة محفوظة لهذا الطفل. اضغط على زر "حفظ الجلسة الحالية في سجل الطفل" لتوثيق جلسة تقييم.
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = sessions.map((sess, idx) => `
        <tr>
          <td><strong>جلسة ${sess.sessionNumber || (idx + 1)}</strong></td>
          <td>${sess.date}</td>
          <td>${sess.chronologicalAgeMonths} شهر</td>
          <td><strong>${sess.overallDevAgeMonths} شهر</strong></td>
          <td><span class="badge badge-info">${sess.dq}%</span></td>
          <td>${sess.totalAcquired} / ${sess.totalSkillsCount}</td>
          <td>
            <button class="btn btn-xs btn-outline" onclick="loadHistoricalSession('${sess.sessionId}')" title="استرجاع تقييم هذه الجلسة">
              <i class="fas fa-eye"></i> استعراض
            </button>
            <button class="btn btn-xs btn-outline" style="color:var(--danger)" onclick="deleteHistoricalSession('${sess.sessionId}')" title="حذف الجلسة">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `).join('');
    }
  }

  renderTimelineChart();
}

function renderTimelineChart() {
  const sessions = AppState.child.sessions || [];
  const timelineCtx = document.getElementById('timelineChartCanvas')?.getContext('2d');
  if (!timelineCtx) return;

  const isDark = AppState.theme === 'dark';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';

  if (timelineChartInstance) timelineChartInstance.destroy();

  // If no sessions, render with current point
  const labels = sessions.length > 0 ? sessions.map(s => `جلسة ${s.sessionNumber || ''} (${s.date})`) : ['التقييم الحالي'];
  const devAges = sessions.length > 0 ? sessions.map(s => s.overallDevAgeMonths) : [AppState.child.chronologicalAgeMonths || 0];
  const chronAges = sessions.length > 0 ? sessions.map(s => s.chronologicalAgeMonths) : [AppState.child.chronologicalAgeMonths || 0];

  timelineChartInstance = new Chart(timelineCtx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'العمر التطوري (شهور)',
          data: devAges,
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79, 70, 229, 0.2)',
          fill: true,
          tension: 0.3,
          pointRadius: 6,
          pointHoverRadius: 8
        },
        {
          label: 'العمر الزمني (شهور)',
          data: chronAges,
          borderColor: '#f59e0b',
          borderDash: [5, 5],
          backgroundColor: 'transparent',
          pointRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'Cairo' } }
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'Cairo' } }
        }
      },
      plugins: {
        legend: {
          labels: { color: textColor, font: { family: 'Cairo', size: 12 } }
        }
      }
    }
  });
}

function loadHistoricalSession(sessionId) {
  const session = (AppState.child.sessions || []).find(s => s.sessionId === sessionId);
  if (!session) return;

  AppState.evaluations = { ...session.evaluations };
  AppState.child.evalDate = session.date;
  document.getElementById('evalDate').value = session.date;

  updateChronologicalAge();
  saveCurrentChildToMap();
  saveState();
  renderDomainButtons();
  renderAssessmentView();
  calculateAllResults();
  switchTab('results');
  alert(`تم استرجاع جلسة التقييم المؤرخة في: ${session.date}`);
}

function deleteHistoricalSession(sessionId) {
  if (!confirm("هل أنت متأكد من حذف هذه الجلسة من السجل؟")) return;
  AppState.child.sessions = (AppState.child.sessions || []).filter(s => s.sessionId !== sessionId);
  saveCurrentChildToMap();
  saveState();
  renderHistoryTab();
}

// Individualized Educational Plan (IEP) Generator
function renderIEPPlan() {
  const container = document.getElementById('iepGoalsContainer');
  if (!container) return;

  const candidateGoals = [];

  PORTAGE_DATA.domains.forEach(domain => {
    domain.ageGroups.forEach((group, gIdx) => {
      group.skills.forEach(skill => {
        const skillKey = `${domain.id}_${gIdx}_${skill.id}`;
        const status = AppState.evaluations[skillKey];

        if (status === 'missing' || status === 'emerging') {
          candidateGoals.push({
            key: skillKey,
            domainId: domain.id,
            domainName: domain.name,
            domainColor: domain.color,
            domainIcon: domain.icon,
            ageLabel: group.ageLabel,
            ageIndex: gIdx,
            skillId: skill.id,
            skillText: skill.text,
            status: status,
            priority: status === 'emerging' ? 'أولوية فورية (مهارة في طور البزوغ)' : (gIdx <= 2 ? 'أولوية عالية (قاعدة نمائية)' : 'أولوية متوسطة')
          });
        }
      });
    });
  });

  candidateGoals.sort((a, b) => {
    if (a.status === 'emerging' && b.status !== 'emerging') return -1;
    if (b.status === 'emerging' && a.status !== 'emerging') return 1;
    return a.ageIndex - b.ageIndex;
  });

  const totalMissing = candidateGoals.length;
  const summaryEl = document.getElementById('iepSummaryText');
  if (summaryEl) {
    summaryEl.innerHTML = `تم استخراج <strong>${totalMissing} هدف نمائي</strong> يحتاج الطفل إلى اكتسابه أو تثبيته. تم ترتيب الأهداف بدءاً من المهارات قيد البزوغ والمهارات الأساسية المبكرة.`;
  }

  if (candidateGoals.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-muted);">
        <i class="fas fa-award fa-3x" style="color:var(--success); margin-bottom:1rem;"></i>
        <h3>لا توجد مهارات مفقودة مسجلة حتى الآن</h3>
        <p>قم بتقييم مهارات الطفل وتحديد المهارات غير المكتسبة (-) أو قيد التدريب (±) لاستخراج الخطة التربوية الفردية تلقائياً.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = candidateGoals.map((goal) => {
    const isSelected = AppState.iepSelectedGoals.has(goal.key);
    const suggestedStrategy = generateTrainingStrategy(goal);
    const escapedSkillText = goal.skillText.replace(/'/g, "\\'");

    return `
      <div class="goal-card" style="border-right: 4px solid ${goal.domainColor}">
        <div class="goal-header">
          <span class="goal-domain-badge" style="background-color: ${goal.domainColor}">
            <i class="fas fa-${goal.domainIcon}"></i> ${goal.domainName}
          </span>
          <span class="badge ${goal.status === 'emerging' ? 'badge-info' : 'badge-ftda'}">
            ${goal.priority}
          </span>
        </div>
        <h4 class="goal-title">${goal.skillId}. ${goal.skillText}</h4>
        
        <div class="goal-meta">
          <div><i class="fas fa-layer-group"></i> <strong>الفئة المستهدفة:</strong> ${goal.ageLabel}</div>
          <div><i class="fas fa-lightbulb"></i> <strong>الاستراتيجية التدريبية المقترحة:</strong> ${suggestedStrategy.strategy}</div>
          <div><i class="fas fa-tools"></i> <strong>الأدوات والوسائل:</strong> ${suggestedStrategy.materials}</div>
          <div><i class="fas fa-home"></i> <strong>توجيهات لولي الأمر:</strong> ${suggestedStrategy.parentTip}</div>
        </div>

        <div class="goal-actions">
          <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer; font-size:0.85rem; font-weight:600;">
            <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleIEPGoalSelection('${goal.key}', this.checked)">
            تضمين في الخطة الرسمية
          </label>
          <button class="btn btn-xs btn-outline" onclick="openSkillGuide('${goal.domainId}', ${goal.ageIndex}, ${goal.skillId}, '${escapedSkillText}', '${goal.ageLabel}')">
            <i class="fas fa-question-circle"></i> دليل المهارة
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function generateTrainingStrategy(goal) {
  const domainStrategies = {
    social: {
      strategy: "النمذجة والتقليد والتعزيز الإيجابي الفوري مع توفير فرص اللعب التفاعلي مع الأقران والأسرة.",
      materials: "ألعاب تفاعلية، مرآة، دمى، معززات رمزية ومادية.",
      parentTip: "شجع الطفل في المواقف اليومية بالمنزل واحتفل بكل محاولة ناجحة."
    },
    language: {
      strategy: "التسمية اللفظية المتكررة، التوسع في جمل الطفل، واستخدام الحث اللفظي والبصري مع خفض الحث تدريجياً.",
      materials: "بطاقات مصورة، كتب قصصية ملونة، مجسمات حقيقية، ألعاب صوتية.",
      parentTip: "تحدث مع طفلك باستمرار واسأله أسئلة مفتوحة وامنحه وقتاً كافياً للإجابة."
    },
    selfHelp: {
      strategy: "تحليل المهمة (Task Analysis) إلى خطوات صغيرة وتطبيق التدريب المتسلسل (الحث الجسدي ثم الإيمائي).",
      materials: "أدوات مائدة بلاستيكية، ملابس ذات سحابات وأزرار سهلة، مجسمات تنظيف الأسنان.",
      parentTip: "امنح الطفل فرصة الاعتماد على نفسه في المهام اليومية مع الصبر وعدم الاستعجال بمساعدته."
    },
    cognitive: {
      strategy: "التدريب الحسي المتعدد والتعليم بالمطابقة والتصنيف عبر اللعب الاستكشافي الموجه.",
      materials: "مكعبات، لوحات أوتاد، أشكال هندسية، بطاقات تطابق، خرز وخيوط.",
      parentTip: "دمج المفاهيم (الألوان، الأحجام، الأعداد) أثناء أنشطة الحياة اليومية كإعداد المائدة أو ترتيب الألعاب."
    },
    motor: {
      strategy: "التدريب الحركي المتدرج من الحركات الكبرى إلى الدقيقة مع تمارين التوازن والتآزر البصري الحركي.",
      materials: "كرات بأحجام مختلفة، خرز، مقصات آمنة، صلصال، حبال قفز، ألواح توازن.",
      parentTip: "وفر للطفل بيئة آمنة في المنزل أو الحديقة لممارسة الجري والقفز واستخدام الصلصال والقص واللصق."
    },
    infant: {
      strategy: "الإثارة الحسية المتوازنة (بصرية، سمعية، لمسية) والتفاعل الحميمي والتدليك اللطيف.",
      materials: "شخشيخة، ألعاب تصدر أصواتاً، إضاءات ناعمة، أقمشة ذات ملامس مختلفة.",
      parentTip: "الاستجابة الفورية لمناغاة وبكاء الرضيع وتوفير تواصل بصري وجلدي مستمر."
    }
  };

  return domainStrategies[goal.domainId] || {
    strategy: "النمذجة والتعزيز الإيجابي مع التدريب المتدرج وتوفير الأدوات المناسبة.",
    materials: "وسائل تعليمية وأدوات بيئية مألوفة.",
    parentTip: "الممارسة اليومية والتكرار الإيجابي."
  };
}

function toggleIEPGoalSelection(goalKey, isChecked) {
  if (isChecked) {
    AppState.iepSelectedGoals.add(goalKey);
  } else {
    AppState.iepSelectedGoals.delete(goalKey);
  }
  saveCurrentChildToMap();
  saveState();
}

// Update Printable Report Header Information
function updateReportHeader() {
  const nameEl = document.getElementById('reportChildName');
  if (nameEl) nameEl.textContent = AppState.child.name || "—";

  const dobEl = document.getElementById('reportChildDob');
  if (dobEl) dobEl.textContent = AppState.child.dob || "—";

  const ageEl = document.getElementById('reportChildAge');
  if (ageEl) ageEl.textContent = AppState.child.chronologicalAgeFormatted || "—";

  const dateEl = document.getElementById('reportEvalDate');
  if (dateEl) dateEl.textContent = AppState.child.evalDate || "—";

  const specialistEl = document.getElementById('reportSpecialist');
  if (specialistEl) specialistEl.textContent = AppState.child.specialist || "—";
}

// Trigger Print Process Safely
function triggerPrintReport() {
  calculateAllResults();
  renderOfficialReport();
  switchTab('report');
  
  // Short delay to ensure DOM and charts are fully painted before opening print dialog
  setTimeout(() => {
    window.print();
  }, 150);
}

// Render Official Report Tab with Comprehensive Intervention & Development Plan
function renderOfficialReport() {
  updateReportHeader();
  const results = calculateAllResults();
  
  const container = document.getElementById('reportSummaryTableContainer');
  if (!container) return;

  // 1. Core Summary Table
  const tableHtml = `
    <div class="report-section" style="margin-bottom:1.5rem;">
      <h4 style="font-size:1.05rem; font-weight:800; color:var(--primary); margin-bottom:0.6rem; border-bottom:2px solid var(--border-color); padding-bottom:0.4rem;">
        <i class="fas fa-table text-primary"></i> 1. ملخص نتائج التقييم ومعدلات النمو والتأخر
      </h4>
      <div class="calc-table-container">
        <table class="calc-table">
          <thead>
            <tr>
              <th>المجال النمائي</th>
              <th>العمر التطوري</th>
              <th>العمر الزمني</th>
              <th>المهارات المكتسبة</th>
              <th>نسبة التطور (DQ)</th>
              <th>التشخيص النمائي والفجوة</th>
            </tr>
          </thead>
          <tbody>
            ${results.domains.map(d => `
              <tr>
                <td><strong>${d.name}</strong></td>
                <td><strong>${d.devAgeMonths} شهر</strong> (${d.devAgeFormatted})</td>
                <td>${AppState.child.chronologicalAgeMonths || '—'} شهر</td>
                <td>${d.acquired} / ${d.total} بند</td>
                <td><strong>${d.dq}%</strong></td>
                <td>
                  <span class="delay-badge ${d.delayClass}" style="display:inline-block;">
                    ${d.delayClassification} (${d.gapMonths > 0 ? '-' + d.gapMonths + ' شهر' : '+' + Math.abs(d.gapMonths) + ' شهر'})
                  </span>
                </td>
              </tr>
            `).join('')}
            <tr style="background:#eef2ff; font-weight:800;">
              <td>المعدل العام (متوسط المجالات)</td>
              <td><strong>${results.overallDevAgeMonths} شهر</strong> (${formatMonthsToYears(results.overallDevAgeMonths)})</td>
              <td>${AppState.child.chronologicalAgeMonths || '—'} شهر</td>
              <td>${results.totalSkillsAcquired} / ${results.totalSkillsCount}</td>
              <td><strong>${results.overallDevelopmentalQuotient}%</strong></td>
              <td>${results.overallDevelopmentalQuotient >= 85 ? 'ضمن المتوسط الطبيعي' : 'بحاجة لبرنامج تدخل نمائي مكثف'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // 2. Extract and Categorize Deficit Skills (Emerging & Missing)
  const deficitSkills = [];
  PORTAGE_DATA.domains.forEach(domain => {
    domain.ageGroups.forEach((group, gIdx) => {
      group.skills.forEach(skill => {
        const skillKey = `${domain.id}_${gIdx}_${skill.id}`;
        const status = AppState.evaluations[skillKey];
        const isIepSelected = AppState.iepSelectedGoals.has(skillKey);

        if (status === 'missing' || status === 'emerging' || isIepSelected) {
          const guide = SKILL_GUIDES.getGuide(domain.id, gIdx, skill.id, skill.text);
          const trainingPlan = generateTrainingStrategy({
            domainId: domain.id,
            domainName: domain.name,
            ageLabel: group.ageLabel,
            skillText: skill.text,
            status: status || 'missing'
          });

          deficitSkills.push({
            key: skillKey,
            domainId: domain.id,
            domainName: domain.name,
            domainColor: domain.color,
            domainIcon: domain.icon,
            ageLabel: group.ageLabel,
            ageIndex: gIdx,
            skillId: skill.id,
            skillText: skill.text,
            status: status || 'missing',
            statusLabel: status === 'emerging' ? 'في طور البزوغ (±)' : 'غير مكتسبة (-)',
            priority: status === 'emerging' ? 'أولوية قصوى (بزوغ سريع)' : (gIdx <= 2 ? 'أولوية أساسية (قاعدة نمائية)' : 'أولوية تطويرية'),
            isIepSelected: isIepSelected,
            guide: guide,
            plan: trainingPlan
          });
        }
      });
    });
  });

  // Sort deficit skills: Emerging first, then by age bracket
  deficitSkills.sort((a, b) => {
    if (a.isIepSelected && !b.isIepSelected) return -1;
    if (b.isIepSelected && !a.isIepSelected) return 1;
    if (a.status === 'emerging' && b.status !== 'emerging') return -1;
    if (b.status === 'emerging' && a.status !== 'emerging') return 1;
    return a.ageIndex - b.ageIndex;
  });

  // 3. Domain Deficit Analysis Summary
  const domainDeficitAnalysisHtml = `
    <div class="report-section" style="margin-top:1.75rem; margin-bottom:1.5rem;">
      <h4 style="font-size:1.05rem; font-weight:800; color:var(--primary); margin-bottom:0.6rem; border-bottom:2px solid var(--border-color); padding-bottom:0.4rem;">
        <i class="fas fa-search-plus text-primary"></i> 2. تحليل وتشخيص جوانب القصور والفجوات النمائية
      </h4>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:0.75rem; margin-top:0.5rem;">
        ${results.domains.map(d => {
          const domainDeficits = deficitSkills.filter(s => s.domainId === d.id);
          const emergingCount = domainDeficits.filter(s => s.status === 'emerging').length;
          const missingCount = domainDeficits.filter(s => s.status === 'missing').length;

          return `
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-right:4px solid ${d.color}; border-radius:6px; padding:0.75rem 0.9rem; font-size:0.85rem;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                <strong style="color:#0f172a; font-size:0.92rem;"><i class="fas fa-${d.icon}" style="color:${d.color}"></i> ${d.name}</strong>
                <span class="delay-badge ${d.delayClass}" style="font-size:0.75rem; padding:0.15rem 0.5rem;">${d.delayClassification}</span>
              </div>
              <div style="color:#475569; line-height:1.5;">
                <div>الفارق النمائي: <strong>${d.gapMonths > 0 ? '-' + d.gapMonths + ' شهر' : 'متوافق مع العمر'}</strong></div>
                <div>المهارات قيد البزوغ: <strong style="color:var(--warning);">${emergingCount}</strong> | المهارات المفقودة: <strong style="color:var(--danger);">${missingCount}</strong></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // 4. Comprehensive Actionable Intervention Plan (جوانب النقص وكيف نحلها بالتفصيل)
  let detailedInterventionHtml = '';
  if (deficitSkills.length > 0) {
    detailedInterventionHtml = `
      <div class="report-section" style="margin-top:2rem; margin-bottom:1.5rem;">
        <h4 style="font-size:1.05rem; font-weight:800; color:var(--primary); margin-bottom:0.4rem; border-bottom:2px solid var(--border-color); padding-bottom:0.4rem;">
          <i class="fas fa-clipboard-check text-primary"></i> 3. خطة التطوير والتدخل الإجرائية المتكاملة (جوانب النقص وحلولها التطبيقية)
        </h4>
        <p style="color:var(--text-muted); font-size:0.85rem; margin-bottom:1rem;">
          جدول الأهداف السلوكية وخطط التدريب الميداني والمنزلي المصممة خصيصاً لسد الفجوات النمائية المحددة للطفل:
        </p>

        <div style="display:flex; flex-direction:column; gap:1rem;">
          ${deficitSkills.slice(0, 15).map((skill, index) => `
            <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; padding:0.9rem 1.1rem; border-right:5px solid ${skill.domainColor}; page-break-inside:avoid; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.4rem;">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                  <span style="background:${skill.domainColor}; color:#fff; font-size:0.75rem; font-weight:700; padding:0.15rem 0.6rem; border-radius:4px;">
                    ${index + 1}. ${skill.domainName}
                  </span>
                  <span style="font-size:0.8rem; color:#64748b; font-weight:600;">[${skill.ageLabel} - بند ${skill.skillId}]</span>
                </div>
                <div style="display:flex; gap:0.4rem;">
                  <span class="badge ${skill.status === 'emerging' ? 'badge-info' : 'badge-ftda'}" style="font-size:0.72rem; padding:0.15rem 0.5rem;">
                    ${skill.priority}
                  </span>
                  <span style="font-size:0.72rem; font-weight:700; padding:0.15rem 0.5rem; border-radius:999px; background:${skill.status === 'emerging' ? 'var(--warning-bg)' : 'var(--danger-bg)'}; color:${skill.status === 'emerging' ? 'var(--warning)' : 'var(--danger)'}; border:1px solid ${skill.status === 'emerging' ? 'var(--warning-border)' : 'var(--danger-border)'};">
                    الحالة: ${skill.statusLabel}
                  </span>
                </div>
              </div>

              <h5 style="font-size:0.95rem; font-weight:800; color:#0f172a; margin-bottom:0.6rem; line-height:1.4;">
                🎯 المهارة المستهدفة: ${skill.skillText}
              </h5>

              <!-- Strategy Grid: How to solve it -->
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:0.6rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0.75rem; font-size:0.82rem; line-height:1.5;">
                <div>
                  <strong style="color:var(--primary);"><i class="fas fa-cogs"></i> استراتيجية التدريب الإجرائية (كيف نحلها):</strong>
                  <p style="margin-top:0.2rem; color:#334155;">${skill.plan.strategy}</p>
                </div>
                <div>
                  <strong style="color:var(--primary);"><i class="fas fa-tools"></i> الأدوات والوسائل المعينة المقترحة:</strong>
                  <p style="margin-top:0.2rem; color:#334155;">${skill.plan.materials}</p>
                </div>
                <div>
                  <strong style="color:var(--primary);"><i class="fas fa-home"></i> برنامج التدريب المنزلي للأسرة:</strong>
                  <p style="margin-top:0.2rem; color:#334155;">${skill.plan.parentTip}</p>
                </div>
                <div>
                  <strong style="color:var(--primary);"><i class="fas fa-check-double"></i> معيار الإتقان والتقييم:</strong>
                  <p style="margin-top:0.2rem; color:#334155;">${skill.guide.criteria.acquired}</p>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        ${deficitSkills.length > 15 ? `<p style="text-align:center; font-size:0.8rem; color:#64748b; margin-top:0.75rem;">(تم استعراض أول 15 مهارة ذات أولوية قصوى من إجمالي ${deficitSkills.length} مهارة مستهدفة للتطوير)</p>` : ''}
      </div>
    `;
  } else {
    detailedInterventionHtml = `
      <div style="margin-top:1.5rem; padding:1.5rem; text-align:center; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; color:#065f46;">
        <i class="fas fa-check-circle fa-2x" style="margin-bottom:0.5rem;"></i>
        <h4>لا توجد مهارات مفقودة مسجلة في هذا التقييم</h4>
        <p style="font-size:0.85rem;">الطفل يظهر أداءً نمائياً مناسباً لجميع البنود التي تم تقييمها.</p>
      </div>
    `;
  }

  // 5. General Recommendations & Periodic Monitoring Protocol
  const recommendationsHtml = `
    <div class="report-section" style="margin-top:2rem; page-break-inside:avoid;">
      <h4 style="font-size:1.05rem; font-weight:800; color:var(--primary); margin-bottom:0.6rem; border-bottom:2px solid var(--border-color); padding-bottom:0.4rem;">
        <i class="fas fa-tasks text-primary"></i> 4. التوصيات العامة وبروتوكول المتابعة الدورية
      </h4>
      <div style="font-size:0.88rem; line-height:1.7; color:#334155;">
        <ul style="padding-right:1.25rem;">
          <li><strong>التنفيذ المتسلسل:</strong> البدء فوراً بالمهارات في طور البزوغ (±) لتحقيق نجاحات سريعة تعزز دافعية الطفل، تليها المهارات التأسيسية.</li>
          <li><strong>تحليل المهمة والنمذجة:</strong> تجزئة المهارات المعقدة إلى خطوات مصغرة قابلة للإنجاز مع تقديم الدعم الجسدي والإيمائي ثم سحبه تدريجياً (Prompt Fading).</li>
          <li><strong>الشراكة الأسرية:</strong> تطبيق أنشطة التدريب المنزلي بشكل يومي في مواقف الحياة الطبيعية غير المصطنعة مع الاحتفال بكل إنجاز ومكافأته فورياً.</li>
          <li><strong>إعادة التقييم والمتابعة:</strong> يوصى بإجراء جلسة تقييم نمائي بعد <strong>3 أشهر</strong> لقياس معدل التحسن ومراجعة الأهداف الفردية (IEP).</li>
        </ul>
      </div>
    </div>
  `;

  container.innerHTML = tableHtml + domainDeficitAnalysisHtml + detailedInterventionHtml + recommendationsHtml;
}

// State Persistence (Local Storage - Multi-Specialist Architecture)
function saveState() {
  saveCurrentSpecialistStore();
  const payload = {
    version: "3.0",
    specialists: AppState.specialists,
    activeSpecialistId: AppState.activeSpecialistId,
    specialistStores: AppState.specialistStores,
    activeChildId: AppState.activeChildId
  };
  localStorage.setItem('portage_multi_specialists_v3', JSON.stringify(payload));
}

function loadSavedState() {
  // Check v3 multi-specialist storage first
  const rawV3 = localStorage.getItem('portage_multi_specialists_v3');
  if (rawV3) {
    try {
      const data = JSON.parse(rawV3);
      if (data.specialists && Object.keys(data.specialists).length > 0) {
        AppState.specialists = data.specialists;
      }
      if (data.specialistStores) {
        AppState.specialistStores = data.specialistStores;
      }
      if (data.activeSpecialistId && AppState.specialists[data.activeSpecialistId]) {
        AppState.activeSpecialistId = data.activeSpecialistId;
      } else {
        AppState.activeSpecialistId = Object.keys(AppState.specialists)[0] || "spec_1";
      }

      // Load active specialist's children database
      AppState.children = AppState.specialistStores[AppState.activeSpecialistId] || {};
      
      const childKeys = Object.keys(AppState.children);
      if (data.activeChildId && AppState.children[data.activeChildId]) {
        AppState.activeChildId = data.activeChildId;
      } else if (childKeys.length > 0) {
        AppState.activeChildId = childKeys[0];
      }

      if (AppState.activeChildId && AppState.children[AppState.activeChildId]) {
        AppState.child = { ...AppState.children[AppState.activeChildId] };
        AppState.evaluations = AppState.child.currentEvaluations || {};
        AppState.iepSelectedGoals = new Set(AppState.child.currentIepGoals || []);
      }

      // Sync form fields
      document.getElementById('childName').value = AppState.child.name || "";
      document.getElementById('childDob').value = AppState.child.dob || "";
      document.getElementById('evalDate').value = AppState.child.evalDate || new Date().toISOString().split('T')[0];
      document.getElementById('childGender').value = AppState.child.gender || "male";
      document.getElementById('specialistName').value = AppState.specialists[AppState.activeSpecialistId]?.name || AppState.child.specialist || "";
      document.getElementById('evalNotes').value = AppState.child.notes || "";
      return;
    } catch (e) {
      console.error("Error loading v3 state:", e);
    }
  }

  // Fallback to legacy v2 or v1 storage if available
  const rawLegacy = localStorage.getItem('portage_assessment_state_v2') || localStorage.getItem('portage_assessment_state');
  if (rawLegacy) {
    try {
      const data = JSON.parse(rawLegacy);
      const defaultSpecId = "spec_1";
      AppState.specialistStores[defaultSpecId] = data.children || {};
      
      if (data.child) {
        const cId = data.child.id || "legacy_child";
        data.child.currentEvaluations = data.evaluations || {};
        data.child.currentIepGoals = data.iepSelectedGoals || [];
        AppState.specialistStores[defaultSpecId][cId] = data.child;
        AppState.activeChildId = cId;
        AppState.child = { ...data.child };
      }

      AppState.children = AppState.specialistStores[defaultSpecId];
      AppState.evaluations = data.evaluations || {};
      if (data.iepSelectedGoals) AppState.iepSelectedGoals = new Set(data.iepSelectedGoals);

      document.getElementById('childName').value = AppState.child.name || "";
      document.getElementById('childDob').value = AppState.child.dob || "";
      document.getElementById('evalDate').value = AppState.child.evalDate || new Date().toISOString().split('T')[0];
      document.getElementById('childGender').value = AppState.child.gender || "male";
      document.getElementById('specialistName').value = AppState.specialists[defaultSpecId]?.name || "";
      document.getElementById('evalNotes').value = AppState.child.notes || "";
    } catch (e) {
      console.error("Error loading legacy state:", e);
    }
  }
}

// Export Complete Database JSON
function exportAssessmentJSON() {
  saveCurrentSpecialistStore();
  const currentSpec = AppState.specialists[AppState.activeSpecialistId] || {};

  const dataToExport = {
    meta: {
      system: "Portage Early Education Assessment & IEP System",
      version: "3.0 (Multi-Specialist & Isolated Child Databases)",
      exportDate: new Date().toISOString(),
      accreditation: "مؤسسة أكاديمية التدريب والتنمية (FTDA) - إعداد: م. إيمان أبواليزيد",
      specialist: currentSpec
    },
    activeSpecialistId: AppState.activeSpecialistId,
    specialists: AppState.specialists,
    specialistStores: AppState.specialistStores,
    currentSpecialistChildren: AppState.children,
    activeChild: AppState.child,
    evaluations: AppState.evaluations,
    results: calculateAllResults(),
    iepGoals: Array.from(AppState.iepSelectedGoals)
  };

  const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileName = `قاعدة_بيانات_بورتيدج_${(currentSpec.name || 'أخصائي').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

// Import Complete or Single-Child Database JSON
function importAssessmentJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      if (data.specialists && data.specialistStores) {
        // Full v3 backup import
        AppState.specialists = { ...AppState.specialists, ...data.specialists };
        AppState.specialistStores = { ...AppState.specialistStores, ...data.specialistStores };
        if (data.activeSpecialistId && AppState.specialists[data.activeSpecialistId]) {
          AppState.activeSpecialistId = data.activeSpecialistId;
        }
        AppState.children = AppState.specialistStores[AppState.activeSpecialistId] || {};
      } else if (data.children) {
        // Import into current specialist database
        AppState.children = { ...AppState.children, ...data.children };
        AppState.specialistStores[AppState.activeSpecialistId] = { ...AppState.children };
      }

      if (data.activeChild) {
        AppState.child = { ...AppState.child, ...data.activeChild };
        AppState.activeChildId = data.activeChild.id || ("child_" + Date.now());
        AppState.children[AppState.activeChildId] = { ...AppState.child };
      }

      if (data.evaluations) AppState.evaluations = data.evaluations;
      if (data.iepGoals) AppState.iepSelectedGoals = new Set(data.iepGoals);

      document.getElementById('childName').value = AppState.child.name || "";
      document.getElementById('childDob').value = AppState.child.dob || "";
      document.getElementById('evalDate').value = AppState.child.evalDate || "";
      document.getElementById('childGender').value = AppState.child.gender || "male";
      document.getElementById('specialistName').value = AppState.specialists[AppState.activeSpecialistId]?.name || AppState.child.specialist || "";
      document.getElementById('evalNotes').value = AppState.child.notes || "";

      updateChronologicalAge();
      saveState();
      renderSpecialistSelectDropdown();
      renderSpecialistSummaryCard();
      renderChildSelectDropdown();
      renderChildrenDirectoryTable();
      renderDomainButtons();
      renderAssessmentView();
      calculateAllResults();
      alert("تم استيراد وتحديث قاعدة البيانات بنجاح!");
    } catch (err) {
      alert("حدث خطأ أثناء قراءة الملف. يرجى التأكد من صحة ملف JSON.");
    }
  };
  reader.readAsText(file);
}

// Load Rich Multi-Specialist Demo Data for Instant Exploration
function loadDemoData() {
  // Specialist 1: أ. منى زكي
  const spec1Children = {
    "child_youssef": {
      id: "child_youssef",
      name: "يوسف أحمد السعيد",
      dob: "2023-03-15",
      evalDate: new Date().toISOString().split('T')[0],
      gender: "male",
      specialist: "أ. منى زكي",
      notes: "يعاني من تأخر بسيط في النمو اللغوي والاندماج الاجتماعي مع استجابة ممتازة للتعزيز.",
      chronologicalAgeMonths: 36,
      chronologicalAgeFormatted: "3 سنوات",
      currentEvaluations: {},
      currentIepGoals: ["social_1_15", "language_2_10", "cognitive_2_5"],
      sessions: [
        {
          sessionId: "sess_1",
          sessionNumber: 1,
          date: "2025-09-15",
          chronologicalAgeMonths: 30,
          overallDevAgeMonths: 18.5,
          dq: 62,
          totalAcquired: 145,
          totalSkillsCount: 570,
          evaluations: {}
        },
        {
          sessionId: "sess_2",
          sessionNumber: 2,
          date: "2026-03-15",
          chronologicalAgeMonths: 36,
          overallDevAgeMonths: 26.2,
          dq: 73,
          totalAcquired: 230,
          totalSkillsCount: 570,
          evaluations: {}
        }
      ]
    },
    "child_mariam": {
      id: "child_mariam",
      name: "مريم محمود الشريف",
      dob: "2022-08-10",
      evalDate: new Date().toISOString().split('T')[0],
      gender: "female",
      specialist: "أ. منى زكي",
      notes: "تقييم متابعة دوري لتنمية المهارات المعرفية والاستقلالية ورعاية الذات.",
      chronologicalAgeMonths: 43,
      chronologicalAgeFormatted: "3 سنوات و 7 شهور",
      currentEvaluations: {},
      currentIepGoals: ["self_help_3_8", "motor_3_12"],
      sessions: []
    }
  };

  // Populate realistic evaluations for Youssef
  PORTAGE_DATA.domains.forEach(domain => {
    domain.ageGroups.forEach((group, gIdx) => {
      group.skills.forEach(skill => {
        const key = `${domain.id}_${gIdx}_${skill.id}`;
        if (gIdx === 0) {
          spec1Children["child_youssef"].currentEvaluations[key] = 'acquired';
        } else if (gIdx === 1) {
          spec1Children["child_youssef"].currentEvaluations[key] = Math.random() > 0.15 ? 'acquired' : 'missing';
        } else if (gIdx === 2) {
          const r = Math.random();
          spec1Children["child_youssef"].currentEvaluations[key] = r > 0.5 ? 'acquired' : (r > 0.25 ? 'emerging' : 'missing');
        } else {
          spec1Children["child_youssef"].currentEvaluations[key] = 'missing';
        }
      });
    });
  });

  // Specialist 2: د. خالد النجار
  const spec2Children = {
    "child_omar": {
      id: "child_omar",
      name: "عمر طارق المهدي",
      dob: "2021-11-20",
      evalDate: new Date().toISOString().split('T')[0],
      gender: "male",
      specialist: "د. خالد النجار",
      notes: "برنامج تأهيلي مكثف لعلاج عسر النطق وتطوير المفردات التعبيرية.",
      chronologicalAgeMonths: 52,
      chronologicalAgeFormatted: "4 سنوات و 4 شهور",
      currentEvaluations: {},
      currentIepGoals: ["language_3_18", "language_4_5"],
      sessions: [
        {
          sessionId: "sess_omar_1",
          sessionNumber: 1,
          date: "2026-01-10",
          chronologicalAgeMonths: 49,
          overallDevAgeMonths: 35.0,
          dq: 71,
          totalAcquired: 310,
          totalSkillsCount: 570,
          evaluations: {}
        }
      ]
    }
  };

  // Populate evaluations for Omar
  PORTAGE_DATA.domains.forEach(domain => {
    domain.ageGroups.forEach((group, gIdx) => {
      group.skills.forEach(skill => {
        const key = `${domain.id}_${gIdx}_${skill.id}`;
        if (gIdx <= 1) {
          spec2Children["child_omar"].currentEvaluations[key] = 'acquired';
        } else if (gIdx === 2) {
          spec2Children["child_omar"].currentEvaluations[key] = Math.random() > 0.2 ? 'acquired' : 'missing';
        } else if (gIdx === 3) {
          const r = Math.random();
          spec2Children["child_omar"].currentEvaluations[key] = r > 0.4 ? 'acquired' : (r > 0.2 ? 'emerging' : 'missing');
        } else {
          spec2Children["child_omar"].currentEvaluations[key] = 'missing';
        }
      });
    });
  });

  AppState.specialistStores = {
    "spec_1": spec1Children,
    "spec_2": spec2Children
  };

  AppState.activeSpecialistId = "spec_1";
  AppState.children = AppState.specialistStores["spec_1"];
  AppState.activeChildId = "child_youssef";
  AppState.child = { ...AppState.children["child_youssef"] };
  AppState.evaluations = { ...AppState.child.currentEvaluations };
  AppState.iepSelectedGoals = new Set(AppState.child.currentIepGoals);

  // Sync inputs
  document.getElementById('childName').value = AppState.child.name;
  document.getElementById('childDob').value = AppState.child.dob;
  document.getElementById('evalDate').value = AppState.child.evalDate;
  document.getElementById('childGender').value = AppState.child.gender;
  document.getElementById('specialistName').value = AppState.specialists["spec_1"].name;
  document.getElementById('evalNotes').value = AppState.child.notes;

  updateChronologicalAge();
  saveState();
  renderSpecialistSelectDropdown();
  renderSpecialistSummaryCard();
  renderChildSelectDropdown();
  renderChildrenDirectoryTable();
  renderDomainButtons();
  renderAssessmentView();
  calculateAllResults();
  alert("تم بنجاح تهيئة قاعدة بيانات متكاملة تتضمن حسابين لأخصائيين مستقلين و 3 ملفات أطفال مع سجلات تقييم تاريخية وخطط فردية!");
}
