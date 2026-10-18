export type LanguageCode = 'en' | 'ur' | 'pa' | 'sd' | 'ps';

export interface TranslationStrings {
  appName: string;
  appTagline: string;
  quickSale: string;
  dashboard: string;
  products: string;
  transactions: string;
  udhaarKhata: string;
  expenses: string;
  cashClosing: string;
  reports: string;
  language: string;

  // Shared UI chrome
  assistantLabel: string;
  ask: string;
  selectLanguage: string;
  searchLanguage: string;
  noLanguagesFound: string;

  // POS / Quick Sale
  searchPlaceholder: string;
  currentBill: string;
  emptyCart: string;
  subtotal: string;
  payableTotal: string;
  paymentMethod: string;
  cash: string;
  wallet: string;
  bank: string;
  udhaar: string;
  confirmBill: string;
  reviewBill: string;
  clearCart: string;
  selectCustomer: string;
  customerRequiredForUdhaar: string;
  saleConfirmed: string;

  // Products
  productCatalog: string;
  addProduct: string;
  editProduct: string;
  productName: string;
  category: string;
  stock: string;
  purchasePrice: string;
  sellingPrice: string;
  lowStockAlert: string;

  // Udhaar Khata
  totalOutstandingCredit: string;
  registeredCustomers: string;
  recordPayment: string;
  giveCredit: string;
  dueBalance: string;
  settled: string;

  // Expenses
  recordExpense: string;
  cashExpenses: string;
  walletExpenses: string;
  categoryRent: string;
  categoryElectricity: string;
  categoryTransport: string;
  categoryWages: string;
  categoryPackaging: string;
  categoryMaintenance: string;
  categoryMisc: string;

  // Cash Closing / Roznamcha
  dailyCashClosing: string;
  openingCash: string;
  cashSales: string;
  cashRepayments: string;
  expectedInDrawer: string;
  physicalCashCount: string;
  drawerDifference: string;
  finalizeAndLock: string;
  saveDraft: string;

  // Assistant
  assistantPlaceholder: string;
}

export const TRANSLATIONS: Record<LanguageCode, TranslationStrings> = {
  en: {
    appName: 'DukaanVoice PK',
    appTagline: 'Pakistan Digital Shop Register & POS',
    quickSale: 'Quick Sale',
    dashboard: 'Dashboard',
    products: 'Products',
    transactions: 'Transactions',
    udhaarKhata: 'Udhaar Khata',
    expenses: 'Expenses',
    cashClosing: 'Cash Closing (Roznamcha)',
    reports: 'Reports',
    language: 'Language',

    assistantLabel: 'Assistant',
    ask: 'Ask',
    selectLanguage: 'Select Language',
    searchLanguage: 'Search language…',
    noLanguagesFound: 'No languages found.',

    searchPlaceholder: 'Search product by name or barcode (e.g. Atta, Rice, Oil)...',
    currentBill: 'Current Bill / Cart',
    emptyCart: 'No items in cart. Search products above or select from catalog.',
    subtotal: 'Subtotal',
    payableTotal: 'Grand Total Payable',
    paymentMethod: 'Payment Method',
    cash: '💵 Cash (نقد)',
    wallet: '📱 JazzCash / EasyPaisa / Raast',
    bank: '🏛 Bank Transfer',
    udhaar: '🤝 Udhaar (Customer Credit)',
    confirmBill: 'Confirm & Record Sale',
    reviewBill: 'Review & Confirm Bill',
    clearCart: 'Clear Bill',
    selectCustomer: 'Select Customer for Udhaar',
    customerRequiredForUdhaar: 'Customer account is required when selling on credit.',
    saleConfirmed: 'Sale recorded successfully in ledger',

    productCatalog: 'Product & Stock Catalog',
    addProduct: 'Add New Product',
    editProduct: 'Edit Product',
    productName: 'Product Name',
    category: 'Category',
    stock: 'Stock Quantity',
    purchasePrice: 'Purchase Cost (Rs.)',
    sellingPrice: 'Retail Price (Rs.)',
    lowStockAlert: 'Low Stock Alert',

    totalOutstandingCredit: 'Total Outstanding Udhaar',
    registeredCustomers: 'Registered Customers',
    recordPayment: 'Record Payment (Jama)',
    giveCredit: 'Give Credit (Udhaar)',
    dueBalance: 'Due Balance',
    settled: 'Clear / Settled',

    recordExpense: 'Record Expense',
    cashExpenses: 'Cash Paid (Till Deduction)',
    walletExpenses: 'JazzCash / EasyPaisa / Bank',
    categoryRent: 'Shop Rent (دکان کا کرایہ)',
    categoryElectricity: 'Electricity / WAPDA / LESCO (بجلی کا بل)',
    categoryTransport: 'Transport & Freight (کرایہ مال)',
    categoryWages: 'Labor & Wages (مزدوری و تنخواہ)',
    categoryPackaging: 'Shopping Bags / Lifafay (لفافے و پیکنگ)',
    categoryMaintenance: 'Repairs & Maintenance (مرمت)',
    categoryMisc: 'Staff Tea & Miscellaneous (چائے و متفرق)',

    dailyCashClosing: 'Daily Roznamcha & Cash Drawer Closing',
    openingCash: 'Opening Cash (صبح کا کیش)',
    cashSales: 'Cash Sales (+ نقد فروخت)',
    cashRepayments: 'Cash Udhaar Jama (+ ادھار وصولی)',
    expectedInDrawer: 'Expected Cash in Till (گلے کا کیش)',
    physicalCashCount: 'Counted Cash in Drawer (گنے ہوئے نوٹ و سکے)',
    drawerDifference: 'Drawer Difference (فرق)',
    finalizeAndLock: 'Finalize & Lock Business Day',
    saveDraft: 'Save Draft Closing',

    assistantPlaceholder: 'Ask in Urdu or English (e.g. "kam stock", "aaj ki sale", "5 kg atta")...',
  },

  ur: {
    appName: 'دکان وائس پاکستان',
    appTagline: 'ڈیجیٹل دکان کھاتہ، پوائنٹ آف سیل اور روزنامچہ',
    quickSale: 'فوری فروخت (سیل)',
    dashboard: 'ڈیش بورڈ',
    products: 'سامان و اسٹاک',
    transactions: 'رسیدیں و کھاتہ',
    udhaarKhata: 'ادھار کھاتہ',
    expenses: 'دکان اخراجات',
    cashClosing: 'روزنامچہ و کیش کلوزنگ',
    reports: 'کاروباری رپورٹس',
    language: 'زبان (Language)',

    assistantLabel: 'معاون',
    ask: 'پوچھیں',
    selectLanguage: 'زبان منتخب کریں',
    searchLanguage: 'زبان تلاش کریں…',
    noLanguagesFound: 'کوئی زبان نہیں ملی۔',

    searchPlaceholder: 'سامان تلاش کریں (مثلاً آٹا، چاول، گھی، دال، مصالحہ)...',
    currentBill: 'موجودہ بل / ٹوکری',
    emptyCart: 'بل خالی ہے۔ اوپر تلاش کریں یا سامان منتخب کریں۔',
    subtotal: 'میزان (Subtotal)',
    payableTotal: 'کل واجب الادا رقم',
    paymentMethod: 'طریقہ ادائیگی',
    cash: '💵 نقد (Cash)',
    wallet: '📱 جاز کیش / ایزی پیسہ / راست',
    bank: '🏛 بینک ٹرانسفر',
    udhaar: '🤝 ادھار کھاتہ',
    confirmBill: 'بل محفوظ کریں اور رسید بنائیں',
    reviewBill: 'بل کی جانچ اور تصدیق',
    clearCart: 'بل صاف کریں',
    selectCustomer: 'گاہک کا نام منتخب کریں',
    customerRequiredForUdhaar: 'ادھار پر سامان فروخت کرنے کے لیے گاہک کا نام لازمی ہے۔',
    saleConfirmed: 'فروخت کامیابی کے ساتھ درج ہو گئی ہے',

    productCatalog: 'دکان کا سامان اور انوینٹری',
    addProduct: 'نیا سامان شامل کریں',
    editProduct: 'سامان میں تبدیلی کریں',
    productName: 'سامان کا نام',
    category: 'قسم (کیٹیگری)',
    stock: 'دستیاب مقدار (اسٹاک)',
    purchasePrice: 'خریداری قیمت (روپے)',
    sellingPrice: 'فروخت قیمت (روپے)',
    lowStockAlert: 'کم اسٹاک الرٹ',

    totalOutstandingCredit: 'مارکیٹ میں کل ادھار',
    registeredCustomers: 'رجسٹرڈ گاہک',
    recordPayment: 'ادھار وصولی (جمع)',
    giveCredit: 'ادھار دیں (نام)',
    dueBalance: 'بقایا رقم',
    settled: 'حساب بے باق',

    recordExpense: 'خرچہ درج کریں',
    cashExpenses: 'نقد خرچہ (گلے سے ادائیگی)',
    walletExpenses: 'جاز کیش / ایزی پیسہ / بینک',
    categoryRent: 'دکان کا کرایہ',
    categoryElectricity: 'بجلی کا بل (لیسکو / کے الیکٹرک)',
    categoryTransport: 'مال برداری و ٹرانسپورٹ',
    categoryWages: 'ملازمین کی تنخواہ و مزدوری',
    categoryPackaging: 'شاپنگ بیگز و لفافے',
    categoryMaintenance: 'دکان کی مرمت و صفائی',
    categoryMisc: 'چائے، پانی اور متفرق اخراجات',

    dailyCashClosing: 'روزانہ کا روزنامچہ اور کیش ڈراور کلوزنگ',
    openingCash: 'صبح کا کیش (اوپننگ فلوٹ)',
    cashSales: 'دن بھر کی نقد فروخت (+)',
    cashRepayments: 'ادھار وصولی نقد (+)',
    expectedInDrawer: 'گلے میں مطلوبہ کیش (=)',
    physicalCashCount: 'گنے ہوئے نوٹ اور سکے',
    drawerDifference: 'کیش کا فرق (کمی / بیشی)',
    finalizeAndLock: 'آج کا دن مکمل اور بند کریں (لاک)',
    saveDraft: 'ڈرافٹ محفوظ کریں',

    assistantPlaceholder: 'اردو یا انگریزی میں بولیں یا لکھیں (مثلاً "آٹا"، "کم اسٹاک"، "آج کی سیل")...',
  },

  pa: {
    appName: 'دکان وائس پاکستان',
    appTagline: 'ڈیجیٹل دکان کھاتہ تے روزنامچہ',
    quickSale: 'چھٹی سیل (فروخت)',
    dashboard: 'ڈیش بورڈ',
    products: 'دکان دا سامان',
    transactions: 'رسیداں تے کھاتے',
    udhaarKhata: 'ادھار کھاتہ',
    expenses: 'دکان دے خرچے',
    cashClosing: 'روزنامچہ تے گلے دا حساب',
    reports: 'کاروباری رپورٹ',
    language: 'بولی (Language)',

    assistantLabel: 'معاون',
    ask: 'پچھو',
    selectLanguage: 'بولی چنو',
    searchLanguage: 'بولی لبھو…',
    noLanguagesFound: 'کوئی بولی نئیں لبھی۔',

    searchPlaceholder: 'سامان لبھو (مثلاً آٹا، چاول، تیل، کھنڈ)...',
    currentBill: 'ہن دا بل',
    emptyCart: 'بل خالی اے۔ سامان چنو۔',
    subtotal: 'میزان',
    payableTotal: 'کل بنڑی رقم',
    paymentMethod: 'پیسے دین دا طریقہ',
    cash: '💵 نقد کیش',
    wallet: '📱 جاز کیش / ایزی پیسہ',
    bank: '🏛 بینک',
    udhaar: '🤝 ادھار کھاتہ',
    confirmBill: 'سیل پکی کرو',
    reviewBill: 'بل ویکھو تے پکا کرو',
    clearCart: 'بل خالی کرو',
    selectCustomer: 'گاہک چنو',
    customerRequiredForUdhaar: 'ادھار لئی گاہک ضروری اے۔',
    saleConfirmed: 'سیل درج ہو گئی اے',

    productCatalog: 'سامان دی لسٹ',
    addProduct: 'نواں سامان پاؤ',
    editProduct: 'سامان بدلو',
    productName: 'سامان دا ناں',
    category: 'قسم',
    stock: 'موجود مال',
    purchasePrice: 'خرید ریٹ (روپے)',
    sellingPrice: 'وکن ریٹ (روپے)',
    lowStockAlert: 'تھوڑا رہ گیا مال',

    totalOutstandingCredit: 'مارکیٹ چ کل ادھار',
    registeredCustomers: 'کل گاہک',
    recordPayment: 'رقم وصولی (جمع)',
    giveCredit: 'ادھار مال دیو',
    dueBalance: 'بقایا',
    settled: 'صاف کھاتہ',

    recordExpense: 'خرچہ لکھو',
    cashExpenses: 'گلے چوں نقد خرچہ',
    walletExpenses: 'موبائل والٹ خرچہ',
    categoryRent: 'دکان دا کرایہ',
    categoryElectricity: 'بجلی دا بل',
    categoryTransport: 'مال دا کرایہ',
    categoryWages: 'تنخواہ تے دیہاڑی',
    categoryPackaging: 'شاپر تے لفافے',
    categoryMaintenance: 'مرمت',
    categoryMisc: 'چاہ تے متفرق',

    dailyCashClosing: 'روز دا روزنامچہ تے گلے دا حساب',
    openingCash: 'صبح دا کیش',
    cashSales: 'نقد وِکری (+)',
    cashRepayments: 'ادھار وصولی (+)',
    expectedInDrawer: 'گلے چ ہونا چاہی دا کیش',
    physicalCashCount: 'گنے ہوئے نوٹ',
    drawerDifference: 'کیش دا فرق',
    finalizeAndLock: 'دن مکمل تے بند کرو',
    saveDraft: 'ڈرافٹ رکھو',

    assistantPlaceholder: 'پنجابی یا اردو چ پچھو (مثلاً "اج دی سیل"، "تھوڑا مال")...',
  },

  sd: {
    appName: 'دڪان وائس پاڪستان',
    appTagline: 'ڊجيٽل دڪان کاتو ۽ روزنامچو',
    quickSale: 'جلدي وڪرو',
    dashboard: 'ڊيش بورڊ',
    products: 'سامان ۽ اسٽاڪ',
    transactions: 'رسيدون ۽ کاتو',
    udhaarKhata: 'اُڌار کاتو',
    expenses: 'دڪان جا خرچ',
    cashClosing: 'روزنامچو ۽ ڪيش بندش',
    reports: 'رپورٽون',
    language: 'ٻولي (Language)',

    assistantLabel: 'مددگار',
    ask: 'پڇو',
    selectLanguage: 'ٻولي چونڊيو',
    searchLanguage: 'ٻولي ڳوليو…',
    noLanguagesFound: 'ڪا ٻولي نه ملي.',

    searchPlaceholder: 'سامان ڳوليو (مثال: اٽو، چانور، تيل)...',
    currentBill: 'هاڻوڪو بل',
    emptyCart: 'بل خالي آهي.',
    subtotal: 'ڪل رقم',
    payableTotal: 'واجب الادا رقم',
    paymentMethod: 'ادائيگي جو طريقو',
    cash: '💵 نقد (Cash)',
    wallet: '📱 ايزي پئسا / جاز ڪيش',
    bank: '🏛 بئنڪ',
    udhaar: '🤝 اُڌار',
    confirmBill: 'وڪرو پڪو ڪريو',
    reviewBill: 'بل چڪاسيو',
    clearCart: 'بل صاف ڪريو',
    selectCustomer: 'گراهڪ چونڊيو',
    customerRequiredForUdhaar: 'اُڌار لاءِ گراهڪ جو نالو لازمي آهي.',
    saleConfirmed: 'وڪرو درج ٿي ويو',

    productCatalog: 'سامان جي فهرست',
    addProduct: 'نئون سامان شامل ڪريو',
    editProduct: 'سامان تبديل ڪريو',
    productName: 'سامان جو نالو',
    category: 'قسم',
    stock: 'اسٽاڪ',
    purchasePrice: 'خريداري قيمت (روپيا)',
    sellingPrice: 'وڪري قيمت (روپيا)',
    lowStockAlert: 'گهٽ اسٽاڪ الرٽ',

    totalOutstandingCredit: 'ڪل اڌار',
    registeredCustomers: 'گراهڪ',
    recordPayment: 'اڌار وصولي (جمع)',
    giveCredit: 'اڌار ڏيو',
    dueBalance: 'بقايو',
    settled: 'بي باق',

    recordExpense: 'خرچ لکو',
    cashExpenses: 'نقد خرچ',
    walletExpenses: 'ڊجيٽل والٽ',
    categoryRent: 'دڪان جو ڀاڙو',
    categoryElectricity: 'بجلي جو بل',
    categoryTransport: 'ٽرانسپورٽ خرچ',
    categoryWages: 'مزدوري ۽ پگهار',
    categoryPackaging: 'شاپر ۽ ٿيلها',
    categoryMaintenance: 'مرمت',
    categoryMisc: 'چانهه ۽ متفرق',

    dailyCashClosing: 'روزنامچو ۽ گلي جو حساب',
    openingCash: 'صبح جو ڪيش',
    cashSales: 'نقد وڪرو (+)',
    cashRepayments: 'اڌار وصولي (+)',
    expectedInDrawer: 'گلي ۾ گهربل ڪيش',
    physicalCashCount: 'ڳڻيل روپيا',
    drawerDifference: 'فرق',
    finalizeAndLock: 'ڏينهن مڪمل ڪريو',
    saveDraft: 'ڊرافٽ محفوظ ڪريو',

    assistantPlaceholder: 'سنڌي يا اردو ۾ لکو...',
  },

  ps: {
    appName: 'دوکان وائس پاکستان',
    appTagline: 'ډیجیټل دوکان او حساب کتاب',
    quickSale: 'چټک خرڅلاو',
    dashboard: 'ډشبورډ',
    products: 'سامان او مال',
    transactions: 'رسیدونه او حسابونه',
    udhaarKhata: 'قرضه او پور',
    expenses: 'د دوکان لګښتونه',
    cashClosing: 'روزنامچه او د کیش حساب',
    reports: 'رپوټونه',
    language: 'ژبه (Language)',

    assistantLabel: 'مرستندوی',
    ask: 'وپوښته',
    selectLanguage: 'ژبه وټاکئ',
    searchLanguage: 'ژبه ولټوئ…',
    noLanguagesFound: 'هیڅ ژبه ونه موندل شوه.',

    searchPlaceholder: 'سامان ولټوئ (اوړه، وریجې، غوړي)...',
    currentBill: 'اوسنی بل',
    emptyCart: 'بل تش دی.',
    subtotal: 'ټوله رقم',
    payableTotal: 'د ورکړې وړ پیسې',
    paymentMethod: 'د ورکړې لار',
    cash: '💵 نغدې (Cash)',
    wallet: '📱 جاز کیش / ایزي پیسه',
    bank: '🏛 بانک',
    udhaar: '🤝 قرض (پور)',
    confirmBill: 'پلور تایید کړئ',
    reviewBill: 'بل وګورئ',
    clearCart: 'بل پاک کړئ',
    selectCustomer: 'پېرودونکی وټاکئ',
    customerRequiredForUdhaar: 'د پور لپاره پېرودونکی اړین دی.',
    saleConfirmed: 'پلور ثبت شو',

    productCatalog: 'د سامان لړلیک',
    addProduct: 'نوی مال زیات کړئ',
    editProduct: 'سامان بدل کړئ',
    productName: 'د مال نوم',
    category: 'ډول',
    stock: 'شته مال',
    purchasePrice: 'د اخیستو بیه (روپۍ)',
    sellingPrice: 'د خرڅ بیه (روپۍ)',
    lowStockAlert: 'کم شوی مال',

    totalOutstandingCredit: 'ټول پورونه',
    registeredCustomers: 'پېرودونکي',
    recordPayment: 'د پور وصولي (جمع)',
    giveCredit: 'پور ورکړئ',
    dueBalance: 'پاتې پیسې',
    settled: 'خلاص حساب',

    recordExpense: 'لګښت ولیکئ',
    cashExpenses: 'نغد لګښتونه',
    walletExpenses: 'ډیجیټل والټ',
    categoryRent: 'د دوکان کرایه',
    categoryElectricity: 'د برېښنا بل',
    categoryTransport: 'کرایه او بار وړل',
    categoryWages: 'مزدوري او تنخواګانې',
    categoryPackaging: 'کڅوړې او شاپرونه',
    categoryMaintenance: 'ترمیم او صفا کول',
    categoryMisc: 'چای او متفرقه',

    dailyCashClosing: 'روزنامچه او د نغدو حساب',
    openingCash: 'د سهار پیسې',
    cashSales: 'نغد پلور (+)',
    cashRepayments: 'د پور وصولي (+)',
    expectedInDrawer: 'په ګله کې پاتې پیسې',
    physicalCashCount: 'شمېرل شوي نوټونه',
    drawerDifference: 'د پیسو توپیر',
    finalizeAndLock: 'ورځ بنده کړئ (لاک)',
    saveDraft: 'ډرافټ وساتئ',

    assistantPlaceholder: 'پښتو یا اردو کې ولیکئ...',
  },
};

export function getTranslation(langCode: string): TranslationStrings {
  return TRANSLATIONS[(langCode as LanguageCode)] ?? TRANSLATIONS.en;
}

/**
 * Languages written right-to-left. Urdu and the other Pakistani regional
 * languages supported here all use the Arabic script, so the UI must flip to
 * RTL layout when one of them is active.
 */
export const RTL_LANGUAGES: readonly LanguageCode[] = ['ur', 'pa', 'sd', 'ps'];

export function isRTLLanguage(langCode: string): boolean {
  return (RTL_LANGUAGES as readonly string[]).includes(langCode);
}
