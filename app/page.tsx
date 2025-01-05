'use client';

import { motion } from 'framer-motion';
import AuthForm from './components/auth/AuthForm';
import ProtectedRoute from './components/auth/ProtectedRoute';

export default function Home() {
  return (
    <ProtectedRoute requireAuth={false}>
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold mb-2">Welcome to Blips</h1>
          <p className="text-gray-light">Share your thoughts in a minimalist space</p>
        </motion.div>
        <AuthForm />
      </div>
    </ProtectedRoute>
  );
}
