'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { updateUserProfile, setUsername as setUsernameDb, isUsernameAvailable, type UserProfile } from '../../lib/firebase/db';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onUpdate: (updatedProfile: Partial<UserProfile>) => void;
}

export default function EditProfileModal({ isOpen, onClose, profile, onUpdate }: EditProfileModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState(profile.name);
  const [username, setUsername] = useState(profile.username || '');
  const [bio, setBio] = useState(profile.bio);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!user) throw new Error('Not authenticated');

      // Only check username availability if it changed
      if (username !== profile.username) {
        const isAvailable = await isUsernameAvailable(username);
        if (!isAvailable) {
          setError('Username is already taken or invalid');
          setIsLoading(false);
          return;
        }
        await setUsernameDb(user.uid, username);
      }

      // Update profile with name and bio
      await updateUserProfile(user.uid, {
        name,
        bio,
      });

      // Notify parent component of the update
      onUpdate({
        name,
        username,
        bio,
      });

      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-dark rounded-xl p-6 max-w-md w-full mx-4"
      >
        <h2 className="text-2xl font-bold mb-4">Edit Profile</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-light mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-background rounded-lg text-white"
              maxLength={50}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-light mb-1">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="w-full pl-8 pr-3 py-2 bg-background rounded-lg text-white"
                pattern="[a-zA-Z0-9_]{3,20}"
                title="3-20 characters, letters, numbers, and underscores only"
                required
              />
            </div>
            <p className="mt-1 text-sm text-gray-500">
              3-20 characters, letters, numbers, and underscores only
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-light mb-1">
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3 py-2 bg-gray-input rounded-lg text-white"
              rows={3}
              maxLength={160}
            />
            <p className="mt-1 text-sm text-gray-500">
              {bio.length}/160 characters
            </p>
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-light hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
} 