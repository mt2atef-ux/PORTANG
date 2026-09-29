/**
 * Portage Assessment & IEP Application Logic
 * Portage Early Education System (FTDA Accredited)
 * Includes Multi-Child Profiles, Historical Progress Tracking, and Per-Skill Administration Guides
 */

// Application State
const AppState = {
  // Collection of child profiles
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
  currentAgeFilter: "auto_child_age", // default to child's age bracket
  autoFilterByAge: true,
  
  // Map of skillKey -> status ('acquired', 'emerging', 'missing')
  // skillKey format: `${domainId}_${ageIndex}_${skillId}`
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
  renderChildSelectDropdown();
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

  // Active Child Select Change
  document.getElementById('activeChildSelect')?.addEventListener('change', (e) => {
    switchActiveChild(e.target.value);
  });

  // Add Child Modal Button
  document.getElementById('btnAddNewChildModal')?.addEventListener('click', () => {
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

  if (tabId === 'results') {
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

// Child Profiles & Account Management
function renderChildSelectDropdown() {
  const select = document.getElementById('activeChildSelect');
  if (!select) return;

  // If no children in state, initialize with default active child
  if (Object.keys(AppState.children).length === 0) {
    AppState.children[AppState.child.id] = { ...AppState.child };
  }

  select.innerHTML = Object.values(AppState.children).map(c => `
    <option value="${c.id}" ${c.id === AppState.activeChildId ? 'selected' : ''}>
      ${c.name || 'طفل بدون اسم'}
    </option>
  `).join('');
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
  document.getElementById('specialistName').value = AppState.child.specialist || "";
  document.getElementById('evalNotes').value = AppState.child.notes || "";

  updateChronologicalAge();
  renderChildSelectDropdown();
  renderDomainButtons();
  renderAssessmentView();
  calculateAllResults();
  saveState();
}

function handleCreateNewChildSubmit() {
  const name = document.getElementById('newChildNameInput')?.value.trim();
  const dob = document.getElementById('newChildDobInput')?.value;
  const gender = document.getElementById('newChildGenderInput')?.value || "male";
  const specialist = document.getElementById('newChildSpecialistInput')?.value.trim() || "";

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
  closeModal('newChildModal');
  document.getElementById('createNewChildForm')?.reset();
  
  switchActiveChild(newId);
  switchTab('intake');
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
  saveState();
  renderChildSelectDropdown();
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

// Render Official Report Tab
function renderOfficialReport() {
  updateReportHeader();
  const results = calculateAllResults();
  
  const container = document.getElementById('reportSummaryTableContainer');
  if (!container) return;

  const tableHtml = `
    <div class="calc-table-container">
      <table class="calc-table">
        <thead>
          <tr>
            <th>المجال النمائي</th>
            <th>العمر التطوري (شهور)</th>
            <th>العمر الزمني (شهور)</th>
            <th>المهارات المكتسبة</th>
            <th>نسبة التطور (DQ)</th>
            <th>التشخيص النمائي والفجوة</th>
          </tr>
        </thead>
        <tbody>
          ${results.domains.map(d => `
            <tr>
              <td><strong>${d.name}</strong></td>
              <td>${d.devAgeMonths} شهر (${d.devAgeFormatted})</td>
              <td>${AppState.child.chronologicalAgeMonths || '—'} شهر</td>
              <td>${d.acquired} / ${d.total} بند</td>
              <td><strong>${d.dq}%</strong></td>
              <td>${d.delayClassification} (${d.gapMonths > 0 ? '-' + d.gapMonths + ' شهر' : '+' + Math.abs(d.gapMonths) + ' شهر'})</td>
            </tr>
          `).join('')}
          <tr style="background:#eef2ff; font-weight:800;">
            <td>المعدل العام (متوسط المجالات)</td>
            <td>${results.overallDevAgeMonths} شهر (${formatMonthsToYears(results.overallDevAgeMonths)})</td>
            <td>${AppState.child.chronologicalAgeMonths || '—'} شهر</td>
            <td>${results.totalSkillsAcquired} / ${results.totalSkillsCount}</td>
            <td>${results.overallDevelopmentalQuotient}%</td>
            <td>${results.overallDevelopmentalQuotient >= 85 ? 'ضمن المتوسط الطبيعي' : 'بحاجة لبرنامج تدخل نمائي مكثف'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  let iepHtml = '';
  if (AppState.iepSelectedGoals.size > 0) {
    iepHtml = `
      <h3 style="margin-top:2rem; margin-bottom:0.75rem; border-bottom:1px solid var(--border-color); padding-bottom:0.5rem;">
        <i class="fas fa-bullseye text-primary"></i> الأهداف التعليمية الفردية المختارة للخطة (IEP)
      </h3>
      <ol style="padding-right:1.5rem; line-height:1.8; font-size:0.9rem;">
        ${Array.from(AppState.iepSelectedGoals).map(goalKey => {
          const [domainId, groupIndex, skillId] = goalKey.split('_');
          const domain = PORTAGE_DATA.domains.find(d => d.id === domainId);
          if (!domain) return '';
          const group = domain.ageGroups[parseInt(groupIndex)];
          const skill = group.skills.find(s => s.id === parseInt(skillId));
          if (!skill) return '';
          return `
            <li style="margin-bottom:0.5rem;">
              <strong>[${domain.name} - ${group.ageLabel}]:</strong> ${skill.text}
            </li>
          `;
        }).join('')}
      </ol>
    `;
  }

  container.innerHTML = tableHtml + iepHtml;
}

// State Persistence (Local Storage)
function saveState() {
  const payload = {
    children: AppState.children,
    activeChildId: AppState.activeChildId,
    child: AppState.child,
    evaluations: AppState.evaluations,
    iepSelectedGoals: Array.from(AppState.iepSelectedGoals)
  };
  localStorage.setItem('portage_assessment_state_v2', JSON.stringify(payload));
}

function loadSavedState() {
  const raw = localStorage.getItem('portage_assessment_state_v2') || localStorage.getItem('portage_assessment_state');
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    if (data.children) AppState.children = data.children;
    if (data.activeChildId && AppState.children[data.activeChildId]) {
      AppState.activeChildId = data.activeChildId;
      AppState.child = { ...AppState.children[data.activeChildId] };
    } else if (data.child) {
      AppState.child = { ...AppState.child, ...data.child };
      AppState.children[AppState.child.id || "child_default"] = { ...AppState.child };
      AppState.activeChildId = AppState.child.id || "child_default";
    }

    if (data.evaluations) AppState.evaluations = data.evaluations;
    if (data.iepSelectedGoals) AppState.iepSelectedGoals = new Set(data.iepSelectedGoals);

    // Sync Form Inputs
    document.getElementById('childName').value = AppState.child.name || "";
    document.getElementById('childDob').value = AppState.child.dob || "";
    document.getElementById('evalDate').value = AppState.child.evalDate || new Date().toISOString().split('T')[0];
    document.getElementById('childGender').value = AppState.child.gender || "male";
    document.getElementById('specialistName').value = AppState.child.specialist || "";
    document.getElementById('evalNotes').value = AppState.child.notes || "";
  } catch (e) {
    console.error("Error loading saved state:", e);
  }
}

// Export JSON
function exportAssessmentJSON() {
  const dataToExport = {
    meta: {
      system: "Portage Assessment & Tracking Portal",
      version: "2.0",
      exportDate: new Date().toISOString(),
      accreditation: "مؤسسة أكاديمية التدريب والتنمية (FTDA) - إعداد: م. إيمان أبواليزيد"
    },
    children: AppState.children,
    activeChild: AppState.child,
    evaluations: AppState.evaluations,
    results: calculateAllResults(),
    iepGoals: Array.from(AppState.iepSelectedGoals)
  };

  const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `سجل_بورتيدج_الشامل_${AppState.child.name || 'طفل'}_${AppState.child.evalDate}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Import JSON
function importAssessmentJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.children) AppState.children = data.children;
      if (data.activeChild) {
        AppState.child = { ...AppState.child, ...data.activeChild };
        AppState.activeChildId = data.activeChild.id || "imported_child";
        AppState.children[AppState.activeChildId] = { ...AppState.child };
      }
      if (data.evaluations) AppState.evaluations = data.evaluations;
      if (data.iepGoals) AppState.iepSelectedGoals = new Set(data.iepGoals);

      document.getElementById('childName').value = AppState.child.name || "";
      document.getElementById('childDob').value = AppState.child.dob || "";
      document.getElementById('evalDate').value = AppState.child.evalDate || "";
      document.getElementById('childGender').value = AppState.child.gender || "male";
      document.getElementById('specialistName').value = AppState.child.specialist || "";
      document.getElementById('evalNotes').value = AppState.child.notes || "";

      updateChronologicalAge();
      saveState();
      renderChildSelectDropdown();
      renderDomainButtons();
      renderAssessmentView();
      calculateAllResults();
      alert("تم استيراد ملف التقييم بنجاح!");
    } catch (err) {
      alert("حدث خطأ أثناء قراءة الملف. يرجى التأكد من صحة ملف JSON.");
    }
  };
  reader.readAsText(file);
}

// Load Demo Data for Quick Testing
function loadDemoData() {
  const demoChildId = "demo_child_1";
  const demoChild = {
    id: demoChildId,
    name: "يوسف أحمد السعيد",
    dob: "2023-03-15",
    evalDate: new Date().toISOString().split('T')[0],
    gender: "male",
    specialist: "أ. منى زكي (أخصائية تربية خاصة)",
    notes: "يعاني الطفل من تأخر بسيط في النمو اللغوي والاندماج الاجتماعي مع مهارات حركية جيدة.",
    chronologicalAgeMonths: 0,
    chronologicalAgeFormatted: "",
    sessions: [
      {
        sessionId: "sess_baseline_1",
        sessionNumber: 1,
        date: "2025-09-15",
        chronologicalAgeMonths: 30.0,
        overallDevAgeMonths: 18.5,
        dq: 62,
        totalAcquired: 145,
        totalSkillsCount: 570,
        evaluations: {}
      },
      {
        sessionId: "sess_midterm_2",
        sessionNumber: 2,
        date: "2026-03-15",
        chronologicalAgeMonths: 36.0,
        overallDevAgeMonths: 26.2,
        dq: 73,
        totalAcquired: 230,
        totalSkillsCount: 570,
        evaluations: {}
      }
    ]
  };

  AppState.children[demoChildId] = demoChild;
  switchActiveChild(demoChildId);

  // Populate realistic demo responses for 3-year old child
  AppState.evaluations = {};
  PORTAGE_DATA.domains.forEach(domain => {
    domain.ageGroups.forEach((group, gIdx) => {
      group.skills.forEach(skill => {
        const key = `${domain.id}_${gIdx}_${skill.id}`;
        if (gIdx === 0) {
          AppState.evaluations[key] = 'acquired';
        } else if (gIdx === 1) {
          AppState.evaluations[key] = Math.random() > 0.15 ? 'acquired' : 'missing';
        } else if (gIdx === 2) {
          const r = Math.random();
          AppState.evaluations[key] = r > 0.5 ? 'acquired' : (r > 0.25 ? 'emerging' : 'missing');
        } else {
          AppState.evaluations[key] = 'missing';
        }
      });
    });
  });

  saveCurrentChildToMap();
  saveState();
  renderDomainButtons();
  renderAssessmentView();
  calculateAllResults();
  alert("تم تحميل بيانات تجريبية لطفل وجلسات متابعة سابقة بنجاح!");
}
