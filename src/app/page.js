import Link from "next/link";
import { CheckSquare, Plus, Database } from "lucide-react";

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="text-center py-20">
        <h1 className="text-5xl font-bold mb-4">
          <span className="bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
            Life
          </span>
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-12">
          Your personal growth and management app
        </p>

        {/* Quick Actions */}
        <div className="flex justify-center">
          <Link
            href="/tasks"
            className="flex items-center space-x-3 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-colors shadow-lg"
          >
            <CheckSquare className="w-5 h-5" />
            <span className="font-medium">Go to Tasks</span>
          </Link>
        </div>

        {/* Features List */}
        <div className="mt-20 max-w-2xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-6">
            Available Features
          </h2>
          <div className="grid grid-cols-1 gap-4">
            <Link
              href="/tasks"
              className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow text-left"
            >
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <CheckSquare className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Tasks Management
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Create and manage tasks with tags
                  </p>
                </div>
              </div>
            </Link>

            <Link
              href="/test-supabase"
              className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow text-left border-2 border-green-500"
            >
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                  <Database className="w-6 h-6 text-green-600 dark:text-green-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Test Supabase Connection
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Verify your Supabase setup is working
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
