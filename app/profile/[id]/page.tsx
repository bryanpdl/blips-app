'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { 
  type Blip, 
  type UserProfile, 
  getUserProfile, 
  getUserBlips, 
  getUserLikedBlips, 
  getUserReblippedBlips,
  getUserProfileByUsername 
} from '../../lib/firebase/db';
import BlipCard from '../../components/blips/BlipCard';
import EditProfileModal from '../../components/profile/EditProfileModal';
import ProtectedRoute from '../../components/auth/ProtectedRoute';
import Navbar from '../../components/navigation/Navbar';
import Link from 'next/link';
import Image from 'next/image';
import { Timestamp } from 'firebase/firestore';

type TabType = 'blips' | 'likes';

export default function Profile() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userBlips, setUserBlips] = useState<Blip[]>([]);
  const [reblippedBlips, setReblippedBlips] = useState<Blip[]>([]);
  const [likedBlips, setLikedBlips] = useState<Blip[]>([]);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('blips');

  const isOwnProfile = user?.uid === userProfile?.id;

  useEffect(() => {
    async function loadProfile() {
      if (!id) return;
      try {
        // First try to get profile by username
        const profile = await getUserProfileByUsername(id as string);
        if (!profile) {
          // If not found by username, try getting by ID (for backward compatibility)
          const profileById = await getUserProfile(id as string);
          if (!profileById) {
            router.push('/feed');
            return;
          }
          // If found by ID, redirect to username URL
          if (profileById.username) {
            router.push(`/profile/${profileById.username}`);
            return;
          }
          setUserProfile(profileById);
        } else {
          setUserProfile(profile);
        }

        const [blips, reblipped, liked] = await Promise.all([
          getUserBlips(profile?.id || id as string),
          getUserReblippedBlips(profile?.id || id as string),
          isOwnProfile ? getUserLikedBlips(profile?.id || id as string) : Promise.resolve([])
        ]);
        
        // Combine and sort blips and reblips by date
        const allBlips = [...blips, ...reblipped].sort((a, b) => {
          const dateA = a.createdAt;
          const dateB = b.createdAt;
          return dateB.toDate().getTime() - dateA.toDate().getTime();
        });
        
        setUserBlips(allBlips);
        setReblippedBlips(reblipped);
        setLikedBlips(liked);
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, [id, isOwnProfile, router]);

  const handleBlipUpdate = (updatedBlip: Blip | null, index: number) => {
    if (!updatedBlip) {
      // Handle deletion
      setUserBlips(prev => prev.filter((_, i) => i !== index));
      return;
    }

    // Handle update
    setUserBlips(prev => {
      const newBlips = [...prev];
      newBlips[index] = updatedBlip;
      return newBlips;
    });
  };

  if (!userProfile) return null;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background pb-16 sm:pb-0 sm:pt-16">
        <Navbar />
        <main className="max-w-2xl mx-auto p-4">
          <div className="bg-gray-dark rounded-lg p-4 mb-6">
            <div className="flex items-start gap-4">
              <Image
                src={userProfile.photoURL}
                alt={userProfile.name}
                width={96}
                height={96}
                className="w-24 h-24 rounded-full"
              />
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-white">{userProfile.name}</h1>
                    {userProfile.username && (
                      <p className="text-gray-500">@{userProfile.username}</p>
                    )}
                  </div>
                  {isOwnProfile ? (
                    <button
                      onClick={() => setIsEditModalOpen(true)}
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Edit Profile
                    </button>
                  ) : (
                    <button
                      onClick={() => {/* TODO: Implement follow/unfollow */}}
                      className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
                    >
                      Follow
                    </button>
                  )}
                </div>
                <p className="mt-2 text-gray-300">{userProfile.bio}</p>
                <div className="flex gap-6 mt-4">
                  <Link href={`/profile/${userProfile.username}/followers`} className="hover:opacity-80 transition-opacity">
                    <span className="font-bold text-white">{userProfile.followers.length}</span>
                    <span className="text-gray-500 ml-1">Followers</span>
                  </Link>
                  <Link href={`/profile/${userProfile.username}/following`} className="hover:opacity-80 transition-opacity">
                    <span className="font-bold text-white">{userProfile.following.length}</span>
                    <span className="text-gray-500 ml-1">Following</span>
                  </Link>
                  <button 
                    onClick={() => setActiveTab('blips')}
                    className={`hover:opacity-80 transition-opacity ${activeTab === 'blips' ? 'opacity-100' : 'opacity-70'}`}
                  >
                    <span className="font-bold text-white">{userProfile.blipsCount + reblippedBlips.length}</span>
                    <span className="text-gray-500 ml-1">Blips</span>
                  </button>
                  {isOwnProfile && (
                    <button 
                      onClick={() => setActiveTab('likes')}
                      className={`hover:opacity-80 transition-opacity ${activeTab === 'likes' ? 'opacity-100' : 'opacity-70'}`}
                    >
                      <span className="font-bold text-white">{likedBlips.length}</span>
                      <span className="text-gray-500 ml-1">Likes</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              <p className="text-center text-gray-500">Loading profile...</p>
            ) : activeTab === 'blips' ? (
              userBlips.length > 0 ? (
                userBlips.map((blip, index) => (
                  <BlipCard 
                    key={blip.id} 
                    blip={blip} 
                    onBlipUpdate={(updatedBlip) => handleBlipUpdate(updatedBlip, index)}
                  />
                ))
              ) : (
                <p className="text-center text-gray-500">No blips yet</p>
              )
            ) : (
              likedBlips.length > 0 ? (
                likedBlips.map((blip, index) => (
                  <BlipCard 
                    key={blip.id} 
                    blip={blip}
                    onBlipUpdate={(updatedBlip) => {
                      if (!updatedBlip) {
                        setLikedBlips(prev => prev.filter((_, i) => i !== index));
                        return;
                      }
                      setLikedBlips(prev => {
                        const newBlips = [...prev];
                        newBlips[index] = updatedBlip;
                        return newBlips;
                      });
                    }}
                  />
                ))
              ) : (
                <p className="text-center text-gray-500">No liked blips yet</p>
              )
            )}
          </div>
        </main>

        {isEditModalOpen && (
          <EditProfileModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            profile={userProfile}
            onUpdate={(updatedProfile) => {
              setUserProfile(prev => prev ? { ...prev, ...updatedProfile } : null);
            }}
          />
        )}
      </div>
    </ProtectedRoute>
  );
} 