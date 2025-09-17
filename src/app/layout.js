import { Inter } from "next/font/google";
import Link from "next/link";
import { Home } from "lucide-react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Life - Personal Growth & Management",
  description: "Manage your life, track goals, habits, and personal growth",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
          {/* Simple Navigation */}
          <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
            <div className="container mx-auto px-4 max-w-7xl">
              <div className="flex items-center justify-between h-16">
                <Link href="/" className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold">L</span>
                  </div>
                  <span className="text-xl font-bold text-gray-900 dark:text-white">
                    Life
                  </span>
                </Link>
                <Link
                  href="/"
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <Home className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </Link>
              </div>
            </div>
          </nav>

          <main className="container mx-auto px-4 py-8 max-w-7xl">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
