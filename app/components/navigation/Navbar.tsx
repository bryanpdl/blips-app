'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { HomeIcon, MagnifyingGlassIcon, BellIcon, UserIcon } from '@heroicons/react/24/outline';
import { getUnreadNotificationsCount } from '../../lib/firebase/db';

export default function Navbar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function loadUnreadCount() {
      if (!user) return;
      try {
        const count = await getUnreadNotificationsCount(user.uid);
        setUnreadCount(count);
      } catch (error) {
        console.error('Error loading unread count:', error);
      }
    }

    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const navItems = [
    { href: '/feed', icon: HomeIcon, label: 'Home' },
    { href: '/search', icon: MagnifyingGlassIcon, label: 'Search' },
    { 
      href: '/notifications', 
      icon: BellIcon, 
      label: 'Notifications',
      badge: unreadCount > 0 ? unreadCount : undefined
    },
    { href: `/profile/${user?.uid}`, icon: UserIcon, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-gray-600 sm:top-0 sm:bottom-auto sm:border-t-0 sm:border-b">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex justify-around sm:justify-between items-center h-16">
          <div className="hidden sm:flex items-center gap-1">
            <Link href="/feed" className="text-2xl font-extrabold text-white">
              blips
            </Link>
          </div>
          
          <div className="flex justify-around sm:gap-2 w-full sm:w-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || 
                (item.href.startsWith('/profile/') && pathname.startsWith('/profile/'));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex flex-col sm:flex-row items-center justify-center p-2 rounded-lg transition-colors sm:gap-2 ${
                    isActive
                      ? 'text-primary'
                      : 'text-gray-light hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  <div className="relative">
                    <Icon className="h-6 w-6 sm:h-5 sm:w-5" />
                    {item.badge && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-xs mt-1 sm:mt-0 sm:text-sm">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <button
            onClick={() => signOut()}
            className="hidden sm:block px-4 py-2 text-gray-light hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
} 