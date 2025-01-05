'use client';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/navigation/Navbar';
import BlipComposer from '../components/blips/BlipComposer';
import BlipCard from '../components/blips/BlipCard';
import { type Blip, getFeedBlips } from '../lib/firebase/db';

export default function Feed() {
  const { user } = useAuth();
  const [blips, setBlips] = useState<Blip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadFeed() {
      if (!user) return;
      try {
        const feedBlips = await getFeedBlips(user.uid);
        setBlips(feedBlips);
      } catch (error) {
        console.error('Failed to load feed:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadFeed();
  }, [user]);

  const handleBlipUpdate = (updatedBlip: Blip | null, index: number) => {
    if (!updatedBlip) {
      // Handle deletion
      setBlips(prev => prev.filter((_, i) => i !== index));
      return;
    }

    // Handle update
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
              <p className="text-center text-gray-500">No blips yet. Create one or follow some users!</p>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
} 