'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import ProtectedRoute from '../../../components/auth/ProtectedRoute';
import Navbar from '../../../components/navigation/Navbar';
import { useAuth } from '../../../contexts/AuthContext';
import { getUserProfile, followUser, unfollowUser, getUserProfileByUsername } from '../../../lib/firebase/db';
import type { UserProfile } from '../../../lib/firebase/db';
import Image from 'next/image';

interface FollowingUser extends UserProfile {
  isFollowing: boolean;
}

export default function Following() {
  const { id } = useParams();
  const { user } = useAuth();
  const [following, setFollowing] = useState<FollowingUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadFollowing() {
      if (!id) return;
      try {
        // First try to get profile by username
        const profile = await getUserProfileByUsername(id as string);
        if (!profile) {
          // If not found by username, try getting by ID
          const profileById = await getUserProfile(id as string);
          if (!profileById) return;
          setFollowing([]); // Reset following list
          return;
        }

        // Get current user's following list to check follow status
        const currentUserProfile = user ? await getUserProfile(user.uid) : null;
        const currentUserFollowing = currentUserProfile?.following || [];

        // Get all following users' profiles
        const followingProfiles = await Promise.all(
          profile.following.map(async (userId) => {
            const userProfile = await getUserProfile(userId);
            if (!userProfile) return null;
            return {
              ...userProfile,
              isFollowing: currentUserFollowing.includes(userId)
            };
          })
        );

        setFollowing(followingProfiles.filter((p): p is FollowingUser => p !== null));
      } catch (error) {
        console.error('Failed to load following:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadFollowing();
  }, [id, user]);

  const handleFollowToggle = async (targetUserId: string, currentlyFollowing: boolean) => {
    if (!user) return;
    
    try {
      if (currentlyFollowing) {
        await unfollowUser(user.uid, targetUserId);
      } else {
        await followUser(user.uid, targetUserId);
      }
      
      // Update UI
      setFollowing(prev => prev.map(u => {
        if (u.id === targetUserId) {
          return { ...u, isFollowing: !currentlyFollowing };
        }
        return u;
      }));
    } catch (error) {
      console.error('Failed to toggle follow:', error);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background pb-16 sm:pb-0 sm:pt-16">
        <Navbar />
        <main className="max-w-2xl mx-auto p-4">
          <div className="mb-6">
            <Link
              href={`/profile/${id}`}
              className="inline-flex items-center text-gray-light hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back to Profile
            </Link>
          </div>

          <h1 className="text-2xl font-bold mb-6">Following</h1>

          <div className="space-y-4">
            {isLoading ? (
              <p className="text-center text-gray-500">Loading following...</p>
            ) : following.length > 0 ? (
              following.map((followedUser) => (
                <div key={followedUser.id} className="bg-gray-dark rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <Link href={`/profile/${followedUser.id}`} className="flex items-center gap-3 flex-1">
                      <div className="flex items-center gap-3">
                        <Image
                          src={followedUser.photoURL}
                          alt={followedUser.name}
                          width={48}
                          height={48}
                          className="w-12 h-12 rounded-full"
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold">{followedUser.name}</h3>
                        <p className="text-sm text-gray-500">@{followedUser.username}</p>
                      </div>
                    </Link>
                    {followedUser.id !== user?.uid && (
                      <button
                        onClick={() => handleFollowToggle(followedUser.id, followedUser.isFollowing)}
                        className={`px-4 py-1.5 rounded-lg transition-colors ${
                          followedUser.isFollowing
                            ? 'bg-gray-darker text-white hover:bg-gray-darker/80'
                            : 'bg-primary text-white hover:bg-primary/90'
                        }`}
                      >
                        {followedUser.isFollowing ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                  {followedUser.bio && (
                    <p className="mt-2 text-sm text-gray-300">{followedUser.bio}</p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500">Not following anyone yet</p>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
} 