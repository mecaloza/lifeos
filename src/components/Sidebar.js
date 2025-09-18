"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CheckSquare,
  Calendar,
  BarChart3,
  Settings,
  User,
  Database,
  Plus,
  Trello,
  FileText,
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();

  const menuItems = [
    {
      icon: Home,
      href: "/",
      label: "Home",
    },
    {
      icon: CheckSquare,
      href: "/tasks",
      label: "Tasks",
    },
    {
      icon: Trello,
      href: "/kanban",
      label: "Kanban",
    },
    {
      icon: FileText,
      href: "/notes",
      label: "Notes",
    },
    {
      icon: Calendar,
      href: "/calendar",
      label: "Calendar",
    },
    {
      icon: BarChart3,
      href: "/analytics",
      label: "Dashboard",
    },
    {
      icon: User,
      href: "/profile",
      label: "Profile",
    },
    {
      icon: Database,
      href: "/test-supabase",
      label: "Database",
    },
    {
      icon: Settings,
      href: "/settings",
      label: "Settings",
    },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-16 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col items-center py-4 z-50">
      {/* Logo/Brand */}
      <div className="w-10 h-10 bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a] border border-[#3a3a3a] rounded-lg flex items-center justify-center mb-8">
        <span className="text-white font-bold text-lg">L</span>
      </div>

      {/* Navigation Items */}
      <nav className="flex flex-col space-y-2 flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative w-12 h-12 flex items-center justify-center rounded-lg transition-all duration-200 ${
                isActive
                  ? "bg-[#1e1e1e] border border-[#3a3a3a]"
                  : "hover:bg-[#1a1a1a] border border-transparent hover:border-[#2a2a2a]"
              }`}
            >
              <Icon
                className={`w-5 h-5 transition-colors duration-200 ${
                  isActive
                    ? "text-white"
                    : "text-[#a1a1a1] group-hover:text-white"
                }`}
              />

              {/* Tooltip */}
              <div className="absolute left-16 bg-[#2a2a2a] border border-[#3a3a3a] text-white text-sm px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                {item.label}
              </div>

              {/* Active indicator */}
              {isActive && (
                <div className="absolute -left-1 top-1/2 transform -translate-y-1/2 w-1 h-6 bg-white rounded-r-full"></div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Action Button */}
      <div className="mt-auto">
        <Link
          href="/tasks"
          className="w-12 h-12 bg-[#1e1e1e] border border-[#3a3a3a] rounded-lg flex items-center justify-center hover:bg-[#2a2a2a] hover:border-[#4a4a4a] transition-all duration-200 group"
        >
          <Plus className="w-5 h-5 text-[#a1a1a1] group-hover:text-white transition-colors duration-200" />

          {/* Tooltip */}
          <div className="absolute left-16 bg-[#2a2a2a] border border-[#3a3a3a] text-white text-sm px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
            Create Task
          </div>
        </Link>
      </div>
    </aside>
  );
}
