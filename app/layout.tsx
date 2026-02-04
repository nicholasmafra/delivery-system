import { CartProvider } from '@/context/CartContext';
import { ToastProvider } from '@/components/ToastProvider';
import { LoadingProvider } from '@/components/LoadingProvider';
import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Help Gela - Conveniência & Delivery',
  description: 'O gelo e a bebida que você precisa, onde você estiver.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-br">
      <body className={inter.className}>
        {/* O CartProvider DEVE envolver o children para o erro sumir */}
        <ToastProvider>
          <LoadingProvider>
            <CartProvider>
              {children}
            </CartProvider>
          </LoadingProvider>
        </ToastProvider>
      </body>
    </html>
  );
};