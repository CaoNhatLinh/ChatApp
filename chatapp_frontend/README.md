# Nối frontend

The frontend is a Next.js 16 App Router application with React 19 and
TypeScript. Next is the only supported development, build, and production
runtime.

npm install
npm run dev

Production verification: npm run validate, npm run build, npm run start.

Set NEXT_PUBLIC_API_URL and NEXT_PUBLIC_WS_URL in .env when the backend does
not use the local defaults. The global operator workspace is available at
/admin and uses the same frontend deployment as the end-user application.

Google sign-in is optional and hidden until both sides are configured. Follow
[the Firebase setup guide](../docs/FIREBASE_GOOGLE_AUTH_SETUP.md); only public
Firebase Web config belongs in frontend environment variables.
