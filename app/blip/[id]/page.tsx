'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeftIcon, HeartIcon, ChatBubbleLeftIcon, ArrowPathRoundedSquareIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid, ArrowPathRoundedSquareIcon as ArrowPathRoundedSquareIconSolid } from '@heroicons/react/24/solid';
import ProtectedRoute from '../../components/auth/ProtectedRoute';
import Navbar from '../../components/navigation/Navbar';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getBlip, 
  getUserProfile, 
  createComment, 
  getBlipComments, 
  likeBlip, 
  reblipBlip, 
  searchUsers, 
  createNotification,
  type Blip, 
  type Comment,
  type SearchUserResult 
} from '../../lib/firebase/db';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { renderTextWithMentions } from '../../lib/utils';
import MentionInput from '../../components/common/MentionInput';

interface Author {
  id: string;
  name: string;
  username: string | null;
  photoURL: string;
}

function formatDate(timestamp: Timestamp | Date): string {
  if (!timestamp) return '';
  const date = 'toDate' in timestamp ? timestamp.toDate() : timestamp;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString();
}

export default function BlipPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [blip, setBlip] = useState<Blip | null>(null);
  const [author, setAuthor] = useState<Author | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentAuthors, setCommentAuthors] = useState<Map<string, Author>>(new Map());
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isReblipping, setIsReblipping] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionResults, setMentionResults] = useState<SearchUserResult[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function loadBlipData() {
      if (!id) return;
      
      // Fetch blip
      const blipData = await getBlip(id as string);
      if (!blipData) {
        router.push('/feed');
        return;
      }
      setBlip(blipData);

      // Fetch blip author
      const authorProfile = await getUserProfile(blipData.authorId);
      if (authorProfile) {
        setAuthor({
          id: authorProfile.id,
          name: authorProfile.name,
          username: authorProfile.username,
          photoURL: authorProfile.photoURL,
        });
      }

      // Fetch comments
      const blipComments = await getBlipComments(id as string);
      setComments(blipComments);

      // Fetch comment authors
      const authors = new Map<string, Author>();
      await Promise.all(
        blipComments.map(async (comment) => {
          const profile = await getUserProfile(comment.authorId);
          if (profile) {
            authors.set(comment.authorId, {
              id: profile.id,
              name: profile.name,
              username: profile.username,
              photoURL: profile.photoURL,
            });
          }
        })
      );
      setCommentAuthors(authors);
    }

    loadBlipData();
  }, [id, router]);

  useEffect(() => {
    if (mentionSearch) {
      const searchForUsers = async () => {
        const results = await searchUsers(mentionSearch, user?.uid);
        setMentionResults(results);
      };
      searchForUsers();
    }
  }, [mentionSearch, user?.uid]);

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setNewComment(newContent);

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

    const beforeMention = newComment.slice(0, cursorPosition).replace(/@\w*$/, '');
    const afterMention = newComment.slice(cursorPosition);
    const updatedComment = `${beforeMention}@${username}${afterMention}`;
    
    setNewComment(updatedComment);
    setShowMentionDropdown(false);
    setMentionSearch('');

    // Focus back on textarea and set cursor position after the mention
    if (textareaRef.current) {
      const newCursorPos = beforeMention.length + username.length + 1;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !blip || !newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Extract mentions from content
      const mentions = newComment.match(/@(\w+)/g) || [];
      const uniqueMentions = [...new Set(mentions)];

      await createComment(blip.id, user.uid, newComment);
      
      // Create notifications for mentions
      if (uniqueMentions.length > 0) {
        const usernameQuery = query(
          collection(db, 'users'),
          where('username', 'in', uniqueMentions.map(m => m.slice(1).toLowerCase()))
        );
        const usernameSnap = await getDocs(usernameQuery);
        
        usernameSnap.docs.forEach(async (doc) => {
          await createNotification(
            'mention',
            user.uid,
            doc.id,
            blip.id,
            newComment
          );
        });
      }

      // Fetch updated comments
      const updatedComments = await getBlipComments(blip.id);
      setComments(updatedComments);

      // Add new comment author if needed
      if (!commentAuthors.has(user.uid)) {
        const profile = await getUserProfile(user.uid);
        if (profile) {
          setCommentAuthors(prev => new Map(prev).set(user.uid, {
            id: profile.id,
            name: profile.name,
            username: profile.username,
            photoURL: profile.photoURL,
          }));
        }
      }

      setNewComment('');
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async () => {
    if (!user || !blip || isLiking) return;
    setIsLiking(true);
    try {
      await likeBlip(blip.id, user.uid);
      // Update local state
      setBlip(prev => {
        if (!prev) return null;
        const likes = prev.likes || [];
        const hasLiked = likes.includes(user.uid);
        return {
          ...prev,
          likes: hasLiked ? likes.filter(id => id !== user.uid) : [...likes, user.uid]
        };
      });
    } catch (error) {
      console.error('Error liking blip:', error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleReblip = async () => {
    if (!user || !blip || isReblipping) return;
    setIsReblipping(true);
    try {
      await reblipBlip(blip.id, user.uid);
      // Update local state
      setBlip(prev => {
        if (!prev) return null;
        const reblips = prev.reblips || [];
        const hasReblipped = reblips.includes(user.uid);
        return {
          ...prev,
          reblips: hasReblipped ? reblips.filter(id => id !== user.uid) : [...reblips, user.uid]
        };
      });
    } catch (error) {
      console.error('Error reblipping:', error);
    } finally {
      setIsReblipping(false);
    }
  };

  if (!blip || !author) return null;

  const hasLiked = blip.likes?.includes(user?.uid || '');
  const hasReblipped = blip.reblips?.includes(user?.uid || '');

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background pb-16 sm:pb-0 sm:pt-16">
        <Navbar />
        <main className="max-w-2xl mx-auto p-4">
          <div className="mb-6">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center text-gray-light hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back
            </button>
          </div>

          <div className="bg-gray-dark rounded-lg p-4 mb-4">
            <div className="flex space-x-3">
              <Link href={`/profile/${author.id}`} className="shrink-0">
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
                  <div className="flex items-center space-x-1">
                    <Link href={`/profile/${author.username || author.id}`} className="font-semibold text-white hover:underline">
                      {author.name}
                    </Link>
                    <span className="text-gray-500">·</span>
                    <span className="text-gray-500 text-sm">
                      {formatDate(blip.createdAt)}
                    </span>
                  </div>
                  {author.username && (
                    <Link href={`/profile/${author.username}`} className="text-sm text-gray-500 hover:underline">
                      @{author.username}
                    </Link>
                  )}
                </div>
                <div className="mt-2">
                  <p className="text-white whitespace-pre-wrap break-words">
                    {renderTextWithMentions(blip.content, true)}
                  </p>
                  {blip.imageUrl && (
                    <div className="mt-2 rounded-xl overflow-hidden">
                      <Image
                        src={blip.imageUrl}
                        alt="Blip image"
                        width={500}
                        height={300}
                        className="object-cover w-full"
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center mt-4 space-x-6 text-gray-500">
                  <div className="flex items-center space-x-2">
                    <ChatBubbleLeftIcon className="h-5 w-5" />
                    <span>{comments.length}</span>
                  </div>
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
              </div>
            </div>
          </div>

          <div className="bg-gray-dark rounded-lg p-4">
            <form onSubmit={handleSubmitComment} className="mb-6">
              <div className="relative">
                <MentionInput
                  ref={textareaRef}
                  value={newComment}
                  onChange={handleCommentChange}
                  placeholder="Write a comment..."
                  className="w-full bg-background rounded-lg p-3 text-white placeholder-gray-light resize-none min-h-[100px]"
                  maxLength={500}
                />
                {showMentionDropdown && mentionResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-64 bg-gray-dark rounded-lg shadow-lg border border-gray-700 max-h-48 overflow-y-auto">
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
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-gray-500">{newComment.length}/500</span>
                <button
                  type="submit"
                  disabled={!newComment.trim() || isSubmitting}
                  className="btn-primary px-4 disabled:opacity-50"
                >
                  {isSubmitting ? 'Posting...' : 'Post'}
                </button>
              </div>
            </form>

            <div className="space-y-4">
              {comments.map((comment) => {
                const commentAuthor = commentAuthors.get(comment.authorId);
                if (!commentAuthor) return null;

                return (
                  <div key={comment.id} className="flex space-x-3">
                    <Link href={`/profile/${commentAuthor.username || commentAuthor.id}`} className="shrink-0">
                      <Image
                        src={commentAuthor.photoURL}
                        alt={commentAuthor.name}
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-1">
                        <Link href={`/profile/${commentAuthor.username || commentAuthor.id}`} className="font-semibold text-white hover:underline">
                          {commentAuthor.name}
                        </Link>
                        <span className="text-gray-500">·</span>
                        <span className="text-gray-500 text-sm">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>
                      {commentAuthor.username && (
                        <Link href={`/profile/${commentAuthor.username}`} className="text-sm text-gray-500 hover:underline">
                          @{commentAuthor.username}
                        </Link>
                      )}
                      <p className="mt-1 text-white whitespace-pre-wrap break-words">
                        {renderTextWithMentions(comment.content)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
} 