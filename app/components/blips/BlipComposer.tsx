'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { createBlip, searchUsers, type SearchUserResult, type Blip } from '../../lib/firebase/db';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { createNotification } from '../../lib/firebase/db';
import MentionInput from '../common/MentionInput';

interface BlipComposerProps {
  onBlipCreated?: (blip: Blip) => void;
}

export default function BlipComposer({ onBlipCreated }: BlipComposerProps) {
  const [content, setContent] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionResults, setMentionResults] = useState<SearchUserResult[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (mentionSearch) {
      const searchForUsers = async () => {
        const results = await searchUsers(mentionSearch, user?.uid);
        setMentionResults(results);
      };
      searchForUsers();
    }
  }, [mentionSearch, user?.uid]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    // Handle mention search
    const cursorPos = e.target.selectionStart;
    setCursorPosition(cursorPos);

    const textBeforeCursor = newContent.slice(0, cursorPos);
    const matches = textBeforeCursor.match(/@(\w*)$/);

    if (matches) {
      setMentionSearch(matches[1]);
      setShowMentionDropdown(true);
    } else {
      setMentionSearch('');
      setShowMentionDropdown(false);
    }
  };

  const insertMention = (username: string) => {
    if (!cursorPosition) return;

    const beforeMention = content.slice(0, cursorPosition).replace(/@\w*$/, '');
    const afterMention = content.slice(cursorPosition);
    const newContent = `${beforeMention}@${username}${afterMention}`;
    
    setContent(newContent);
    setShowMentionDropdown(false);
    setMentionSearch('');

    // Focus back on textarea and set cursor position after the mention
    if (textareaRef.current) {
      const newCursorPos = beforeMention.length + username.length + 1;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      let imageUrl = '';
      if (image) {
        const imageRef = ref(storage, `blips/${Date.now()}_${image.name}`);
        const uploadResult = await uploadBytes(imageRef, image);
        imageUrl = await getDownloadURL(uploadResult.ref);
      }

      // Extract mentions from content
      const mentions = content.match(/@(\w+)/g) || [];
      const uniqueMentions = [...new Set(mentions)];

      const newBlip = await createBlip(user.uid, content, imageUrl);

      // Create notifications for mentions
      if (uniqueMentions.length > 0) {
        // Get all usernames to find matching users
        const usernameQuery = query(
          collection(db, 'users'),
          where('username', 'in', uniqueMentions.map(m => m.slice(1).toLowerCase()))
        );
        const usernameSnap = await getDocs(usernameQuery);
        
        // Create notifications for each mentioned user
        usernameSnap.docs.forEach(async (doc) => {
          await createNotification(
            'mention',
            user.uid,
            doc.id,
            newBlip.id,
            content
          );
        });
      }

      if (onBlipCreated) {
        onBlipCreated(newBlip);
      }

      setContent('');
      setImage(null);
      setImagePreview(null);
    } catch (error) {
      console.error('Error creating blip:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-dark rounded-lg p-4 mb-6">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <MentionInput
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            placeholder="What's happening?"
            className="w-full bg-transparent text-white placeholder-gray-light resize-none min-h-[100px] rounded-lg"
            maxLength={500}
          />
          {showMentionDropdown && mentionResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-64 bg-gray-dark/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700 max-h-48 overflow-y-auto">
              {mentionResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => insertMention(user.username || user.name)}
                  className="w-full px-4 py-2 flex items-center space-x-2 hover:bg-gray-700 transition-colors text-left"
                >
                  <Image
                    src={user.photoURL}
                    alt={user.name}
                    width={24}
                    height={24}
                    className="rounded-full"
                  />
                  <div>
                    <div className="text-white">{user.name}</div>
                    {user.username && (
                      <div className="text-gray-400 text-sm">@{user.username}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {imagePreview && (
          <div className="relative mt-2 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setImage(null);
                setImagePreview(null);
              }}
              className="absolute top-2 right-2 bg-gray-dark rounded-full p-1 hover:bg-gray-700 transition-colors"
            >
              <XMarkIcon className="h-5 w-5 text-white" />
            </button>
            <Image
              src={imagePreview}
              alt="Image preview"
              width={500}
              height={300}
              className="max-h-[300px] w-full object-cover rounded-xl"
            />
          </div>
        )}

        <div className="flex justify-between items-center mt-4">
          <div className="flex items-center space-x-4">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              <PhotoIcon className="h-6 w-6 text-primary hover:text-primary/80 transition-colors" />
            </label>
            <span className="text-sm text-gray-500">{content.length}/500</span>
          </div>
          <button
            type="submit"
            disabled={!content.trim() || isSubmitting}
            className="btn-primary px-4 disabled:opacity-50"
          >
            {isSubmitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  );
} 