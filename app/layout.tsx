import './globals.css';
import { AuthProvider } from './contexts/AuthContext';
import { Public_Sans } from 'next/font/google';

const publicSans = Public_Sans({ subsets: ['latin'] });

export const metadata = {
  title: 'Blips',
  description: 'Share your thoughts with the world',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${publicSans.className} bg-[#17151B] text-white min-h-screen`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
