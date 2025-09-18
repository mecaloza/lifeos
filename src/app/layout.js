import { Inter } from "next/font/google";
import Link from "next/link";
import { Home } from "lucide-react";
import Sidebar from "@/components/Sidebar";
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
        <div className="min-h-screen bg-black flex">
          {/* Sidebar */}
          <Sidebar />

          {/* Main Content Area */}
          <div className="flex-1 ml-16">
            {/* Top Navigation */}
            <nav className="bg-[#1a1a1a] border-b border-[#2d2d2d] sticky top-0 z-40">
              <div className="px-6 max-w-7xl">
                <div className="flex items-center justify-between h-16">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl font-bold text-white">
                      LifeOS
                    </span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 bg-[#2a2a2a] border border-[#3a3a3a] rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">U</span>
                    </div>
                  </div>
                </div>
              </div>
            </nav>

            <main>{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
