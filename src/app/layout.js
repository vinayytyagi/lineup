import "./globals.css";

export const metadata = {
  title: "Lineup",
  description: "Lineup — a timeline of tasks by date",
  icons: { icon: "/Lineup.png" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
