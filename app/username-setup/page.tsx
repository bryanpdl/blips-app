'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile, setUsername } from '../lib/firebase/db';
import { motion } from 'framer-motion';

export default function UsernameSetup() {
  const { user } = useAuth();
  const router = useRouter();
  const [username, setUsernameValue] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if user already has a username
    async function checkUsername() {
      if (!user) {
        router.push('/');
        return;
      }

      const profile = await getUserProfile(user.uid);
      if (profile?.username) {
        router.push('/feed');
      }
    }

    checkUsername();
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!user) {
        throw new Error('Not authenticated');
      }

      const success = await setUsername(user.uid, username);
      if (success) {
        router.push('/feed');
      } else {
        setError('Username is already taken or invalid. Please try another one.');
      }
    } catch (error: unknown) {
      console.error('Error setting username:', error);
      setError('Failed to set username. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8 p-8 bg-gray-900 rounded-xl shadow-lg"
      >
        <div>
          <h2 className="text-3xl font-bold text-center text-white mb-2">
            Choose your username
          </h2>
          <p className="text-center text-gray-400">
            This will be your unique @handle on Blips
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-400">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsernameValue(e.target.value.toLowerCase())}
                className="w-full pl-8 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-primary"
                placeholder="username"
                required
                pattern="[a-zA-Z0-9_]{3,20}"
                title="3-20 characters, letters, numbers, and underscores only"
              />
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-500">
                {error}
              </p>
            )}
            <p className="mt-2 text-sm text-gray-400">
              3-20 characters, letters, numbers, and underscores only
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Setting up...' : 'Continue to Blips'}
          </button>
        </form>
      </motion.div>
    </div>
  );
} 