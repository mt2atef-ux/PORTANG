/**
 * أداة مساعدة ودليل الأسئلة التفاعلي
 * Question Help Tool & Interactive Guide Widget
 * PORTANG Assessment System
 */

const QuestionHelpTool = {
  /**
   * عرض أداة المساعدة الخاصة بالسؤال في نافذة أو بطاقة توضيحية
   * @param {Object} questionData - كائن السؤال من ملف الـ JSON
   */
  displayHelp: function(questionData) {
    if (!questionData || !questionData.help_tooltip) {
      console.warn("لا تتوفر أداة مساعدة لهذا السؤال");
      return;
    }

    const q = questionData.current_question || questionData;
    const help = q.help_tooltip;

    // التحقق من وجود حاوية المساعدة المخصصة في DOM أو إنشاؤها
    let helpContainer = document.getElementById("questionHelpOverlay");
    if (!helpContainer) {
      helpContainer = this.createHelpModalDOM();
    }

    // تعبئة البيانات في عناصر الأداة المساعدة
    document.getElementById("qHelpTitle").textContent = help.title || `أداة مساعدة: ${q.question_text}`;
    document.getElementById("qHelpCategory").textContent = q.category || "النمو النمائي";
    document.getElementById("qHelpQuestionText").textContent = q.question_text || "";
    document.getElementById("qHelpExplanation").textContent = help.explanation || "غير محدد";
    
    // تنسيق آلية التطبيق العملي
    const mechanismElement = document.getElementById("qHelpMechanism");
    if (typeof help.actionable_mechanism === "string") {
      mechanismElement.innerHTML = help.actionable_mechanism.replace(/\n/g, "<br>");
    } else {
      mechanismElement.textContent = help.actionable_mechanism || "";
    }

    // المواد المطلوبة
    document.getElementById("qHelpMaterials").textContent = help.materials || "لا توجد أدوات خاصة مطلوبة.";

    // معايير التقييم
    if (help.scoring_criteria) {
      document.getElementById("qHelpScoreFull").textContent = help.scoring_criteria.full_score || "-";
      document.getElementById("qHelpScorePartial").textContent = help.scoring_criteria.partial_score || "-";
      document.getElementById("qHelpScoreZero").textContent = help.scoring_criteria.zero_score || "-";
    }

    // تنبيهات الفاحص
    document.getElementById("qHelpTips").textContent = help.examiner_tips || "حافظ على هدوء الطفل وتشجيعه المستمر.";

    // إظهار نافذة الأداة المساعدة
    helpContainer.classList.add("active");
    helpContainer.style.display = "flex";
  },

  /**
   * إغلاق نافذة الأداة المساعدة
   */
  closeHelp: function() {
    const helpContainer = document.getElementById("questionHelpOverlay");
    if (helpContainer) {
      helpContainer.classList.remove("active");
      helpContainer.style.display = "none";
    }
  },

  /**
   * إنشاء هيكل النافذة المساعدة في واجهة المستخدم تلقائياً
   */
  createHelpModalDOM: function() {
    const modalHTML = `
      <div id="questionHelpOverlay" class="modal-backdrop" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.75); z-index:9999; align-items:center; justify-content:center; padding:1rem; backdrop-filter:blur(4px);">
        <div class="modal-card" style="background:#fff; border-radius:16px; max-width:680px; width:100%; max-height:90vh; overflow-y:auto; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); border:1px solid #e2e8f0; font-family:'Cairo','Tajawal',sans-serif; direction:rtl; text-align:right;">
          
          <!-- Header -->
          <div style="display:flex; justify-content:space-between; align-items:center; padding:1.25rem 1.5rem; border-bottom:1px solid #e2e8f0; background:#f8fafc; border-radius:16px 16px 0 0;">
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <span style="display:flex; align-items:center; justify-content:center; width:42px; height:42px; border-radius:12px; background:linear-gradient(135deg, #3b82f6, #1d4ed8); color:#fff; font-size:1.25rem;">
                💡
              </span>
              <div>
                <h3 id="qHelpTitle" style="margin:0; font-size:1.15rem; color:#0f172a; font-weight:800;">أداة مساعدة السؤال</h3>
                <span id="qHelpCategory" style="display:inline-block; margin-top:0.25rem; font-size:0.78rem; font-weight:700; color:#2563eb; background:#dbeafe; padding:0.15rem 0.6rem; border-radius:999px;"></span>
              </div>
            </div>
            <button onclick="QuestionHelpTool.closeHelp()" style="background:#f1f5f9; border:none; width:34px; height:34px; border-radius:50%; cursor:pointer; font-size:1.1rem; color:#64748b; display:flex; align-items:center; justify-content:center;">✕</button>
          </div>

          <!-- Body -->
          <div style="padding:1.5rem; display:flex; flex-direction:column; gap:1.25rem;">
            
            <!-- Question Box -->
            <div style="background:#f1f5f9; border-right:4px solid #2563eb; padding:1rem; border-radius:10px;">
              <span style="font-size:0.8rem; color:#64748b; font-weight:700;">نص السؤال:</span>
              <p id="qHelpQuestionText" style="margin:0.35rem 0 0 0; font-size:1rem; font-weight:700; color:#1e293b; line-height:1.6;"></p>
            </div>

            <!-- Objective / Explanation -->
            <div>
              <h4 style="margin:0 0 0.4rem 0; font-size:0.95rem; color:#1d4ed8; display:flex; align-items:center; gap:0.4rem;">
                🎯 ماذا يقيس هذا السؤال والهدف منه؟
              </h4>
              <p id="qHelpExplanation" style="margin:0; font-size:0.9rem; color:#334155; line-height:1.65;"></p>
            </div>

            <!-- Actionable Steps -->
            <div>
              <h4 style="margin:0 0 0.4rem 0; font-size:0.95rem; color:#059669; display:flex; align-items:center; gap:0.4rem;">
                📋 خطوات التطبيق العملي مع الطفل:
              </h4>
              <div id="qHelpMechanism" style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:10px; padding:0.9rem; font-size:0.9rem; color:#065f46; line-height:1.7;"></div>
            </div>

            <!-- Materials & Tools -->
            <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:0.9rem;">
              <h4 style="margin:0 0 0.35rem 0; font-size:0.9rem; color:#b45309; display:flex; align-items:center; gap:0.4rem;">
                🧰 الأدوات والمواد المقترحة:
              </h4>
              <p id="qHelpMaterials" style="margin:0; font-size:0.88rem; color:#92400e; line-height:1.5;"></p>
            </div>

            <!-- Scoring Rubric -->
            <div>
              <h4 style="margin:0 0 0.5rem 0; font-size:0.95rem; color:#475569; display:flex; align-items:center; gap:0.4rem;">
                ⚖️ معايير منح الدرجات (Rubric):
              </h4>
              <div style="display:flex; flex-direction:column; gap:0.4rem; font-size:0.85rem;">
                <div style="background:#f0fdf4; border-right:3px solid #16a34a; padding:0.6rem 0.8rem; border-radius:6px; color:#14532d;">
                  <strong>متقن (درجتان):</strong> <span id="qHelpScoreFull"></span>
                </div>
                <div style="background:#fffbeb; border-right:3px solid #d97706; padding:0.6rem 0.8rem; border-radius:6px; color:#78350f;">
                  <strong>قيد الاكتساب (درجة واحدة):</strong> <span id="qHelpScorePartial"></span>
                </div>
                <div style="background:#fef2f2; border-right:3px solid #dc2626; padding:0.6rem 0.8rem; border-radius:6px; color:#7f1d1d;">
                  <strong>غير متقن (صفر):</strong> <span id="qHelpScoreZero"></span>
                </div>
              </div>
            </div>

            <!-- Tips -->
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:0.85rem;">
              <span style="font-size:0.85rem; font-weight:800; color:#334155;">💡 نصيحة للفاحص / ولي الأمر:</span>
              <p id="qHelpTips" style="margin:0.25rem 0 0 0; font-size:0.88rem; color:#475569;"></p>
            </div>

          </div>

          <!-- Footer -->
          <div style="padding:1rem 1.5rem; background:#f8fafc; border-top:1px solid #e2e8f0; border-radius:0 0 16px 16px; text-align:left;">
            <button onclick="QuestionHelpTool.closeHelp()" style="background:#0f172a; color:#fff; border:none; padding:0.55rem 1.5rem; border-radius:8px; font-weight:700; cursor:pointer; font-family:inherit;">
              فهمت آلية السؤال، إغلاق
            </button>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);
    return document.getElementById("questionHelpOverlay");
  }
};

// إتاحة الأداة عالمياً
if (typeof window !== "undefined") {
  window.QuestionHelpTool = QuestionHelpTool;
}
