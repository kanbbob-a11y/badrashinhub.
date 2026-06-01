# تحويل المشروع إلى APK / AAB لجوجل بلاي

المشروع أصبح مجهزًا كـ PWA + Capacitor config، لكن إنشاء ملف Android الفعلي يحتاج Android Studio وAndroid SDK محليًا.

## المهم أولًا
- **Google Play يفضّل AAB وليس APK**
- يمكنك استخراج APK للتجربة الداخلية
- وللنشر على Google Play الأفضل استخراج **AAB**

## 1) تثبيت الأدوات
- Node.js
- Android Studio
- Android SDK
- Java 17 أو النسخة المناسبة مع Android Studio

## 2) تثبيت الاعتمادات
```bash
npm install
```

## 3) بناء نسخة الويب
```bash
npm run build
```

## 4) إنشاء مشروع أندرويد لأول مرة
```bash
npx cap add android
```

## 5) مزامنة المشروع مع أندرويد بعد أي تعديل
```bash
npx cap sync android
```

## 6) فتح المشروع داخل Android Studio
```bash
npx cap open android
```

## 7) استخراج APK للتجربة
من Android Studio:
- Build
- Build Bundle(s) / APK(s)
- Build APK(s)

## 8) استخراج AAB للنشر على Google Play
من Android Studio:
- Build
- Generate Signed Bundle / APK
- Android App Bundle
- أنشئ keystore واحفظه جيدًا
- أكمل خطوات التوقيع

## 9) إعدادات مهمة قبل النشر
### اسم التطبيق
موجود في:
- `capacitor.config.ts`

### الأيقونة
موجودة في:
- `public/icons/app-icon-192.png`
- `public/icons/app-icon-512.png`

### التزامن بين الأجهزة
إذا كنت تريد التزامن الحقيقي بين الأجهزة:
- افتح لوحة الإشراف
- فعّل السحابة
- أضف Firebase config
- احفظ الإعدادات
- ارفع البيانات الحالية للسحابة

## 10) ملاحظات مهمة
- بعد أي تعديل على الواجهة أو المنطق:
```bash
npm run build
npx cap sync android
```
- لو غيّرت الأيقونات أو splash يفضل توليد Android assets من Android Studio أو من أدوات Capacitor assets لاحقًا.

## أوامر سريعة
```bash
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

## حالة المشروع الحالية
- جاهز Web App
- جاهز PWA
- جاهز Capacitor config
- يحتاج فقط تنفيذ أوامر Android محليًا لاستخراج APK / AAB
