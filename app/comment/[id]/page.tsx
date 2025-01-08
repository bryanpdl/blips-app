'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeftIcon, HeartIcon, ChatBubbleLeftIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';
import ProtectedRoute from '../../components/auth/ProtectedRoute';
import Navbar from '../../components/navigation/Navbar';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getUserProfile, 
  createComment, 
  getComment,
  getCommentReplies,
  toggleCommentLike,
  searchUsers, 
  createNotification,
  type Comment,
  type SearchUserResult 
} from '../../lib/firebase/db';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { renderTextWithMentions } from '../../lib/utils';
import MentionInput from '../../components/common/MentionInput';

interface Author {
  id: string;
  name: string;
  username: string | null;
  photoURL: string;
}

export default function CommentPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [comment, setComment] = useState<Comment | null>(null);
  const [author, setAuthor] = useState<Author | null>(null);
  const [replies, setReplies] = useState<Comment[]>([]);
  const [replyAuthors, setReplyAuthors] = useState<Map<string, Author>>(new Map());
  const [newReply, setNewReply] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionResults, setMentionResults] = useState<SearchUserResult[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function loadCommentData() {
      if (!id) return;
      
      // Fetch comment
      const commentData = await getComment(id as string);
      if (!commentData) {
        router.push('/feed');
        return;
      }
      setComment(commentData);

      // Fetch comment author
      const authorProfile = await getUserProfile(commentData.authorId);
      if (authorProfile) {
        setAuthor({
          id: authorProfile.id,
          name: authorProfile.name,
          username: authorProfile.username,
          photoURL: authorProfile.photoURL,
        });
      }

      // Fetch replies
      const commentReplies = await getCommentReplies(id as string);
      setReplies(commentReplies);

      // Fetch reply authors
      const authors = new Map<string, Author>();
      await Promise.all(
        commentReplies.map(async (reply) => {
          const profile = await getUserProfile(reply.authorId);
          if (profile) {
            authors.set(reply.authorId, {
              id: profile.id,
              name: profile.name,
              username: profile.username,
              photoURL: profile.photoURL,
            });
          }
        })
      );
      setReplyAuthors(authors);
    }

    loadCommentData();
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

  const handleReplyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setNewReply(newContent);

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

    const beforeMention = newReply.slice(0, cursorPosition).replace(/@\w*$/, '');
    const afterMention = newReply.slice(cursorPosition);
    const updatedReply = `${beforeMention}@${username}${afterMention}`;
    
    setNewReply(updatedReply);
    setShowMentionDropdown(false);
    setMentionSearch('');

    if (textareaRef.current) {
      const newCursorPos = beforeMention.length + username.length + 1;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
    }
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !comment || !newReply.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Extract mentions from content
      const mentions = newReply.match(/@(\w+)/g) || [];
      const uniqueMentions = [...new Set(mentions)];

      await createComment(comment.blipId, user.uid, newReply, comment.id);
      
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
            comment.blipId,
            newReply
          );
        });
      }

      // Fetch updated replies
      const updatedReplies = await getCommentReplies(comment.id);
      setReplies(updatedReplies);

      // Add new reply author if needed
      if (!replyAuthors.has(user.uid)) {
        const profile = await getUserProfile(user.uid);
        if (profile) {
          setReplyAuthors(prev => new Map(prev).set(user.uid, {
            id: profile.id,
            name: profile.name,
            username: profile.username,
            photoURL: profile.photoURL,
          }));
        }
      }

      setNewReply('');
    } catch (error) {
      console.error('Error posting reply:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) return;
    await toggleCommentLike(commentId, user.uid);
    
    // Update comment in state if it's the main comment
    if (commentId === comment?.id) {
      setComment(prev => {
        if (!prev) return null;
        const likes = prev.likes || [];
        const isLiked = likes.includes(user.uid);
        return {
          ...prev,
          likes: isLiked 
            ? likes.filter(id => id !== user.uid)
            : [...likes, user.uid]
        };
      });
    } else {
      // Update reply in state
      setReplies(prev => prev.map(reply => {
        if (reply.id === commentId) {
          const likes = reply.likes || [];
          const isLiked = likes.includes(user.uid);
          return {
            ...reply,
            likes: isLiked 
              ? likes.filter(id => id !== user.uid)
              : [...likes, user.uid]
          };
        }
        return reply;
      }));
    }
  };

  const renderReply = (reply: Comment) => {
    const replyAuthor = replyAuthors.get(reply.authorId);
    if (!replyAuthor) return null;

    const isLiked = user && (reply.likes || []).includes(user.uid);

    return (
      <div key={reply.id} className="flex space-x-3">
        <Link href={`/profile/${replyAuthor.username || replyAuthor.id}`} className="shrink-0">
          <Image
            src={replyAuthor.photoURL}
            alt={replyAuthor.name}
            width={40}
            height={40}
            className="rounded-full"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-1">
            <Link href={`/profile/${replyAuthor.username || replyAuthor.id}`} className="font-semibold text-white hover:underline">
              {replyAuthor.name}
            </Link>
            <span className="text-gray-500">·</span>
            <span className="text-gray-500 text-sm">
              {new Date(reply.createdAt.toDate()).toLocaleDateString()}
            </span>
          </div>
          {replyAuthor.username && (
            <Link href={`/profile/${replyAuthor.username}`} className="text-sm text-gray-500 hover:underline">
              @{replyAuthor.username}
            </Link>
          )}
          <p className="mt-1 text-white whitespace-pre-wrap break-words">
            {renderTextWithMentions(reply.content)}
          </p>
          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={() => handleLikeComment(reply.id)}
              className={`${isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'} transition-colors text-sm flex items-center gap-1`}
            >
              {isLiked ? <HeartIconSolid className="h-4 w-4" /> : <HeartIcon className="h-4 w-4" />}
              <span>{(reply.likes || []).length}</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!comment || !author) return null;

  const isLiked = user && (comment.likes || []).includes(user.uid);

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
                  <div className="flex items-center space-x-1">
                    <Link href={`/profile/${author.username || author.id}`} className="font-semibold text-white hover:underline">
                      {author.name}
                    </Link>
                    <span className="text-gray-500">·</span>
                    <span className="text-gray-500 text-sm">
                      {new Date(comment.createdAt.toDate()).toLocaleDateString()}
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
                    {renderTextWithMentions(comment.content)}
                  </p>
                </div>
                <div className="flex items-center mt-4 space-x-6 text-gray-500">
                  <div className="flex items-center space-x-2">
                    <ChatBubbleLeftIcon className="h-5 w-5" />
                    <span>{replies.length}</span>
                  </div>
                  <button 
                    onClick={() => handleLikeComment(comment.id)}
                    className={`flex items-center space-x-2 transition-colors ${
                      isLiked ? 'text-red-500' : 'hover:text-red-500'
                    }`}
                  >
                    {isLiked ? (
                      <HeartIconSolid className="h-5 w-5" />
                    ) : (
                      <HeartIcon className="h-5 w-5" />
                    )}
                    <span>{(comment.likes || []).length}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-dark rounded-lg p-4">
            <form onSubmit={handleSubmitReply} className="mb-6">
              <div className="relative">
                <MentionInput
                  ref={textareaRef}
                  value={newReply}
                  onChange={handleReplyChange}
                  placeholder="Write a reply..."
                  className="w-full bg-gray-inputtext-white placeholder-gray-light resize-none min-h-[100px] rounded-lg p-3"
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
                <span className="text-sm text-gray-500">{newReply.length}/500</span>
                <button
                  type="submit"
                  disabled={!newReply.trim() || isSubmitting}
                  className="btn-primary px-4 disabled:opacity-50"
                >
                  {isSubmitting ? 'Posting...' : 'Reply'}
                </button>
              </div>
            </form>

            <div className="space-y-4">
              {replies.map(reply => renderReply(reply))}
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
} 