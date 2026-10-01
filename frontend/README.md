# Kumbh Milaap — Frontend

The frontend for **Kumbh Milaap**, a [Next.js 16](https://nextjs.org) application that helps identify missing persons and reunite families during Kumbh Mela 2027. It includes a public-facing kiosk interface and an admin dashboard.

## Getting Started

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## Pages

| Page            | Route              | Description                                                |
| --------------- | ------------------ | ---------------------------------------------------------- |
| Landing Page    | `/`                | Hero section, How It Works, Features, and Safety & Privacy |
| Kiosk Interface | `/` → **Get Help** | Multi-step wizard for reporting missing persons            |
| Admin Dashboard | `/admin`           | Report submission, live map, and statistics                |

## Tech Stack

- **Framework:** Next.js 16, React 19, TypeScript
- **Styling:** Tailwind CSS 4, shadcn/ui
- **Animation:** Framer Motion
- **Maps:** Leaflet, React-Leaflet
- **Camera:** react-webcam
