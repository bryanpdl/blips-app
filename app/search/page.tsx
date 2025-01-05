'use client';

import React, { useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import Navbar from '../components/navigation/Navbar';
import BlipCard from '../components/blips/BlipCard';
import { type Blip, type UserProfile, searchBlips, searchUsers, followUser, unfollowUser } from '../lib/firebase/db';
import { useAuth } from '../contexts/AuthContext';
import Link from 'next/link';

type SearchTab = 'blips' | 'people';

interface SearchUserResult extends UserProfile {
  isFollowing: boolean;
}

export default function Search() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('people');
  const [blipResults, setBlipResults] = useState<Blip[]>([]);
  const [userResults, setUserResults] = useState<SearchUserResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setBlipResults([]);
      setUserResults([]);
      return;
    }
    
    setIsLoading(true);
    try {
      if (activeTab === 'blips') {
        const results = await searchBlips(query);
        setBlipResults(results);
      } else {
        const results = await searchUsers(query, user?.uid);
        setUserResults(results);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollowToggle = async (userId: string, currentlyFollowing: boolean) => {
    if (!user) return;
    
    try {
      if (currentlyFollowing) {
        await unfollowUser(user.uid, userId);
      } else {
        await followUser(user.uid, userId);
      }
      
      // Update the UI
      setUserResults(prev => prev.map(u => {
        if (u.id === userId) {
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
          <div className="relative mb-4">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-light" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={activeTab === 'blips' ? "Search blips..." : "Search users..."}
              className="input-field pl-10"
            />
          </div>

          <div className="flex gap-4 mb-6">
            <button
              onClick={() => {
                setActiveTab('blips');
                handleSearch(searchQuery);
              }}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                activeTab === 'blips'
                  ? 'bg-primary text-white'
                  : 'bg-gray-dark text-gray-light hover:text-white'
              }`}
            >
              Blips
            </button>
            <button
              onClick={() => {
                setActiveTab('people');
                handleSearch(searchQuery);
              }}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                activeTab === 'people'
                  ? 'bg-primary text-white'
                  : 'bg-gray-dark text-gray-light hover:text-white'
              }`}
            >
              People
            </button>
          </div>

          {activeTab === 'blips' ? (
            <div className="space-y-4">
              {isLoading ? (
                <p className="text-center text-gray-500">Searching...</p>
              ) : blipResults.length > 0 ? (
                blipResults.map((blip) => (
                  <BlipCard key={blip.id} blip={blip} />
                ))
              ) : searchQuery ? (
                <p className="text-center text-gray-500">No blips found</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              {isLoading ? (
                <p className="text-center text-gray-500">Searching...</p>
              ) : userResults.length > 0 ? (
                userResults.map((userResult) => (
                  <div key={userResult.id} className="bg-gray-dark rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <Link href={`/profile/${userResult.id}`} className="flex items-center gap-3 flex-1">
                        <img
                          src={userResult.photoURL}
                          alt={userResult.name}
                          className="w-12 h-12 rounded-full"
                        />
                        <div>
                          <h3 className="font-semibold">{userResult.name}</h3>
                          <p className="text-sm text-gray-500">@{userResult.username}</p>
                        </div>
                      </Link>
                      {userResult.id !== user?.uid && (
                        <button
                          onClick={() => handleFollowToggle(userResult.id, userResult.isFollowing)}
                          className={`px-4 py-1.5 rounded-lg transition-colors ${
                            userResult.isFollowing
                              ? 'bg-gray-800 text-white hover:bg-gray-700'
                              : 'bg-primary text-white hover:bg-primary/90'
                          }`}
                        >
                          {userResult.isFollowing ? 'Following' : 'Follow'}
                        </button>
                      )}
                    </div>
                    {userResult.bio && (
                      <p className="mt-2 text-sm text-gray-300">{userResult.bio}</p>
                    )}
                  </div>
                ))
              ) : searchQuery ? (
                <p className="text-center text-gray-500">No users found</p>
              ) : null}
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
} 