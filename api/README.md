# Kuakata Multimedia Finance - PHP & MySQL (phpMyAdmin) Backend

এই ডিরেক্টরিতে সাইটের সম্পূর্ণ **PHP + MySQL (phpMyAdmin)** ব্যাকএন্ড রয়েছে। এটি যেকোনো সাধারণ cPanel বা Apache/MySQL হোস্টিংয়ে সরাসরি কাজ করার জন্য তৈরি।

---

## ১. cPanel ও phpMyAdmin এ ডাটাবেস সেটআপ

1. আপনার cPanel-এ লগইন করুন।
2. **"MySQL® Database Wizard"**-এ গিয়ে একটি নতুন ডাটাবেস এবং ইউজার তৈরি করুন (সব প্রিভিলেজ / All Privileges টিক দিন)।
3. cPanel থেকে **"phpMyAdmin"** ওপেন করুন।
4. বাম পাশে আপনার তৈরি করা ডাটাবেস সিলেক্ট করুন।
5. উপরে **"Import"** ট্যাবে ক্লিক করুন।
6. **`api/database.sql`** ফাইলটি সিলেক্ট করে নিচে **"Go"** বাটনে ক্লিক করুন। 
   * এর মাধ্যমে সব টেবিল (users, members, attendance, payments, shootings, channels ইত্যাদি) তৈরি হয়ে যাবে এবং ডিফল্ট অ্যাডমিন ও ১৯ জন মেম্বার স্বয়ংক্রিয়ভাবে ইনসার্ট হয়ে যাবে।

---

## ২. ডাটাবেস কানেকশন কনফিগারেশন

ফাইলটি ওপেন করুন:
`api/config/config.php`

আপনার cPanel MySQL ক্রেডেনশিয়াল বসিয়ে দিন:
```php
'db' => [
    'host'     => 'localhost',
    'port'     => '3306',
    'database' => 'আপনার_cpanel_ডাটাবেস_নাম',
    'username' => 'আপনার_cpanel_ডাটাবেস_ইউজার',
    'password' => 'আপনার_ডাটাবেস_পাসওয়ার্ড',
    'charset'  => 'utf8mb4',
],
```

---

## ৩. cPanel এ ফাইল আপলোড করার নিয়ম

1. ফ্রন্টএন্ড বিল্ড করতে রান করুন: `npm run build`
2. বিল্ডের পর ফাইলগুলো এবং `api/` ফোল্ডার আপনার cPanel-এর `public_html/`-এ আপলোড করুন:
   ```text
   public_html/
   ├── api/                  <-- এই PHP API ফোল্ডার
   ├── uploads/              <-- আপলোড ডিরেক্টরি
   ├── assets/               <-- বিল্ড এসেটস
   ├── index.html            <-- ফ্রন্টএন্ড মূল ফাইল
   └── .htaccess             <-- রুট রিরাইট রুলস
   ```

---

## ৪. ডিফল্ট লগইন তথ্য
* **ইউজারনেম / আইডি:** `adminkm`
* **ডিফল্ট পাসওয়ার্ড:** `01747729757@SK`

---

## ৫. লোকাল ডেভেলপমেন্ট (Local Dev)
লোকাল পিসিতে PHP ব্যাকএন্ড টেস্ট করতে:
```bash
npm run dev:php
```
অথবা শুধু পিএইচপি ব্যাকএন্ড রান করতে:
```bash
npm run php:dev
```
API Health Check URL: [http://localhost:5000/api/health](http://localhost:5000/api/health)
