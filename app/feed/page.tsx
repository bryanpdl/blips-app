'use client';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/navigation/Navbar';
import BlipComposer from '../components/blips/BlipComposer';
import BlipCard from '../components/blips/BlipCard';
import { type Blip, getFeedBlips, getGlobalBlips } from '../lib/firebase/db';

type FeedType = 'global' | 'following';

export default function Feed() {
  const { user } = useAuth();
  const [blips, setBlips] = useState<Blip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FeedType>('following');

  useEffect(() => {
    async function loadFeed() {
      if (!user) return;
      setIsLoading(true);
      try {
        const feedBlips = activeTab === 'following' 
          ? await getFeedBlips(user.uid)
          : await getGlobalBlips();
        setBlips(feedBlips);
      } catch (error) {
        console.error('Failed to load feed:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadFeed();
  }, [user, activeTab]);

  const handleBlipUpdate = (updatedBlip: Blip | null, index: number) => {
    if (!updatedBlip) {
      setBlips(prev => prev.filter((_, i) => i !== index));
      return;
    }
    setBlips(prev => {
      const newBlips = [...prev];
      newBlips[index] = updatedBlip;
      return newBlips;
    });
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background pb-16 sm:pb-0 sm:pt-16">
        <Navbar />
        <main className="max-w-2xl mx-auto p-4">
          <BlipComposer onBlipCreated={(newBlip) => setBlips(prev => [newBlip, ...prev])} />
          
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setActiveTab('following')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                activeTab === 'following'
                  ? 'bg-primary text-white'
                  : 'bg-gray-dark text-gray-light hover:text-white'
              }`}
            >
              Following
            </button>
            <button
              onClick={() => setActiveTab('global')}
              className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                activeTab === 'global'
                  ? 'bg-primary text-white'
                  : 'bg-gray-dark text-gray-light hover:text-white'
              }`}
            >
              Global
            </button>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              <p className="text-center text-gray-500">Loading feed...</p>
            ) : blips.length > 0 ? (
              blips.map((blip, index) => (
                <BlipCard 
                  key={blip.id} 
                  blip={blip} 
                  onBlipUpdate={(updatedBlip) => handleBlipUpdate(updatedBlip, index)}
                />
              ))
            ) : (
              <p className="text-center text-gray-500">
                {activeTab === 'following' 
                  ? "No blips yet. Create one or follow some users!"
                  : "No blips yet. Be the first to create one!"}
              </p>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
} 