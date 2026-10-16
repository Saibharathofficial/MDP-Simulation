import './globals.css';

export const metadata = {
  title: 'AquaGuard — Underwater Leak Detection System',
  description: 'Advanced real-time simulation and monitoring dashboard for underwater pipeline leak detection using pressure, flow, and acoustic analysis.',
  keywords: ['water leak detection', 'pipeline monitoring', 'simulation', 'pressure analysis', 'underwater pipeline'],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
