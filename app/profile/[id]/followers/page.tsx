'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import ProtectedRoute from '../../../components/auth/ProtectedRoute';
import Navbar from '../../../components/navigation/Navbar';
import { useAuth } from '../../../contexts/AuthContext';
import { getUserProfile, followUser, unfollowUser } from '../../../lib/firebase/db';
import type { UserProfile } from '../../../lib/firebase/db';
import Image from 'next/image';

interface FollowerUser extends UserProfile {
  isFollowing: boolean;
}

export default function Followers() {
  const { id } = useParams();
  const { user } = useAuth();
  const [followers, setFollowers] = useState<FollowerUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadFollowers() {
      if (!id) return;
      try {
        const profile = await getUserProfile(id as string);
        if (!profile) return;

        // Get current user's following list to check follow status
        const currentUserProfile = user ? await getUserProfile(user.uid) : null;
        const currentUserFollowing = currentUserProfile?.following || [];

        // Get all followers' profiles
        const followerProfiles = await Promise.all(
          profile.followers.map(async (userId) => {
            const userProfile = await getUserProfile(userId);
            if (!userProfile) return null;
            return {
              ...userProfile,
              isFollowing: currentUserFollowing.includes(userId)
            };
          })
        );

        setFollowers(followerProfiles.filter((p): p is FollowerUser => p !== null));
      } catch (error) {
        console.error('Failed to load followers:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadFollowers();
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
      setFollowers(prev => prev.map(u => {
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

          <h1 className="text-2xl font-bold mb-6">Followers</h1>

          <div className="space-y-4">
            {isLoading ? (
              <p className="text-center text-gray-500">Loading followers...</p>
            ) : followers.length > 0 ? (
              followers.map((follower) => (
                <div key={follower.id} className="bg-gray-dark rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <Link href={`/profile/${follower.id}`} className="flex items-center gap-3 flex-1">
                      <div className="flex items-center gap-3">
                        <Image
                          src={follower.photoURL}
                          alt={follower.name}
                          width={48}
                          height={48}
                          className="w-12 h-12 rounded-full"
                        />
                        <div>
                          <h3 className="font-semibold">{follower.name}</h3>
                          <p className="text-sm text-gray-500">@{follower.username}</p>
                        </div>
                      </div>
                    </Link>
                    {follower.id !== user?.uid && (
                      <button
                        onClick={() => handleFollowToggle(follower.id, follower.isFollowing)}
                        className={`px-4 py-1.5 rounded-lg transition-colors ${
                          follower.isFollowing
                            ? 'bg-gray-800 text-white hover:bg-gray-700'
                            : 'bg-primary text-white hover:bg-primary/90'
                        }`}
                      >
                        {follower.isFollowing ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                  {follower.bio && (
                    <p className="mt-2 text-sm text-gray-300">{follower.bio}</p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500">No followers yet</p>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
} 