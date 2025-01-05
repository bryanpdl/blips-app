'use client';

import React, { useEffect, useState } from 'react';
import { HeartIcon, ChatBubbleLeftIcon, UserPlusIcon, ArrowPathRoundedSquareIcon } from '@heroicons/react/24/solid';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import Navbar from '../components/navigation/Navbar';
import { useAuth } from '../contexts/AuthContext';
import { getNotifications, getUserProfile, markAllNotificationsAsRead, type Notification } from '../lib/firebase/db';
import Link from 'next/link';
import Image from 'next/image';

interface NotificationUser {
  id: string;
  name: string;
  username: string | null;
  photoURL: string;
}

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [users, setUsers] = useState<Map<string, NotificationUser>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadNotifications() {
      if (!user) return;

      try {
        // Mark all notifications as read
        await markAllNotificationsAsRead(user.uid);

        // Get notifications
        const notifs = await getNotifications(user.uid);
        setNotifications(notifs);

        // Get user info for all users in notifications
        const userIds = new Set(notifs.map(n => n.fromUserId));
        const userMap = new Map<string, NotificationUser>();

        await Promise.all(
          Array.from(userIds).map(async (userId) => {
            const userProfile = await getUserProfile(userId);
            if (userProfile) {
              userMap.set(userId, {
                id: userProfile.id,
                name: userProfile.name,
                username: userProfile.username,
                photoURL: userProfile.photoURL,
              });
            }
          })
        );

        setUsers(userMap);
      } catch (error) {
        console.error('Error loading notifications:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadNotifications();
  }, [user]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'now';
    
    // Convert Firestore Timestamp to Date
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return 'now';
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'like':
        return <HeartIcon className="h-5 w-5 text-red-500" />;
      case 'comment':
        return <ChatBubbleLeftIcon className="h-5 w-5 text-primary" />;
      case 'follow':
        return <UserPlusIcon className="h-5 w-5 text-secondary" />;
      case 'reblip':
        return <ArrowPathRoundedSquareIcon className="h-5 w-5 text-green-500" />;
      case 'mention':
        return <ChatBubbleLeftIcon className="h-5 w-5 text-blue-500" />;
    }
  };

  const getNotificationText = (notification: Notification) => {
    switch (notification.type) {
      case 'like':
        return 'liked your blip';
      case 'comment':
        return `commented: "${notification.content}"`;
      case 'follow':
        return 'started following you';
      case 'reblip':
        return 'reblipped your blip';
      case 'mention':
        return 'mentioned you in a blip';
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background pb-16 sm:pb-0 sm:pt-16">
          <Navbar />
          <main className="max-w-2xl mx-auto p-4">
            <h1 className="text-2xl font-bold mb-6">Notifications</h1>
            <div className="text-center text-gray-500">Loading notifications...</div>
          </main>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background pb-16 sm:pb-0 sm:pt-16">
        <Navbar />
        <main className="max-w-2xl mx-auto p-4">
          <h1 className="text-2xl font-bold mb-6">Notifications</h1>
          <div className="space-y-2">
            {notifications.length === 0 ? (
              <div className="text-center text-gray-500">No notifications yet</div>
            ) : (
              notifications.map((notification) => {
                const fromUser = users.get(notification.fromUserId);
                if (!fromUser) return null;

                return (
                  <Link
                    key={notification.id}
                    href={notification.blipId ? `/blip/${notification.blipId}` : `/profile/${fromUser.id}`}
                    className={`block bg-gray-dark rounded-lg p-4 hover:bg-gray-dark/80 transition-colors ${
                      !notification.read ? 'border-l-4 border-primary' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Image
                        src={fromUser.photoURL}
                        alt={fromUser.name}
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {getNotificationIcon(notification.type)}
                          <span>
                            <span className="font-semibold">{fromUser.name}</span>{' '}
                            {getNotificationText(notification)}
                          </span>
                        </div>
                        <span className="text-sm text-gray-light">
                          {formatDate(notification.createdAt)}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
} 