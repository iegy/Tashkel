# عربي — أدوات التشكيل والتصحيح

مشروع "عربي" لتشكيل اللغة العربية وتصحيح الإملاء.

الهدف: بناء نظام دقيق ومتكامل يقدم خدمة diacritization (إضافة الحركات) وتصحيح إملائي، مع إمكانية تحسين الدقة باستخدام نماذج Hugging Face المخصصة.

محتوى الفرع:
- backend/: FastAPI app (endpoints: /api/diacritize, /api/spellcheck)
- frontend/: واجهة بسيطة (HTML/JS/CSS) تتكامل مع الـ API
- Dockerfile: لصورة backend
- README.md: تعليمات التشغيل والتدريب
- .gitignore

ملاحظات سريعة:
- التطبيق يعمل بشكل افتراضي بخوارزميات rule-based وfallback. لتحصل على دقة عالية فعّل متغير البيئة DIACRITIZER_MODEL إلى اسم موديل من Hugging Face مدرّب على التشكيل أو نزّل موديل مُدَرّب ثم ضع اسمه.
- لزيادة الدقة: تتضمن التعليمات طريقة fine-tune على Tashkeela / QALB.

---
