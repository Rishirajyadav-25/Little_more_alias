import './globals.css'

export const metadata = {
  title: 'Email Alias Service',
  description: 'Create and manage email aliases',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}