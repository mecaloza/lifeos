import Link from "next/link";
import { CheckSquare, Plus, Database, Trello, BarChart3 } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center py-20">
          <h1 className="text-6xl font-bold mb-6">
            <span className="text-white">LifeOS</span>
          </h1>
          <p className="text-xl text-[#a1a1a1] mb-16 max-w-2xl mx-auto leading-relaxed">
            Your intelligent workspace for managing life, tracking goals, and
            achieving personal growth
          </p>

          {/* Quick Actions */}
          <div className="flex justify-center mb-20">
            <Link
              href="/tasks"
              className="flex items-center space-x-4 px-8 py-4 bg-[#1e1e1e] border border-[#2d2d2d] text-white rounded-lg hover:bg-[#2a2a2a] hover:border-[#3a3a3a] transition-all duration-200 text-lg font-medium"
            >
              <CheckSquare className="w-6 h-6" />
              <span>Enter Tasks</span>
            </Link>
          </div>

          {/* Features List */}
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-white mb-8 text-center">
              Available Features
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
              <Link
                href="/tasks"
                className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6 hover:bg-[#1e1e1e] hover:border-[#3a3a3a] transition-all duration-200 text-left"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg">
                    <CheckSquare className="w-6 h-6 text-[#a1a1a1]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Tasks Management
                    </h3>
                    <p className="text-[#a1a1a1] text-sm mt-1">
                      Create and manage tasks with intelligent tagging system
                    </p>
                  </div>
                </div>
              </Link>

              <Link
                href="/kanban"
                className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6 hover:bg-[#1e1e1e] hover:border-[#3a3a3a] transition-all duration-200 text-left"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg">
                    <Trello className="w-6 h-6 text-[#8B5CF6]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Kanban Board
                    </h3>
                    <p className="text-[#a1a1a1] text-sm mt-1">
                      Visual workflow with drag and drop functionality
                    </p>
                  </div>
                </div>
              </Link>

              <Link
                href="/analytics"
                className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6 hover:bg-[#1e1e1e] hover:border-[#3a3a3a] transition-all duration-200 text-left"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg">
                    <BarChart3 className="w-6 h-6 text-[#F59E0B]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Analytics Dashboard
                    </h3>
                    <p className="text-[#a1a1a1] text-sm mt-1">
                      Track task flow, metrics, and productivity insights
                    </p>
                  </div>
                </div>
              </Link>

              <Link
                href="/test-supabase"
                className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg p-6 hover:bg-[#1e1e1e] hover:border-[#3a3a3a] transition-all duration-200 text-left"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg">
                    <Database className="w-6 h-6 text-[#10b981]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Database Connection
                    </h3>
                    <p className="text-[#a1a1a1] text-sm mt-1">
                      Test and verify your Supabase cloud database setup
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
