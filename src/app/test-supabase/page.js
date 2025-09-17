"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle, XCircle, Database, Loader } from "lucide-react";

export default function TestSupabasePage() {
  const [connectionStatus, setConnectionStatus] = useState("checking");
  const [tableStatus, setTableStatus] = useState("checking");
  const [taskCount, setTaskCount] = useState(null);
  const [error, setError] = useState(null);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    try {
      // Test 1: Check if Supabase client is configured
      if (
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ) {
        setConnectionStatus("error");
        setError("Supabase environment variables are not configured");
        return;
      }
      setConnectionStatus("success");

      // Test 2: Try to fetch from tasks table
      const {
        data,
        error: fetchError,
        count,
      } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true });

      if (fetchError) {
        setTableStatus("error");
        setError(`Table error: ${fetchError.message}`);
      } else {
        setTableStatus("success");
        setTaskCount(count || 0);
      }
    } catch (err) {
      setConnectionStatus("error");
      setError(err.message);
    }
  };

  const testCreateTask = async () => {
    setTestResult("testing");
    try {
      const testTask = {
        title: "Test Task - " + new Date().toLocaleTimeString(),
        description:
          "This is a test task created to verify Supabase connection",
        tags: ["test", "supabase"],
        completed: false,
        created_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("tasks")
        .insert([testTask])
        .select()
        .single();

      if (error) {
        setTestResult("error");
        setError(`Insert error: ${error.message}`);
      } else {
        setTestResult("success");
        setTimeout(() => {
          testConnection(); // Refresh the count
        }, 1000);
      }
    } catch (err) {
      setTestResult("error");
      setError(err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Supabase Connection Test
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Verifying your Supabase setup and configuration
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Connection Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Supabase Connection
            </h2>
            {connectionStatus === "checking" && (
              <Loader className="w-5 h-5 animate-spin text-blue-500" />
            )}
            {connectionStatus === "success" && (
              <CheckCircle className="w-5 h-5 text-green-500" />
            )}
            {connectionStatus === "error" && (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {connectionStatus === "checking" && "Checking connection..."}
              {connectionStatus === "success" &&
                "✅ Environment variables configured"}
              {connectionStatus === "error" &&
                "❌ Environment variables missing"}
            </p>
            {process.env.NEXT_PUBLIC_SUPABASE_URL && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                URL: {process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30)}...
              </p>
            )}
          </div>
        </div>

        {/* Table Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Tasks Table
            </h2>
            {tableStatus === "checking" && (
              <Loader className="w-5 h-5 animate-spin text-blue-500" />
            )}
            {tableStatus === "success" && (
              <CheckCircle className="w-5 h-5 text-green-500" />
            )}
            {tableStatus === "error" && (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {tableStatus === "checking" && "Checking table..."}
              {tableStatus === "success" && `✅ Table exists`}
              {tableStatus === "error" && "❌ Table not found or no access"}
            </p>
            {taskCount !== null && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                Current tasks in database: {taskCount}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
            Error Details:
          </h3>
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Test Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Test Actions
        </h2>

        <div className="space-y-4">
          <div>
            <button
              onClick={testCreateTask}
              disabled={
                connectionStatus !== "success" || tableStatus !== "success"
              }
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <Database className="w-4 h-4" />
              <span>Create Test Task</span>
            </button>
            {testResult === "testing" && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Creating test task...
              </p>
            )}
            {testResult === "success" && (
              <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                ✅ Test task created successfully! Check your tasks page.
              </p>
            )}
            {testResult === "error" && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                ❌ Failed to create test task
              </p>
            )}
          </div>

          <div>
            <button
              onClick={testConnection}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Refresh Status
            </button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-3">
          Setup Checklist:
        </h3>
        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-400">
          <li className="flex items-start">
            <span className="mr-2">
              {connectionStatus === "success" ? "✅" : "⏳"}
            </span>
            <span>Environment variables configured in .env.local</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">
              {tableStatus === "success" ? "✅" : "⏳"}
            </span>
            <span>Tasks table created in Supabase</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">
              {tableStatus === "success" ? "✅" : "⏳"}
            </span>
            <span>Row Level Security policies configured</span>
          </li>
        </ul>

        {connectionStatus === "error" && (
          <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              To fix connection issues:
            </p>
            <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
              <li>Create a .env.local file in your project root</li>
              <li>Add NEXT_PUBLIC_SUPABASE_URL=your-url-here</li>
              <li>Add NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key-here</li>
              <li>Restart your development server</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
