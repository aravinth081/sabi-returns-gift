 import React, { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Login from "./pages/Login";

const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes cache
      gcTime: 1000 * 60 * 30, // 30 minutes in-memory
      refetchOnWindowFocus: false,
    },
  },
});

// Minimal seamless transition fallback - no intrusive intro scene or loading bars
const RouteLoadingFallback = () => (
  <div className="min-h-[100dvh] w-full bg-[#060a14]" />
);

const App = () => (
  <ErrorBoundary fallbackTitle="Application Initialization Error">
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<RouteLoadingFallback />}>
                <Routes>
                  {/* Main redirect to dashboard */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  
                  {/* Application Core Views & Direct Routes */}
                  <Route path="/chat" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/products" element={<Dashboard initialTab="products" />} />
                  <Route path="/inventories" element={<Dashboard initialTab="inventories" />} />
                  <Route path="/daily-tasks" element={<Dashboard initialTab="daily_tasks" />} />
                  <Route path="/reports" element={<Dashboard initialTab="reports" />} />
                  <Route path="/attendance" element={<Dashboard initialTab="attendance" />} />
                  <Route path="/nueva" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/orders" element={<Navigate to="/dashboard" replace />} />
                  
                  {/* Fallback route - gracefully redirect to dashboard instead of blank screen */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;