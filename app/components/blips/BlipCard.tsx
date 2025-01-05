'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { HeartIcon, ChatBubbleLeftIcon, ArrowPathRoundedSquareIcon, XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid, ArrowPathRoundedSquareIcon as ArrowPathRoundedSquareIconSolid } from '@heroicons/react/24/solid';
import { useAuth } from '../../contexts/AuthContext';
import { getUserProfile, type Blip, deleteBlip, likeBlip, reblipBlip } from '../../lib/firebase/db';
import { motion, AnimatePresence } from 'framer-motion';
import { renderTextWithMentions } from '../../lib/utils';
import { Timestamp } from 'firebase/firestore';

interface BlipCardProps {
  blip: Blip;
  showActions?: boolean;
  onBlipUpdate?: (updatedBlip: Blip | null) => void;
}

interface AuthorInfo {
  id: string;
  name: string;
  username: string | null;
  photoURL: string;
}

function formatDate(timestamp: Timestamp): string {
  if (!timestamp) return '';
  return timestamp.toDate().toLocaleDateString();
}

export default function BlipCard({ blip: initialBlip, showActions = true, onBlipUpdate }: BlipCardProps) {
  const [author, setAuthor] = useState<AuthorInfo | null>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isReblipping, setIsReblipping] = useState(false);
  const [blip, setBlip] = useState<Blip>(initialBlip);
  const { user } = useAuth();

  useEffect(() => {
    async function fetchAuthor() {
      const authorProfile = await getUserProfile(blip.authorId);
      if (authorProfile) {
        setAuthor({
          id: authorProfile.id,
          name: authorProfile.name,
          username: authorProfile.username,
          photoURL: authorProfile.photoURL,
        });
      }
    }
    fetchAuthor();
  }, [blip.authorId]);

  const handleDelete = async () => {
    if (!user || isDeleting) return;
    if (!confirm('Are you sure you want to delete this blip?')) return;

    setIsDeleting(true);
    try {
      await deleteBlip(blip.id, user.uid);
      // Let parent component know about deletion
      if (onBlipUpdate) {
        onBlipUpdate(null);
      }
    } catch (error) {
      console.error('Error deleting blip:', error);
      alert('Failed to delete blip');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLike = async () => {
    if (!user || isLiking) return;
    setIsLiking(true);
    try {
      await likeBlip(blip.id, user.uid);
      // Update local state
      const likes = blip.likes || [];
      const hasLiked = likes.includes(user.uid);
      const updatedBlip = {
        ...blip,
        likes: hasLiked ? likes.filter(id => id !== user.uid) : [...likes, user.uid]
      };
      setBlip(updatedBlip);
      if (onBlipUpdate) {
        onBlipUpdate(updatedBlip);
      }
    } catch (error) {
      console.error('Error liking blip:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleReblip = async () => {
    if (!user || isReblipping) return;
    setIsReblipping(true);
    try {
      await reblipBlip(blip.id, user.uid);
      // Update local state
      const reblips = blip.reblips || [];
      const hasReblipped = reblips.includes(user.uid);
      const updatedBlip = {
        ...blip,
        reblips: hasReblipped ? reblips.filter(id => id !== user.uid) : [...reblips, user.uid]
      };
      setBlip(updatedBlip);
      if (onBlipUpdate) {
        onBlipUpdate(updatedBlip);
      }
    } catch (error) {
      console.error('Error reblipping:', error);
    } finally {
      setIsReblipping(false);
    }
  };

  if (!author) return null;

  const isOwnBlip = user?.uid === blip.authorId;
  const hasLiked = blip.likes?.includes(user?.uid || '');
  const hasReblipped = blip.reblips?.includes(user?.uid || '');

  return (
    <>
      <div className="bg-gray-dark hover:bg-gray-dark/80 rounded-lg p-4 mb-4 transition-colors">
        <div className="flex space-x-3">
          <Link href={`/profile/${author.username || author.id}`} className="shrink-0">
            <Image
              src={author.photoURL}
              alt={author.name}
              width={48}
              height={48}
              className="rounded-full"
            />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  <Link href={`/profile/${author.username || author.id}`} className="font-semibold text-white hover:underline">
                    {author.name}
                  </Link>
                  <span className="text-gray-500">·</span>
                  <span className="text-gray-500 text-sm">
                    {formatDate(blip.createdAt)}
                  </span>
                </div>
                {isOwnBlip && (
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="text-gray-500 hover:text-red-500 transition-colors"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
              {author.username && (
                <Link href={`/profile/${author.username}`} className="text-sm text-gray-500 hover:underline">
                  @{author.username}
                </Link>
              )}
            </div>
            <Link href={`/blip/${blip.id}`} className="block mt-2 hover:opacity-75 transition-opacity">
              <p className="text-white whitespace-pre-wrap break-words">
                {renderTextWithMentions(blip.content, true)}
              </p>
            </Link>
            {blip.imageUrl && (
              <div 
                onClick={(e) => {
                  e.preventDefault();
                  setIsImageModalOpen(true);
                }}
                className="mt-2 rounded-xl overflow-hidden max-w-[500px] max-h-[250px] cursor-pointer"
              >
                <Image
                  src={blip.imageUrl}
                  alt="Blip image"
                  width={500}
                  height={300}
                  className="object-cover w-full h-[250px] hover:opacity-90 transition-opacity"
                />
              </div>
            )}
            {showActions && (
              <div className="flex items-center mt-3 space-x-6 text-gray-500">
                <Link href={`/blip/${blip.id}`} className="flex items-center space-x-2 hover:text-primary transition-colors">
                  <ChatBubbleLeftIcon className="h-5 w-5" />
                  <span>{blip.comments}</span>
                </Link>
                <button 
                  onClick={handleReblip}
                  disabled={isReblipping}
                  className={`flex items-center space-x-2 transition-colors ${
                    hasReblipped ? 'text-green-500' : 'hover:text-green-500'
                  }`}
                >
                  {hasReblipped ? (
                    <ArrowPathRoundedSquareIconSolid className="h-5 w-5" />
                  ) : (
                    <ArrowPathRoundedSquareIcon className="h-5 w-5" />
                  )}
                  <span>{blip.reblips?.length || 0}</span>
                </button>
                <button 
                  onClick={handleLike}
                  disabled={isLiking}
                  className={`flex items-center space-x-2 transition-colors ${
                    hasLiked ? 'text-red-500' : 'hover:text-red-500'
                  }`}
                >
                  {hasLiked ? (
                    <HeartIconSolid className="h-5 w-5" />
                  ) : (
                    <HeartIcon className="h-5 w-5" />
                  )}
                  <span>{blip.likes?.length || 0}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isImageModalOpen && blip.imageUrl && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setIsImageModalOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-[90vw] max-h-[90vh]"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setIsImageModalOpen(false)}
                className="absolute -top-4 -right-4 bg-gray-dark rounded-full p-2 text-white hover:bg-gray-700 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
              <Image
                src={blip.imageUrl}
                alt="Full size image"
                width={1200}
                height={800}
                className="rounded-lg object-contain max-h-[90vh] w-auto"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
} 