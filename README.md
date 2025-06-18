````markdown
# ThinkFast Ebook Backend

An Express.js backend using Prisma ORM and MySQL.

---

## 🛠 Tech Stack

- Node.js
- Express.js
- Prisma ORM
- MySQL
- nodemon (for dev server)

---

## Generate Session Secret
```
openssl rand -base64 64
```

## 🚀 Setup Guide

1️⃣ Install dependencies
```bash
npm install
````

2️⃣ Setup `.env`
Configure your database URL:

```
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE"
```

3️⃣ Define your Prisma schema
Edit `prisma/schema.prisma` with your tables (e.g., `User`).

4️⃣ Push schema to the database

```bash
npx prisma db push
```

5️⃣ Generate Prisma client

```bash
npx prisma generate
```

6️⃣ Run the development server

```bash
npm run dev
```

---

## 🌐 API Base URL

```
http://localhost:3500/api/
```

Example routes:

* `POST /api/users` → create user
* `GET /api/users` → list users

---

## 🔒 Notes

✅ Prisma client is set up under `/models/prisma.js`
✅ Routes are organized under `/routes`


npx prisma db push
