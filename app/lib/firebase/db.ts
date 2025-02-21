import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  increment,
  arrayUnion,
  arrayRemove,
  writeBatch,
  deleteDoc,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ref,
  deleteObject,
} from 'firebase/storage';
import { db, storage } from '../firebase';
import { User } from 'firebase/auth';

// Types
export interface UserProfile {
  id: string;
  name: string;
  username: string | null;
  email: string;
  photoURL: string;
  bio: string;
  followers: string[];
  following: string[];
  blipsCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Blip {
  id: string;
  content: string;
  contentLower: string;
  authorId: string;
  imageUrl?: string;
  likes: string[];
  reblips: string[];
  comments: number;
  createdAt: Timestamp;
}

export interface Comment {
  id: string;
  blipId: string;
  authorId: string;
  content: string;
  createdAt: Timestamp;
  likes?: string[];
  replies?: number;
  parentId?: string;
}

export interface SearchUserResult extends UserProfile {
  isFollowing: boolean;
}

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'reblip';
  fromUserId: string;
  toUserId: string;
  blipId?: string;
  content?: string;
  createdAt: Timestamp;
  read: boolean;
}

// Remove empty interfaces and use type aliases instead
type FirebaseUserData = Omit<UserProfile, 'id'>;
type FirebaseBlipData = Omit<Blip, 'id'>;

// User Operations
export async function createUserProfile(user: User) {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const userData: Omit<UserProfile, 'id'> = {
      username: null,
      name: user.displayName || 'Anonymous User',
      email: user.email || '',
      photoURL: user.photoURL || '/default-avatar.svg',
      bio: 'Welcome to my Blips profile! 👋',
      followers: [],
      following: [],
      blipsCount: 0,
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
    };

    await setDoc(userRef, userData);
  }
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) return null;

  return {
    id: userSnap.id,
    ...userSnap.data(),
  } as UserProfile;
}

export async function updateUserProfile(userId: string, data: Partial<Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    ...data,
    updatedAt: Timestamp.fromDate(new Date()),
  });
}

// Follow Operations
export async function toggleFollow(currentUserId: string, targetUserId: string) {
  const currentUserRef = doc(db, 'users', currentUserId);
  const targetUserRef = doc(db, 'users', targetUserId);
  const currentUserSnap = await getDoc(currentUserRef);
  
  if (!currentUserSnap.exists()) return;
  
  const isFollowing = currentUserSnap.data().following.includes(targetUserId);
  
  if (isFollowing) {
    await updateDoc(currentUserRef, {
      following: arrayRemove(targetUserId),
    });
    await updateDoc(targetUserRef, {
      followers: arrayRemove(currentUserId),
    });
  } else {
    await updateDoc(currentUserRef, {
      following: arrayUnion(targetUserId),
    });
    await updateDoc(targetUserRef, {
      followers: arrayUnion(currentUserId),
    });
  }
}

// Blip Operations
export async function createBlip(
  authorId: string,
  content: string,
  imageUrl?: string
): Promise<Blip> {
  const blipsRef = collection(db, 'blips');
  
  const blipData: Omit<FirebaseBlipData, 'createdAt'> & { createdAt: Timestamp } = {
    content,
    contentLower: content.toLowerCase(),
    authorId,
    likes: [],
    reblips: [],
    comments: 0,
    createdAt: Timestamp.fromDate(new Date()),
  };

  // Only add imageUrl if it exists
  if (imageUrl) {
    blipData.imageUrl = imageUrl;
  }

  const docRef = await addDoc(blipsRef, blipData);
  
  // Update user's blip count
  await updateDoc(doc(db, 'users', authorId), {
    blipsCount: increment(1)
  });

  return {
    id: docRef.id,
    ...blipData,
    createdAt: Timestamp.fromDate(new Date()),
  };
}

export async function getBlip(blipId: string): Promise<Blip | null> {
  const blipRef = doc(db, 'blips', blipId);
  const blipSnap = await getDoc(blipRef);

  if (!blipSnap.exists()) return null;

  return {
    id: blipSnap.id,
    ...blipSnap.data(),
  } as Blip;
}

export async function getUserBlips(userId: string): Promise<Blip[]> {
  const blipsQuery = query(
    collection(db, 'blips'),
    where('authorId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  const blipsSnap = await getDocs(blipsQuery);
  return blipsSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Blip[];
}

export async function getFeedBlips(userId: string): Promise<Blip[]> {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) return [];
  
  const following = userSnap.data().following;
  following.push(userId); // Include user's own blips
  
  const blipsQuery = query(
    collection(db, 'blips'),
    where('authorId', 'in', following),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  const blipsSnap = await getDocs(blipsQuery);
  return blipsSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Blip[];
}

// Comment Operations
export async function createComment(blipId: string, authorId: string, content: string, parentId?: string) {
  try {
    const commentRef = await addDoc(collection(db, 'comments'), {
      blipId,
      authorId,
      content,
      createdAt: serverTimestamp(),
      likes: [],
      replies: 0,
      ...(parentId && { parentId }),
    });

    // Get the blip to notify its author
    const blipDoc = await getDoc(doc(db, 'blips', blipId));
    if (blipDoc.exists()) {
      const blip = { id: blipDoc.id, ...blipDoc.data() } as Blip;
      
      // Create notification for blip author if it's not their own comment
      if (blip.authorId !== authorId) {
        await createNotification(
          'comment',
          authorId,
          blip.authorId,
          blipId,
          content
        );
      }
    }

    // If this is a reply, increment the parent comment's replies count
    if (parentId) {
      const parentRef = doc(db, 'comments', parentId);
      await updateDoc(parentRef, {
        replies: increment(1)
      });

      // Get the parent comment to notify its author
      const parentDoc = await getDoc(parentRef);
      if (parentDoc.exists()) {
        const parentComment = { id: parentDoc.id, ...parentDoc.data() } as Comment;
        
        // Create notification for parent comment author if it's not their own reply
        if (parentComment.authorId !== authorId) {
          await createNotification(
            'comment',
            authorId,
            parentComment.authorId,
            blipId,
            content
          );
        }
      }
    }

    return commentRef.id;
  } catch (error) {
    console.error('Error creating comment:', error);
    throw error;
  }
}

export async function getBlipComments(blipId: string): Promise<Comment[]> {
  const commentsQuery = query(
    collection(db, 'comments'),
    where('blipId', '==', blipId),
    orderBy('createdAt', 'desc')
  );

  const commentsSnap = await getDocs(commentsQuery);
  return commentsSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Comment[];
}

export async function toggleCommentLike(commentId: string, userId: string) {
  try {
    const commentRef = doc(db, 'comments', commentId);
    const commentDoc = await getDoc(commentRef);
    
    if (!commentDoc.exists()) {
      throw new Error('Comment not found');
    }

    const comment = { id: commentDoc.id, ...commentDoc.data() } as Comment;
    const likes = comment.likes || [];
    const isLiked = likes.includes(userId);

    if (isLiked) {
      // Unlike
      await updateDoc(commentRef, {
        likes: arrayRemove(userId)
      });
    } else {
      // Like
      await updateDoc(commentRef, {
        likes: arrayUnion(userId)
      });

      // Create notification for comment author if it's not their own like
      if (comment.authorId !== userId) {
        await createNotification(
          'like',
          userId,
          comment.authorId,
          comment.blipId
        );
      }
    }
  } catch (error) {
    console.error('Error toggling comment like:', error);
    throw error;
  }
}

// Like Operations
export async function toggleLike(blipId: string, userId: string) {
  const blipRef = doc(db, 'blips', blipId);
  const blipSnap = await getDoc(blipRef);
  
  if (!blipSnap.exists()) return;
  
  const likes = blipSnap.data().likes || [];
  const isLiked = likes.includes(userId);
  
  await updateDoc(blipRef, {
    likes: isLiked ? arrayRemove(userId) : arrayUnion(userId),
  });

  // Create notification when liking (not when unliking)
  if (!isLiked) {
    await createNotification(
      'like',
      userId,
      blipSnap.data().authorId,
      blipId
    );
  }
}

// Reblip Operations
export async function toggleReblip(blipId: string, userId: string) {
  const blipRef = doc(db, 'blips', blipId);
  const blipSnap = await getDoc(blipRef);
  
  if (!blipSnap.exists()) return;
  
  const reblips = blipSnap.data().reblips || [];
  const isReblipped = reblips.includes(userId);
  
  await updateDoc(blipRef, {
    reblips: isReblipped ? arrayRemove(userId) : arrayUnion(userId),
  });

  // Create notification when reblipping (not when un-reblipping)
  if (!isReblipped) {
    await createNotification(
      'reblip',
      userId,
      blipSnap.data().authorId,
      blipId
    );
  }
}

// Username Operations
export async function isUsernameAvailable(username: string): Promise<boolean> {
  // Username requirements: 3-20 characters, letters, numbers, and underscores only
  if (!username.match(/^[a-zA-Z0-9_]{3,20}$/)) {
    return false;
  }

  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('username', '==', username.toLowerCase()));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.empty;
}

export async function setUsername(userId: string, username: string): Promise<boolean> {
  // Check availability first
  if (!await isUsernameAvailable(username)) {
    return false;
  }

  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    username: username.toLowerCase(),
    updatedAt: Timestamp.fromDate(new Date()),
  });

  return true;
}

export async function getUserByUsername(username: string): Promise<UserProfile | null> {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('username', '==', username.toLowerCase()));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) return null;

  const userDoc = querySnapshot.docs[0];
  return {
    id: userDoc.id,
    ...userDoc.data(),
  } as UserProfile;
}

export async function searchUsers(searchQuery: string, currentUserId: string | undefined): Promise<SearchUserResult[]> {
  const usersRef = collection(db, 'users');
  const queryText = searchQuery.toLowerCase();
  
  // Search by name, username, or bio
  const nameQueryRef = query(usersRef, 
    where('nameLower', '>=', queryText),
    where('nameLower', '<=', queryText + '\uf8ff'),
    limit(20)
  );
  
  const usernameQueryRef = query(usersRef,
    where('username', '>=', queryText),
    where('username', '<=', queryText + '\uf8ff'),
    limit(20)
  );

  const [nameResults, usernameResults] = await Promise.all([
    getDocs(nameQueryRef),
    getDocs(usernameQueryRef)
  ]);

  // Combine and deduplicate results
  const userMap = new Map<string, UserProfile>();
  
  nameResults.forEach(doc => {
    const data = doc.data() as FirebaseUserData;
    userMap.set(doc.id, { id: doc.id, ...data });
  });
  
  usernameResults.forEach(doc => {
    const data = doc.data() as FirebaseUserData;
    userMap.set(doc.id, { id: doc.id, ...data });
  });

  // If we have a current user, get their following list to check follow status
  let following: string[] = [];
  if (currentUserId) {
    const userDoc = await getDoc(doc(db, 'users', currentUserId));
    const userData = userDoc.data() as FirebaseUserData;
    following = userData?.following || [];
  }

  // Convert to array and add isFollowing status
  return Array.from(userMap.values())
    .map(user => ({
      ...user,
      isFollowing: following.includes(user.id)
    }));
}

export async function searchBlips(searchQuery: string): Promise<Blip[]> {
  const blipsRef = collection(db, 'blips');
  const queryText = searchQuery.toLowerCase();
  
  const queryRef = query(blipsRef,
    orderBy('contentLower'),
    where('contentLower', '>=', queryText),
    where('contentLower', '<=', queryText + '\uf8ff'),
    limit(20)
  );

  const querySnapshot = await getDocs(queryRef);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Blip[];
}

export async function followUser(followerId: string, targetUserId: string): Promise<void> {
  const batch = writeBatch(db);
  
  // Add to follower's following list
  const followerRef = doc(db, 'users', followerId);
  batch.update(followerRef, {
    following: arrayUnion(targetUserId)
  });
  
  // Add to target's followers list
  const targetRef = doc(db, 'users', targetUserId);
  batch.update(targetRef, {
    followers: arrayUnion(followerId)
  });
  
  await batch.commit();

  // Create notification
  await createNotification(
    'follow',
    followerId,
    targetUserId
  );
}

export async function unfollowUser(followerId: string, targetUserId: string): Promise<void> {
  const batch = writeBatch(db);
  
  // Remove from follower's following list
  const followerRef = doc(db, 'users', followerId);
  batch.update(followerRef, {
    following: arrayRemove(targetUserId)
  });
  
  // Remove from target's followers list
  const targetRef = doc(db, 'users', targetUserId);
  batch.update(targetRef, {
    followers: arrayRemove(followerId)
  });
  
  await batch.commit();
}

export async function deleteBlip(blipId: string, userId: string): Promise<void> {
  const blipRef = doc(db, 'blips', blipId);
  const blipSnap = await getDoc(blipRef);
  
  if (!blipSnap.exists() || blipSnap.data().authorId !== userId) {
    throw new Error('Unauthorized to delete this blip');
  }

  // Delete the blip
  await deleteDoc(blipRef);
  
  // Decrement user's blip count
  await updateDoc(doc(db, 'users', userId), {
    blipsCount: increment(-1)
  });

  // If there's an image, delete it from storage
  const blipData = blipSnap.data();
  if (blipData.imageUrl) {
    try {
      const imageRef = ref(storage, new URL(blipData.imageUrl).pathname);
      await deleteObject(imageRef);
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  }
}

export async function likeBlip(blipId: string, userId: string): Promise<void> {
  const blipRef = doc(db, 'blips', blipId);
  const blipDoc = await getDoc(blipRef);
  
  if (!blipDoc.exists()) {
    throw new Error('Blip not found');
  }

  const likes = blipDoc.data().likes || [];
  const isLiked = likes.includes(userId);

  if (isLiked) {
    // Unlike
    await updateDoc(blipRef, {
      likes: arrayRemove(userId)
    });
  } else {
    // Like
    await updateDoc(blipRef, {
      likes: arrayUnion(userId)
    });
    
    // Create notification
    await createNotification(
      'like',
      userId,
      blipDoc.data().authorId,
      blipId
    );
  }
}

export async function reblipBlip(blipId: string, userId: string): Promise<void> {
  const blipRef = doc(db, 'blips', blipId);
  const blipDoc = await getDoc(blipRef);
  
  if (!blipDoc.exists()) {
    throw new Error('Blip not found');
  }

  const reblips = blipDoc.data().reblips || [];
  const hasReblipped = reblips.includes(userId);

  if (hasReblipped) {
    // Un-reblip
    await updateDoc(blipRef, {
      reblips: arrayRemove(userId)
    });
  } else {
    // Reblip
    await updateDoc(blipRef, {
      reblips: arrayUnion(userId)
    });
    
    // Create notification
    await createNotification(
      'reblip',
      userId,
      blipDoc.data().authorId,
      blipId
    );
  }
}

export async function getUserLikedBlips(userId: string): Promise<Blip[]> {
  const blipsQuery = query(
    collection(db, 'blips'),
    where('likes', 'array-contains', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  const blipsSnap = await getDocs(blipsQuery);
  return blipsSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Blip[];
}

export async function getUserReblippedBlips(userId: string): Promise<Blip[]> {
  const blipsQuery = query(
    collection(db, 'blips'),
    where('reblips', 'array-contains', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  const blipsSnap = await getDocs(blipsQuery);
  return blipsSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Blip[];
}

// Notification Operations
export async function createNotification(
  type: Notification['type'],
  fromUserId: string,
  toUserId: string,
  blipId?: string,
  content?: string
): Promise<void> {
  // Don't create notification if user is interacting with their own content
  if (fromUserId === toUserId) return;

  const notificationData: Omit<Notification, 'id'> = {
    type,
    fromUserId,
    toUserId,
    createdAt: Timestamp.fromDate(new Date()),
    read: false,
  };

  if (blipId) {
    notificationData.blipId = blipId;
  }
  if (content) {
    notificationData.content = content;
  }

  await addDoc(collection(db, 'notifications'), notificationData);
}

export async function getNotifications(userId: string): Promise<Notification[]> {
  const notificationsQuery = query(
    collection(db, 'notifications'),
    where('toUserId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  const notificationsSnap = await getDocs(notificationsQuery);
  return notificationsSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Notification[];
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  const notificationRef = doc(db, 'notifications', notificationId);
  await updateDoc(notificationRef, {
    read: true,
  });
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const batch = writeBatch(db);
  // First get all unread notifications for the user
  const notificationsQuery = query(
    collection(db, 'notifications'),
    where('toUserId', '==', userId),
    where('read', '==', false),
    // Remove orderBy since we don't need sorting for this operation
    limit(100)
  );
  
  const notificationsSnap = await getDocs(notificationsQuery);
  notificationsSnap.docs.forEach(doc => {
    batch.update(doc.ref, { read: true });
  });
  
  if (notificationsSnap.docs.length > 0) {
    await batch.commit();
  }
}

export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  const unreadQuery = query(
    collection(db, 'notifications'),
    where('toUserId', '==', userId),
    where('read', '==', false)
  );

  const snapshot = await getDocs(unreadQuery);
  return snapshot.size;
}

export async function getUserProfileByUsername(username: string): Promise<UserProfile | null> {
  try {
    const q = query(
      collection(db, 'users'),
      where('username', '==', username.toLowerCase())
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    } as UserProfile;
  } catch (error) {
    console.error('Error getting user profile by username:', error);
    return null;
  }
}

export async function getGlobalBlips(): Promise<Blip[]> {
  const blipsQuery = query(
    collection(db, 'blips'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  const blipsSnap = await getDocs(blipsQuery);
  return blipsSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Blip[];
}

export async function getComment(commentId: string): Promise<Comment | null> {
  try {
    const commentDoc = await getDoc(doc(db, 'comments', commentId));
    if (!commentDoc.exists()) return null;
    return { id: commentDoc.id, ...commentDoc.data() } as Comment;
  } catch (error) {
    console.error('Error getting comment:', error);
    return null;
  }
}

export async function getCommentReplies(commentId: string): Promise<Comment[]> {
  try {
    const repliesQuery = query(
      collection(db, 'comments'),
      where('parentId', '==', commentId),
      orderBy('createdAt', 'desc')
    );
    const repliesSnapshot = await getDocs(repliesQuery);
    return repliesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Comment);
  } catch (error) {
    console.error('Error getting comment replies:', error);
    return [];
  }
} 