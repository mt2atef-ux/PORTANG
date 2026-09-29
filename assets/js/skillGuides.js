/**
 * دليل تطبيق مقياس بورتيدج ومعايير التقييم والنماذج التوضيحية
 * Portage Skill Administration Guidelines, Criteria, and Real-world Examples
 */

const SKILL_GUIDES = {
  // Generic intelligent generator fallback with domain-specific deep guidelines + specialized rules
  getGuide: function(domainId, ageIndex, skillId, skillText) {
    const customKey = `${domainId}_${ageIndex}_${skillId}`;
    if (this.customMap && this.customMap[customKey]) {
      return this.customMap[customKey];
    }

    // Context-rich generated guide based on pedagogical Portage manual standards
    const domainNames = {
      social: "التنشئة الاجتماعية",
      language: "النمو اللغوي",
      selfHelp: "المساعدة الذاتية",
      cognitive: "النمو المعرفي (الإدراك)",
      motor: "النمو الحركي",
      infant: "قسم الرضيع"
    };

    const domainName = domainNames[domainId] || "المهارات النمائية";
    
    return {
      objective: `قياس مدى قدرة الطفل على إظهار سلوك: "${skillText}" ضمن سياقه الطبيعي في مجال ${domainName}.`,
      procedure: this.generateProcedure(domainId, skillText),
      criteria: this.generateCriteria(domainId, skillText),
      examples: this.generateExamples(domainId, skillText),
      materials: this.generateMaterials(domainId, skillText),
      tips: "تأكد من أن الطفل في حالة مزاجية جيدة ومرتاح، ولا تضغط عليه. يمكنك تكرار الموقف حتى 3 محاولات للحكم الدقيق."
    };
  },

  generateProcedure: function(domainId, skillText) {
    if (domainId === 'social') {
      return `قم بتهيئة بيئة تفاعلية هادئة (وجود شخص مألوف أو أقران). راقب استجابة الطفل الطبيعية لسلوك: "${skillText}". شجع التفاعل دون إجبار.`;
    } else if (domainId === 'language') {
      return `اجلس في مواجهة الطفل بمستوى بصري واحد. قدم المثير اللغوي أو البصري بوضوح، وانتظر استجابة الطفل اللفظية أو الإيمائية لسلوك: "${skillText}".`;
    } else if (domainId === 'selfHelp') {
      return `ضع الطفل في الموقف العملي الطبيعي (تناول الطعام، ارتداء الملابس، النظافة الشخصية). راقب محاولته الذاتية لأداء: "${skillText}".`;
    } else if (domainId === 'cognitive') {
      return `ضع الأدوات اللازمة أمام الطفل على الطاولة. اعطه التعليمات أو اطلب منه أداء النشاط المتعلق بـ: "${skillText}". لاحظ خطوات تفكيره وتنفيذه.`;
    } else if (domainId === 'motor') {
      return `وفر مساحة آمنة ومفتوحة مناسبة للحركة. اطلب من الطفل أداء الحركة أو قم بنمذجتها أمامه لملاحظة تنفيذ سلوك: "${skillText}".`;
    } else {
      return `ضع الرضيع في وضع مريح وآمن (على الظهر أو البطن أو محمولاً). راقب ردود فعله وانعكاساته الحركية والحسية.`;
    }
  },

  generateCriteria: function(domainId, skillText) {
    return {
      acquired: `يؤدي الطفل السلوك (${skillText}) بنجاح وبشكل متكرر ومستقل في 75% إلى 100% من المواقف الطبيعية.`,
      emerging: `يستطيع الطفل أداء السلوك بمساعدة جزئية أو تذكير، أو ينجح في 25% إلى 50% من المحاولات (قيد الاكتساب).`,
      missing: `لا يستطيع الطفل إظهار المهارة حتى مع التوجيه والمساعدة، أو يفشل في أكثر من 75% من المحاولات.`
    };
  },

  generateExamples: function(domainId, skillText) {
    return [
      `نموذج استجابة صحيحة (+): يؤدي الطفل "${skillText}" بتلقائية عند وجود الموقف أو الطلب.`,
      `نموذج استجابة قيد التدريب (±): يبدأ الطفل بالفعل لكن يحتاج إلى حث إيمائي أو تشجيع مستمر لإكماله.`,
      `نموذج استجابة غير مكتسبة (-): يتجاهل الطفل المثير تماماً أو يعجز عن القيام بالاستجابة المطلوبة.`
    ];
  },

  generateMaterials: function(domainId, skillText) {
    const materialsMap = {
      social: "ألعاب تفاعلية، مرآة، صور عائلية، بيئة لعب جماعية.",
      language: "بطاقات مصورة، مجسمات حيوانات وأطعمة، كتب قصصية ملونة، أدوات تصدر أصواتاً.",
      selfHelp: "ملعقة، كوب بلاستيكي، ملابس سهلة اللبس، فرشاة أسنان، صابون، فوطة.",
      cognitive: "مكعبات خشبية ملونة، لوحة أشكال هندسية، لوحة أوتاد، بطاقات ألوان وتطابق، خرز.",
      motor: "كرات مختلفة الأحجام، مقص آمن للأطفال، صلصال، خشبة توازن، حبل، دراجة أطفال.",
      infant: "شخشيخة، أقمشة ذات ملامس متنوعة، إضاءة خافتة ملونة، زجاجة رضاعة."
    };
    return materialsMap[domainId] || "أدوات منزلية وبيئية مألوفة وآمنة.";
  }
};
