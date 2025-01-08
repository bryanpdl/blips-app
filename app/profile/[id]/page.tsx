'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { 
  type Blip, 
  type UserProfile, 
  getUserProfile, 
  getUserBlips, 
  getUserLikedBlips, 
  getUserReblippedBlips,
  getUserProfileByUsername,
  updateUserProfile,
  followUser,
  unfollowUser
} from '../../lib/firebase/db';
import BlipCard from '../../components/blips/BlipCard';
import EditProfileModal from '../../components/profile/EditProfileModal';
import ProtectedRoute from '../../components/auth/ProtectedRoute';
import Navbar from '../../components/navigation/Navbar';
import Link from 'next/link';
import Image from 'next/image';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { CameraIcon } from '@heroicons/react/24/outline';

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
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFollowing, setIsFollowing] = useState(false);

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

        // Check if current user is following this profile
        if (user) {
          const currentUserProfile = await getUserProfile(user.uid);
          setIsFollowing(currentUserProfile?.following.includes(profile?.id || id as string) || false);
        }

        const [blips, reblipped, liked] = await Promise.all([
          getUserBlips(profile?.id || id as string),
          getUserReblippedBlips(profile?.id || id as string),
          isOwnProfile ? getUserLikedBlips(profile?.id || id as string) : Promise.resolve([])
        ]);
        
        // Combine blips and reblips, removing duplicates by blip ID
        const blipMap = new Map();
        [...blips, ...reblipped].forEach(blip => {
          if (!blipMap.has(blip.id)) {
            blipMap.set(blip.id, blip);
          }
        });
        
        // Convert map back to array and sort by date
        const allBlips = Array.from(blipMap.values()).sort((a, b) => {
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
  }, [id, isOwnProfile, router, user]);

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

  const handleAvatarClick = () => {
    if (!isOwnProfile) return;
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !userProfile) return;

    setIsUploadingAvatar(true);
    try {
      // Upload new image
      const imageRef = ref(storage, `avatars/${user.uid}_${Date.now()}`);
      const uploadResult = await uploadBytes(imageRef, file);
      const photoURL = await getDownloadURL(uploadResult.ref);

      // Update user profile
      const updatedProfile = { ...userProfile, photoURL };
      await updateUserProfile(user.uid, { photoURL });
      setUserProfile(updatedProfile);
    } catch (error) {
      console.error('Error updating avatar:', error);
      alert('Failed to update avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!user || !userProfile || isOwnProfile) return;

    try {
      if (isFollowing) {
        await unfollowUser(user.uid, userProfile.id);
        setIsFollowing(false);
        // Update followers count in UI
        setUserProfile(prev => prev ? {
          ...prev,
          followers: prev.followers.filter(id => id !== user.uid)
        } : null);
      } else {
        await followUser(user.uid, userProfile.id);
        setIsFollowing(true);
        // Update followers count in UI
        setUserProfile(prev => prev ? {
          ...prev,
          followers: [...prev.followers, user.uid]
        } : null);
      }
    } catch (error) {
      console.error('Failed to toggle follow:', error);
    }
  };

  if (!userProfile) return null;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background pb-16 sm:pb-0 sm:pt-16">
        <Navbar />
        <main className="max-w-2xl mx-auto p-4">
          <div className="bg-gray-dark rounded-lg p-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="relative self-center sm:self-start">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleAvatarChange}
                  accept="image/*"
                  className="hidden"
                />
                <div 
                  className={`relative ${isOwnProfile ? 'cursor-pointer group' : ''}`}
                  onClick={handleAvatarClick}
                >
                  <Image
                    src={userProfile.photoURL}
                    alt={userProfile.name}
                    width={96}
                    height={96}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-full"
                  />
                  {isOwnProfile && (
                    <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <CameraIcon className="h-6 w-6 text-white" />
                    </div>
                  )}
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-0">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{userProfile.name}</h1>
                    {userProfile.username && (
                      <p className="text-gray-500 truncate">@{userProfile.username}</p>
                    )}
                  </div>
                  {isOwnProfile ? (
                    <button
                      onClick={() => setIsEditModalOpen(true)}
                      className="w-full sm:w-auto px-4 py-2 bg-primary btn-primary text-white rounded-lg  text-sm sm:text-base"
                    >
                      Edit Profile
                    </button>
                  ) : (
                    <button
                      onClick={handleFollowToggle}
                      className={`w-full sm:w-auto px-4 py-2 ${
                        isFollowing 
                          ? 'bg-gray-darker hover:bg-gray-darker/80' 
                          : 'bg-primary hover:bg-primary/90'
                      } text-white rounded-lg transition-colors text-sm sm:text-base`}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  )}
                </div>
                <p className="mt-2 text-gray-300 break-words">{userProfile.bio}</p>
                <div className="flex flex-wrap gap-4 sm:gap-6 mt-4">
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