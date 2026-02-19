import "./globals.css";

export const metadata = {
  title: "Lineup",
  description: "Lineup — a timeline of tasks by date",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
