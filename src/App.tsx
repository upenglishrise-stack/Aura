import React, { useState, useEffect, useRef } from 'react';
import { Screen, UserProfile, Message, Story, AppNotification } from './types';
import {
  IMAGES,
  INITIAL_USER,
  STORIES,
  SPARKS,
  SUGGESTIONS,
  INITIAL_CHAT,
  INTERESTS_OPTIONS,
} from './data';
import { ScreenSelector } from './components/ScreenSelector';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';

const compressImage = (base64Str: string, maxWidth = 450, maxHeight = 450, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    if (!base64Str || !base64Str.startsWith('data:image/')) {
      resolve(base64Str);
      return;
    }
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
};

export interface ChatPartner {
  id: string;
  name: string;
  photo: string;
  bio?: string;
  age?: number;
  username?: string;
}

const AVAILABLE_PEOPLE: ChatPartner[] = [
  { id: 'elena', name: 'Elena', photo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDTEcb525i5H_9hYXC6PieFh41_m9NXm7cJ3hDkx8D4hS4w3HPDYtaNJOcJCbeQHC61mpHNUqLk67Z95Ipgh6De3GV436TCpXzPS4PsGUuBx5QKkb8I7PgbKRs_ABpyLvOjumh_1aFd9cf03T6g-gGeE5p6voRvsk375AqdT2wCFkCCkge3Ut3kXh4fQC01CG1JGcC-p_BL177toz6O2bFcHIE2ydpSrhYHwtcGkUzrTWhQpvEgDT3h', bio: 'Architectural Designer • Zurich', age: 26, username: 'elena' },
  { id: 'sarah', name: 'Sarah', photo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAPVtHLlQnY2WXjv7f20ZA-06zeF9fouiUGJnY5QYcMyYylTvMtWEHEUlItt_ARFSzuFh0iz4Hjs8oLePDkz1i-4VlDw2ZRmK9qqV37innUno4Ro_zUAh-ozixmfebKcbsFf2VzzVVr38ZgWobqOrx3VdD2uaXQ4-kRch18A3iMyXVtjpkkDePWwboWvbHGgbTGLEZUmKvdO7Qgw7qogBHKgBn56yqPc2SW88ZRCJWw8ICJVZbi_aE2', bio: 'Digital Artist • San Francisco', age: 24, username: 'sarah' },
  { id: 'leo', name: 'Leo', photo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCXl588ZxG5U287jX8lsycyScKx31l9RlFaMRreLIJcywnmhIsrwK32l0mxo3xG2faOtJaAQ4RnMit5E1sCoeHUj2_qU5mywXIzy8a2-s2qDFHYnAkReKxWd5g_iN2W1sXkmfGPF3SNU3u8LJ-DSDgfxvdTNEL_OK3hegPg0TmBrseonuOinU0ocCgRxVHGzrCpAGhah_VqTUJsNeUT4yvbfIOx2z4s-28by3-KJehTZ4GTSNTVCNP_', bio: 'Musician & Writer • Paris', age: 29, username: 'leo' },
  { id: 'maya', name: 'Maya', photo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA7q3Mw2Va0247aQn9L8l-XLmFkgmNP6OCeIbLA2aXPLADofAT8B5rZpi9-3mpwwtCasXJDtKHNK5aY0dGUfiZG_Irhn86-JncHmDP32P21ajRuJkt1aSS59wnVuebm8_8uiOv_xTI0Y3OPceA8e6NyrHYCNvc0buR4S4wg7JJjKIKT7-tynBOmZoBxKjpoB_GXrsBUJJIMZ0HTXhectLSEbIPywqz0j5jwqz5-wPoilWYv9OMa84u6', bio: 'Yoga Instructor • London', age: 27, username: 'maya' },
  { id: 'chloe', name: 'Chloe', photo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBy6ox1xg555JY1C0BWeQnoTlRBiC_m2-8EngnagVfMLYAfTOXmxObGUIO-rFln1guhzzs9cSRvTGy8zF0Ln6QnjHpKdRPRnnl88-LxC5BBPhf0iNUKTUla-xSBfb8jIYEXp5yjyq7C7XIY60kvqPLDxsGIqSFZLlsf481QzTdLA3RKsOjfhfwZZjx3AvkUZYHP4aMXkydqPlDIDBRNBY3eAmJM6lX1R0YH515kWyARiRt2QSBjc22D', bio: 'Interior Designer • New York', age: 25, username: 'chloe' },
  { id: 'oliver', name: 'Oliver', photo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBVwkQeazcKuM7A8WmiSOos_DKdjOb_AOKMdjHmP11py_xmOgNvrTJ_wMtxnlcLXSsTCg-tdeff8hw4cRzphn_jx_TBi9IOFgXbS9d2Oq6zfIu82_e77XZPm19vYcxWGXC6fUiPinh2AXOQ0yGidqPKaaDifdT9wn-U-Io9ZVbI_V1R_xKxE_Ql2Sn6eGIdFfTKT7dZjagDh4H4Y6wjgYQ0GQd5tqAop1M7Ay0OTtwKEqFv9abcnoNj', bio: 'Architect & Travel Blogger • London', age: 28, username: 'oliver' },
  { id: 'sofia', name: 'Sofia', photo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCzzYllRA0pDMy4llUKQoNpVpNbZBJkJuozkFh2tpUalLi2LT--sbcsiW2mNcgHMbtMZ_ILZin2ngZPF5hQzJaHQ_kbaQRmhSylxEQUsG23pM2MQ8WkDdQh7rXsE1zEfzkyti4zi_v_5O_VXhfT5owA8cCUXse419b_uYfwNpveiPpClGE43c23xJ76G7rRM9nRy3mxqll3H9_jq7CPsQlS1b9svYihkpBVLIIcbvDnYf_CHE8yiAku', bio: 'Classical Pianist • Paris', age: 26, username: 'sofia' },
  { id: 'marcus', name: 'Marcus', photo: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDhHE_ILflV-YAM8JYvSlv8_A92-FcRwlQGn_JrcpiwpHjpQW-jnkOjlrTMVB0HWP9wC0nHQ-IlqvP-c3nFIbHpAIHsRlGJAo8Ggu94V-_fASxkVU1LfOjWrmNoHAGiF7mB_7vAUZOP-gVVeDYp_xvkjSJM6pe9ImHGZ2LiefOkHm1J55oZbdl_8U44BPBIZeg-_zJdg7SQZXpsL_H-MzQc_F8WXNxaoav8VnnizXK4WLR-iceCGYAo', bio: 'App Developer • Berlin', age: 30, username: 'marcus' }
];

export default function App() {
  // App States
  const [userRegistered, setUserRegistered] = useState(() => {
    return localStorage.getItem('aura_user_registered') === 'true';
  });
  const [isGuest, setIsGuest] = useState(() => {
    return localStorage.getItem('aura_is_guest') === 'true';
  });
  const [currentScreen, setCurrentScreen] = useState<Screen>(() => {
    const saved = localStorage.getItem('aura_current_screen') as Screen;
    return (saved && saved !== 'welcome' && saved !== 'signin' && saved !== 'onboarding_basics' && saved !== 'onboarding_interests' && saved !== 'onboarding_photos') ? saved : 'welcome';
  });
  const [userProfile, setUserProfile] = useState<UserProfile>(INITIAL_USER);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Record<string, Message[]>>({});
  const [selectedChatPartner, setSelectedChatPartner] = useState<ChatPartner | null>(null);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [dbSearchResults, setDbSearchResults] = useState<any[]>([]);

  // Fetch all registered users to dynamically populate Discover and Search feeds
  useEffect(() => {
    fetchFromBackend('/api/users/all')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Failed to load registered users');
      })
      .then((data: any[]) => {
        if (data && data.length > 0) {
          // Map backend users to ChatPartner format
          const backendUsersMapped = data.map((u) => {
            let photoUrl = u.photo || IMAGES.coupleBackground;
            if (u.photos) {
              try {
                const photosArr = typeof u.photos === 'string' ? JSON.parse(u.photos) : u.photos;
                if (Array.isArray(photosArr) && photosArr.length > 0 && photosArr[0]) {
                  photoUrl = photosArr[0];
                }
              } catch (e) {}
            }
            return {
              id: u.uid,
              name: u.name || u.username || 'Aura User',
              photo: photoUrl,
              bio: u.bio || 'New member of Aura community',
              age: u.age || 25,
              username: u.username || u.uid,
            };
          });

          // Merge with AVAILABLE_PEOPLE, making sure to avoid duplicates
          setDiscoverPeople((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newPeople = backendUsersMapped.filter(
              (p) => !existingIds.has(p.id) && p.id !== auth.currentUser?.uid && p.id !== userProfile.uid
            );
            return [...prev, ...newPeople];
          });
        }
      })
      .catch((err) => console.warn('Could not load server profiles:', err));
  }, [userRegistered, auth.currentUser, userProfile.uid]);

  // DB search trigger
  useEffect(() => {
    if (chatSearchQuery.trim() === '') {
      setDbSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(() => {
      fetchFromBackend(`/api/users/search?q=${encodeURIComponent(chatSearchQuery)}`)
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Search failed');
        })
        .then((data) => {
          setDbSearchResults(data || []);
        })
        .catch((err) => {
          console.warn('PostgreSQL search failed:', err);
        });
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [chatSearchQuery]);
  const [userStories, setUserStories] = useState<Story[]>([]);
  const storyFileInputRef = useRef<HTMLInputElement>(null);
  const chatCameraInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const [profileCompletion, setProfileCompletion] = useState(85);
  const [profilePrompt, setProfilePrompt] = useState('My perfect Sunday...');
  const [profilePromptResponse, setProfilePromptResponse] = useState('Starts with fresh espresso, ends with a vinyl record.');
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [activeStoryTimeLeft, setActiveStoryTimeLeft] = useState<number>(100);
  const [sparksList, setSparksList] = useState(SPARKS);
  const [inputText, setInputText] = useState('');
  const [isElenaTyping, setIsElenaTyping] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'yearly' | 'monthly'>('yearly');
  const [goldSuccess, setGoldShadowSuccess] = useState(false);
  const [goldUser, setGoldUser] = useState(false);
  const [saveSuccessToast, setSaveSuccessToast] = useState(false);
  const [payoutStatus, setPayoutStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [profilePicUrls, setProfilePicUrls] = useState<string[]>([IMAGES.primaryOnboardingPic]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [userSparks, setUserSparks] = useState(() => {
    const saved = localStorage.getItem('aura_user_sparks');
    return saved ? parseInt(saved, 10) : 5;
  });
  const [watchingAd, setWatchingAd] = useState(false);
  const [adTimeLeft, setAdTimeLeft] = useState(0);
  const [guestWarningModal, setGuestWarningModal] = useState<string | null>(null);

  // Dynamic States for Discover Feed, Streaks, Home Search, and Profile Actions
  const [discoverPeople, setDiscoverPeople] = useState<any[]>(AVAILABLE_PEOPLE);
  const [activeDiscoverIndex, setActiveDiscoverIndex] = useState(0);
  const [selectedDiscoverPerson, setSelectedDiscoverPerson] = useState<any>(AVAILABLE_PEOPLE[0]);
  const [homeSearchQuery, setHomeSearchQuery] = useState('');
  const [chatStreaks, setChatStreaks] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('aura_chat_streaks');
    return saved ? JSON.parse(saved) : { elena: 5, sarah: 2 };
  });
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileShareOpen, setProfileShareOpen] = useState(false);

  const [mockFollowBacks, setMockFollowBacks] = useState<Record<string, boolean>>({
    elena: false,
    sarah: false,
    leo: false,
    maya: false,
    chloe: false,
    oliver: false,
    sofia: false,
    marcus: false,
  });

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [notifications, setNotifications] = useState<AppNotification[]>([
    {
      id: 'notif_1',
      type: 'follow',
      title: 'New Follower',
      message: 'Elena (@elena) started following you. Follow back to unlock messaging, her full profile, and stories!',
      senderId: 'elena',
      senderName: 'Elena',
      senderPhoto: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDTEcb525i5H_9hYXC6PieFh41_m9NXm7cJ3hDkx8D4hS4w3HPDYtaNJOcJCbeQHC61mpHNUqLk67Z95Ipgh6De3GV436TCpXzPS4PsGUuBx5QKkb8I7PgbKRs_ABpyLvOjumh_1aFd9cf03T6g-gGeE5p6voRvsk375AqdT2wCFkCCkge3Ut3kXh4fQC01CG1JGcC-p_BL177toz6O2bFcHIE2ydpSrhYHwtcGkUzrTWhQpvEgDT3h',
      senderUsername: 'elena',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      canFollowBack: true
    },
    {
      id: 'notif_2',
      type: 'follow',
      title: 'New Follower',
      message: 'Sarah (@sarah) started following you. Follow back to unlock her stories and profile!',
      senderId: 'sarah',
      senderName: 'Sarah',
      senderPhoto: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAPVtHLlQnY2WXjv7f20ZA-06zeF9fouiUGJnY5QYcMyYylTvMtWEHEUlItt_ARFSzuFh0iz4Hjs8oLePDkz1i-4VlDw2ZRmK9qqV37innUno4Ro_zUAh-ozixmfebKcbsFf2VzzVVr38ZgWobqOrx3VdD2uaXQ4-kRch18A3iMyXVtjpkkDePWwboWvbHGgbTGLEZUmKvdO7Qgw7qogBHKgBn56yqPc2SW88ZRCJWw8ICJVZbi_aE2',
      senderUsername: 'sarah',
      read: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      canFollowBack: true
    },
    {
      id: 'notif_3',
      type: 'follow',
      title: 'New Follower',
      message: 'Leo (@leo) started following you. Follow back to unlock his stories!',
      senderId: 'leo',
      senderName: 'Leo',
      senderPhoto: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCXl588ZxG5U287jX8lsycyScKx31l9RlFaMRreLIJcywnmhIsrwK32l0mxo3xG2faOtJaAQ4RnMit5E1sCoeHUj2_qU5mywXIzy8a2-s2qDFHYnAkReKxWd5g_iN2W1sXkmfGPF3SNU3u8LJ-DSDgfxvdTNEL_OK3hegPg0TmBrseonuOinU0ocCgRxVHGzrCpAGhah_VqTUJsNeUT4yvbfIOx2z4s-28by3-KJehTZ4GTSNTVCNP_',
      senderUsername: 'leo',
      read: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      canFollowBack: true
    }
  ]);

  // Authentication custom states
  const [emailMode, setEmailMode] = useState<'options' | 'login' | 'signup'>('options');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Profile photo addition states & refs
  const [photoSlotToEdit, setPhotoSlotToEdit] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form setup states
  const [onboardingName, setOnboardingName] = useState('');
  const [onboardingUsername, setOnboardingUsername] = useState('');
  const [onboardingDob, setOnboardingDob] = useState({ dd: '', mm: '', yyyy: '' });
  const [onboardingGender, setOnboardingGender] = useState('');
  const [onboardingInterests, setOnboardingInterests] = useState<string[]>(['Art', 'Travel', 'Jazz']);
  const [onboardingError, setOnboardingError] = useState('');
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('aura_blocked_users');
    return saved ? JSON.parse(saved) : [];
  });
  const [reportedUserIds, setReportedUserIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('aura_reported_users');
    return saved ? JSON.parse(saved) : [];
  });
  const [toastMessage, setToastMessage] = useState<{ text: string; type?: 'success' | 'info' | 'error' | 'spark' } | null>(null);
  const [activeCall, setActiveCall] = useState<{ partner: any; type: 'voice' | 'video'; status: 'ringing' | 'connected'; duration: number } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);

  const showToast = (text: string, type: 'success' | 'info' | 'error' | 'spark' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => prev?.text === text ? null : prev);
    }, 4000);
  };

  const [trackingLogs, setTrackingLogs] = useState<any[]>([]);
  const [loadingTracking, setLoadingTracking] = useState<boolean>(false);

  // Helper to fetch from Express backend with Firebase ID Token
  const fetchFromBackend = async (url: string, options: RequestInit = {}) => {
    const currentUser = auth.currentUser;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    } as Record<string, string>;

    if (currentUser) {
      try {
        const token = await currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      } catch (err) {
        console.warn('Failed to retrieve Firebase ID Token', err);
      }
    }

    return fetch(url, {
      ...options,
      headers,
    });
  };

  // Log tracking event to Postgres via Express server
  const trackUserAction = async (eventType: string, screenName?: string, details?: any) => {
    try {
      await fetchFromBackend('/api/tracking/event', {
        method: 'POST',
        body: JSON.stringify({
          eventType,
          screenName,
          details,
        }),
      });
    } catch (err) {
      console.warn('Failed to send user tracking log:', err);
    }
  };

  // Chat scroll anchor
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isElenaTyping, currentScreen]);

  // Keep currentScreen in localStorage so refresh works flawlessly
  useEffect(() => {
    if (currentScreen !== 'welcome' && currentScreen !== 'signin' && currentScreen !== 'onboarding_basics' && currentScreen !== 'onboarding_interests' && currentScreen !== 'onboarding_photos') {
      localStorage.setItem('aura_current_screen', currentScreen);
    }
  }, [currentScreen]);

  // Simulated Elena Responses
  const elenaResponses = [
    "I love that perspective! It's so rare to find someone who notices the quiet moments in the facade of buildings.",
    "That makes perfect sense. Do you think spaces have an actual aura, or do we bring our own into them?",
    "That sounds wonderful. Let's plan to visit that new exhibition next Sunday! No notifications, just coffee and art. ☕",
    "Haha, yes! A handwritten note really is the ultimate luxury in a digital world. 📝",
    "Tell me more about your recent project. Brutalist geometry always makes me feel so grounded yet inspired.",
  ];
  const [elenaResponseIdx, setElenaResponseIndex] = useState(0);

  // Story Timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeStoryIndex !== null) {
      setActiveStoryTimeLeft(100);
      const interval = 40; // 40ms * 100 = 4 seconds total story view
      timer = setInterval(() => {
        setActiveStoryTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            // Auto-advance or close
            const totalStoriesCount = userStories.length + STORIES.length;
            if (activeStoryIndex < totalStoriesCount - 1) {
              setActiveStoryIndex(activeStoryIndex + 1);
            } else {
              setActiveStoryIndex(null);
            }
            return 100;
          }
          return prev - 1;
        });
      }, interval);
    }
    return () => clearInterval(timer);
  }, [activeStoryIndex]);

  // Screen/Guest refs to prevent unstable listener re-registrations
  const currentScreenRef = useRef(currentScreen);
  currentScreenRef.current = currentScreen;
  const isGuestRef = useRef(isGuest);
  isGuestRef.current = isGuest;

  // Synchronize states to localStorage
  useEffect(() => {
    localStorage.setItem('aura_is_guest', String(isGuest));
  }, [isGuest]);

  useEffect(() => {
    localStorage.setItem('aura_user_registered', String(userRegistered));
  }, [userRegistered]);



  useEffect(() => {
    localStorage.setItem('aura_user_sparks', String(userSparks));
  }, [userSparks]);

  // Handle ad playback progress reward tick
  useEffect(() => {
    if (watchingAd && adTimeLeft > 0) {
      const timer = setTimeout(() => {
        setAdTimeLeft((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (watchingAd && adTimeLeft === 0) {
      setWatchingAd(false);
      setUserSparks((prev) => prev + 5);
      showToast("✨ Ad completed! You earned 5 Sparks.", "success");
    }
  }, [watchingAd, adTimeLeft]);

  // Handle active call connection and duration simulation
  useEffect(() => {
    if (activeCall) {
      if (activeCall.status === 'ringing') {
        const timeout = setTimeout(() => {
          setActiveCall((prev) => prev ? { ...prev, status: 'connected' } : null);
        }, 3000);
        return () => clearTimeout(timeout);
      } else if (activeCall.status === 'connected') {
        const interval = setInterval(() => {
          setActiveCall((prev) => prev ? { ...prev, duration: prev.duration + 1 } : null);
        }, 1000);
        return () => clearInterval(interval);
      }
    }
  }, [activeCall?.status]);

  // Reset sparks helper
  const resetSparksList = () => {
    setSparksList((prev) =>
      prev.map((spark) => ({ ...spark, status: 'pending' }))
    );
    showToast("✨ Spark requests have been reset to pending!", "success");
  };

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setIsGuest(false);
        try {
          const token = await firebaseUser.getIdToken();
          // Fetch from PostgreSQL backend
          const pgRes = await fetch('/api/users/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (pgRes.ok) {
            const data = await pgRes.json();
            // Map comma-separated interests back to array if needed
            const interestsArray = data.interests ? data.interests.split(',') : [];
            let parsedPhotos: string[] = [];
            if (data.photos) {
              try {
                parsedPhotos = typeof data.photos === 'string' ? JSON.parse(data.photos) : data.photos;
              } catch (e) {
                console.warn('Failed to parse photos column:', e);
              }
            }
            if (!Array.isArray(parsedPhotos) || parsedPhotos.length === 0) {
              parsedPhotos = data.photo ? [data.photo] : [IMAGES.primaryOnboardingPic];
            }

            const profileData: UserProfile = {
              ...data,
              username: data.username || data.uid, // Map username if set, else fallback to uid
              photos: parsedPhotos,
              interests: interestsArray,
              following: data.following || [],
              followers: data.followers || [],
            };
            setUserProfile(profileData);
            setProfilePicUrls(parsedPhotos);
            setUserRegistered(true);

            // Restore screen state from localStorage
            const savedScreen = localStorage.getItem('aura_current_screen') as Screen;
            if (savedScreen && savedScreen !== 'welcome' && savedScreen !== 'signin' && savedScreen !== 'onboarding_basics' && savedScreen !== 'onboarding_interests' && savedScreen !== 'onboarding_photos') {
              setCurrentScreen(savedScreen);
            } else if (['welcome', 'signin'].includes(currentScreenRef.current)) {
              setCurrentScreen('discover');
            }

            // Track login in PostgreSQL
            fetch('/api/tracking/event', {
              method: 'POST',
              headers: { 
                'Authorization': `Bearer ${token}`, 
                'Content-Type': 'application/json' 
              },
              body: JSON.stringify({ 
                eventType: 'login_event', 
                screenName: 'welcome', 
                details: { source: 'postgres' } 
              })
            }).catch(() => {});
            
            setCheckingAuth(false);
            return;
          }
        } catch (pgErr) {
          console.warn('Postgres profile load failed, trying Firestore fallback:', pgErr);
        }

        // Firestore fallback
        const docRef = doc(db, 'users', firebaseUser.uid);
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setUserProfile(data);
            if (data.photos && data.photos.length > 0) {
              setProfilePicUrls(data.photos);
            }
            setUserRegistered(true);

            // Save to postgres so it's synced
            const token = await firebaseUser.getIdToken();
            fetch('/api/users/profile', {
              method: 'POST',
              headers: { 
                'Authorization': `Bearer ${token}`, 
                'Content-Type': 'application/json' 
              },
              body: JSON.stringify({
                ...data,
                photo: data.photos && data.photos.length > 0 ? data.photos[0] : null,
                photos: data.photos || [],
                interests: data.interests ? data.interests.join(',') : '',
              }),
            }).catch(() => {});

            // Restore screen state from localStorage
            const savedScreen = localStorage.getItem('aura_current_screen') as Screen;
            if (savedScreen && savedScreen !== 'welcome' && savedScreen !== 'signin' && savedScreen !== 'onboarding_basics' && savedScreen !== 'onboarding_interests' && savedScreen !== 'onboarding_photos') {
              setCurrentScreen(savedScreen);
            } else if (['welcome', 'signin'].includes(currentScreenRef.current)) {
              setCurrentScreen('discover');
            }
          } else {
            // New user, not registered/onboarded yet
            setUserRegistered(false);
            if (['welcome', 'signin'].includes(currentScreenRef.current)) {
              setCurrentScreen('onboarding_basics');
            }
          }
        } catch (error: any) {
          console.warn('Firestore load failed, using local profile fallback:', error);
          setUserProfile(INITIAL_USER);
          setUserRegistered(true);

          const savedScreen = localStorage.getItem('aura_current_screen') as Screen;
          if (savedScreen && savedScreen !== 'welcome' && savedScreen !== 'signin' && savedScreen !== 'onboarding_basics' && savedScreen !== 'onboarding_interests' && savedScreen !== 'onboarding_photos') {
            setCurrentScreen(savedScreen);
          } else if (['welcome', 'signin'].includes(currentScreenRef.current)) {
            setCurrentScreen('discover');
          }
        }
      } else {
        // Not logged in (guest or logged out)
        if (isGuestRef.current) {
          // Guest mode is active, restore screen state from localStorage
          const savedScreen = localStorage.getItem('aura_current_screen') as Screen;
          if (savedScreen && savedScreen !== 'welcome' && savedScreen !== 'signin' && savedScreen !== 'onboarding_basics' && savedScreen !== 'onboarding_interests' && savedScreen !== 'onboarding_photos') {
            setCurrentScreen(savedScreen);
          } else {
            setCurrentScreen('discover');
          }
        } else {
          setUserProfile(INITIAL_USER);
          setProfilePicUrls([IMAGES.primaryOnboardingPic]);
          setUserRegistered(false);
        }
      }
      setCheckingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // Save profile to PostgreSQL database and Firestore as backup
  const saveProfileToFirestore = async (updatedProfile?: UserProfile) => {
    const currentUser = auth.currentUser;
    const profileToSave = updatedProfile || userProfile;

    // Save to PostgreSQL via Express backend
    try {
      await fetchFromBackend('/api/users/profile', {
        method: 'POST',
        body: JSON.stringify({
          email: profileToSave.email,
          name: profileToSave.name,
          username: profileToSave.username || null,
          photo: profileToSave.photos ? profileToSave.photos[0] : null,
          photos: profileToSave.photos || [],
          bio: profileToSave.bio,
          age: profileToSave.age,
          gender: profileToSave.gender || null,
          interests: profileToSave.interests ? profileToSave.interests.join(',') : '',
          role: profileToSave.role || 'user',
          isSubscribed: profileToSave.isSubscribed || false,
        }),
      });
    } catch (err) {
      console.warn('Failed to save profile to PostgreSQL database:', err);
    }

    // Backup to Firestore
    if (currentUser) {
      const docRef = doc(db, 'users', currentUser.uid);
      try {
        await setDoc(docRef, {
          ...profileToSave,
          updatedAt: new Date().toISOString()
        });
      } catch (error: any) {
        console.warn('Firestore backup write failed:', error);
      }
    }

    setUserProfile(profileToSave);
    setUserRegistered(true);
    setSaveSuccessToast(true);
    setTimeout(() => setSaveSuccessToast(false), 2500);
  };

  // Helper to format Auth / Firestore errors nicely for the user
  const formatAuthError = (error: any, actionName: string) => {
    const code = error?.code || '';
    const message = error?.message || '';
    if (code === 'auth/operation-not-allowed' || message.includes('operation-not-allowed')) {
      return `Firebase Error: 'Email/Password' or 'Google' sign-in is not enabled in your Firebase Authentication Console. Please enable them. You can bypass this instantly by clicking 'Auto-Login (Bypass)' below, or go back and click 'Explore as Guest'!`;
    }
    if (message.includes('permission') || code.includes('permission')) {
      return `Firebase Error: Missing or insufficient Firestore database permissions. Tap 'Auto-Login (Bypass)' to continue with local state offline.`;
    }
    return message || `${actionName} failed`;
  };

  // Safe Auto-Login Bypass for quick testing when Firebase providers are disabled
  const handleAuthBypass = () => {
    setIsGuest(false);
    setUserProfile({
      ...INITIAL_USER,
      username: 'tester',
      name: 'Julian (Tester)',
      following: [],
      followers: []
    });
    setProfilePicUrls([IMAGES.julianEditPhoto]);
    setUserRegistered(true);
    setCurrentScreen('discover');
    setAuthError('');
  };

  // Google Sign In handler
  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        // Successful login
        const docRef = doc(db, 'users', result.user.uid);
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setUserProfile(data);
            if (data.photos && data.photos.length > 0) {
              setProfilePicUrls(data.photos);
            }
            setUserRegistered(true);
            setCurrentScreen('discover');
          } else {
            setUserRegistered(false);
            setCurrentScreen('onboarding_basics');
          }
        } catch (dbErr) {
          console.warn('DB read failed during Google sign-in. Bypassing to local onboarding.', dbErr);
          setUserRegistered(false);
          setCurrentScreen('onboarding_basics');
        }
      }
    } catch (error: any) {
      console.error(error);
      setAuthError(formatAuthError(error, 'Google Sign In'));
    } finally {
      setAuthLoading(false);
    }
  };

  // Email Sign In handler
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setAuthError('Please fill in all fields.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      if (result.user) {
        const docRef = doc(db, 'users', result.user.uid);
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setUserProfile(data);
            if (data.photos && data.photos.length > 0) {
              setProfilePicUrls(data.photos);
            }
            setUserRegistered(true);
            setCurrentScreen('discover');
          } else {
            setUserRegistered(false);
            setCurrentScreen('onboarding_basics');
          }
        } catch (dbErr) {
          console.warn('DB read failed during Email login. Bypassing to discover.', dbErr);
          setUserRegistered(true);
          setCurrentScreen('discover');
        }
      }
    } catch (error: any) {
      console.error(error);
      setAuthError(formatAuthError(error, 'Email Sign In'));
    } finally {
      setAuthLoading(false);
    }
  };

  // Email Sign Up handler
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setAuthError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (result.user) {
        // Sign up success, navigate to onboarding basics
        setUserRegistered(false);
        setCurrentScreen('onboarding_basics');
      }
    } catch (error: any) {
      console.error(error);
      setAuthError(formatAuthError(error, 'Email Sign Up'));
    } finally {
      setAuthLoading(false);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsGuest(false);
      setEmailMode('options');
      setEmail('');
      setPassword('');
      setAuthError('');
      setCurrentScreen('welcome');
    } catch (error) {
      console.error(error);
      // Fallback
      setIsGuest(false);
      setEmailMode('options');
      setEmail('');
      setPassword('');
      setAuthError('');
      setCurrentScreen('welcome');
    }
  };

  // Local photo upload file selection handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || photoSlotToEdit === null) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64String = event.target?.result as string;
      if (base64String) {
        const compressedBase64 = await compressImage(base64String);
        
        setProfilePicUrls((prev) => {
          const updated = [...prev];
          while (updated.length <= photoSlotToEdit) {
            updated.push('');
          }
          updated[photoSlotToEdit] = compressedBase64;
          return updated;
        });
        
        setUserProfile((prev) => {
          const updatedPhotos = prev.photos ? [...prev.photos] : [];
          while (updatedPhotos.length <= photoSlotToEdit) {
            updatedPhotos.push('');
          }
          updatedPhotos[photoSlotToEdit] = compressedBase64;
          const updated = {
            ...prev,
            photos: updatedPhotos
          };
          // If on edit_profile screen, also automatically trigger Firestore update
          if (currentScreen === 'edit_profile') {
            saveProfileToFirestore(updated);
          }
          return updated;
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Local story upload file selection handler
  const handleStoryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64String = event.target?.result as string;
      if (base64String) {
        const compressedBase64 = await compressImage(base64String, 500, 700, 0.75); // stories can be slightly taller
        const newStory: Story = {
          id: 'user_story_' + Date.now(),
          name: 'Your Story',
          photo: compressedBase64,
          active: true,
        };
        setUserStories((prev) => [newStory, ...prev]);
        // Auto show the newly uploaded story
        setActiveStoryIndex(0);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Send message handler
  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const partnerId = selectedChatPartner ? selectedChatPartner.id : 'elena';

    // Restrict messages to mutual followers only to prevent the auto-follow bug #8
    if (!isMutualFollower(partnerId)) {
      showToast("You must mutually match with this user to send a message!", "error");
      return;
    }

    const newMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setConversations((prev) => ({
      ...prev,
      [partnerId]: [...(prev[partnerId] || []), newMsg],
    }));

    setChatStreaks((prev) => {
      const currentVal = prev[partnerId] || 0;
      const newVal = currentVal + 1;
      const updated = { ...prev, [partnerId]: newVal };
      localStorage.setItem('aura_chat_streaks', JSON.stringify(updated));
      return updated;
    });

    setInputText('');
    setIsElenaTyping(true);

    // Save user message to PostgreSQL database
    fetchFromBackend('/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        receiverUid: partnerId,
        text: newMsg.text,
        timeString: newMsg.time,
      }),
    }).catch((e) => console.warn('Failed to save user msg to PostgreSQL:', e));

    // Simulate Typing response from partner
    setTimeout(() => {
      setIsElenaTyping(false);
      let responseText = '';
      if (partnerId === 'elena') {
        responseText = elenaResponses[elenaResponseIdx % elenaResponses.length];
        setElenaResponseIndex((prev) => prev + 1);
      } else {
        const genericResponses = [
          `Hey! That sounds really interesting. Tell me more! 😊`,
          `I completely agree! It's great to find someone who shares similar thoughts.`,
          `That is beautiful! Let's meet up sometime and talk more about it. ☕`,
          `Wow, really? I never thought about it that way before!`,
          `Haha, yes! That is so true. 🌟`,
        ];
        responseText = genericResponses[Math.floor(Math.random() * genericResponses.length)];
      }

      const partnerMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: partnerId,
        text: responseText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessages((prev) => [...prev, partnerMsg]);
      setConversations((prev) => ({
        ...prev,
        [partnerId]: [...(prev[partnerId] || []), partnerMsg],
      }));

      // Also record partner's reply in PostgreSQL
      fetchFromBackend('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          receiverUid: 'user',
          text: partnerMsg.text,
          timeString: partnerMsg.time,
        }),
      }).catch((e) => console.warn('Failed to save partner msg to PostgreSQL:', e));
    }, 1500);
  };

  const handleSendImageMessage = (base64Image: string) => {
    const partnerId = selectedChatPartner ? selectedChatPartner.id : 'elena';

    if (!isMutualFollower(partnerId)) {
      showToast("You must mutually match with this user to send a message!", "error");
      return;
    }

    const newMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: '',
      image: base64Image,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setConversations((prev) => ({
      ...prev,
      [partnerId]: [...(prev[partnerId] || []), newMsg],
    }));

    showToast("📸 Photo sent!", "success");

    // Save user image message to PostgreSQL database
    fetchFromBackend('/api/messages', {
      method: 'POST',
      body: JSON.stringify({
        receiverUid: partnerId,
        text: '',
        image: base64Image,
        timeString: newMsg.time,
      }),
    }).catch((e) => console.warn('Failed to save user image msg to PostgreSQL:', e));
  };

  const handleChatCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 600;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          handleSendImageMessage(compressedBase64);
        } else {
          handleSendImageMessage(base64);
        }
      };
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Onboarding interests selection toggle
  const handleToggleInterest = (interestName: string) => {
    if (onboardingInterests.includes(interestName)) {
      setOnboardingInterests((prev) => prev.filter((i) => i !== interestName));
    } else {
      setOnboardingInterests((prev) => [...prev, interestName]);
    }
  };

  // Spark accept/decline action simulation
  const handleSparkAction = (id: string, action: 'accept' | 'decline') => {
    setSparksList((prev) =>
      prev.map((spark) => {
        if (spark.id === id) {
          return { ...spark, status: action === 'accept' ? 'accepted' : 'declined' };
        }
        return spark;
      })
    );
  };

  const toggleFollowUser = (personId: string) => {
    const following = userProfile.following || [];
    const isFollowing = following.includes(personId);
    const updatedFollowing = isFollowing
      ? following.filter((id) => id !== personId)
      : [...following, personId];

    const updatedProfile = { ...userProfile, following: updatedFollowing };
    setUserProfile(updatedProfile);
    saveProfileToFirestore(updatedProfile);

    // Unlocking mutual follow state immediately for offline responsiveness
    setMockFollowBacks((prev) => ({ ...prev, [personId]: !isFollowing }));

    if (!isFollowing) {
      // Create a nice mutual connection notification from this user
      const partner = AVAILABLE_PEOPLE.find((p) => p.id === personId) || {
        id: personId,
        name: personId.charAt(0).toUpperCase() + personId.slice(1),
        photo: IMAGES.coupleBackground,
        username: personId,
      };

      const newNotif: AppNotification = {
        id: `notif_${Date.now()}_${personId}`,
        type: 'follow',
        title: 'New Connection! 💖',
        message: `${partner.name} (@${partner.username || personId}) followed you back! You can now start messaging them.`,
        senderId: personId,
        senderName: partner.name,
        senderPhoto: partner.photo,
        senderUsername: partner.username || personId,
        read: false,
        createdAt: new Date().toISOString(),
        canFollowBack: false
      };
      setNotifications((prev) => [newNotif, ...prev]);
    }

    // Save swipe and match to PostgreSQL
    const action = isFollowing ? 'pass' : 'like';
    fetchFromBackend('/api/swipes', {
      method: 'POST',
      body: JSON.stringify({
        receiverUid: personId,
        action,
      }),
    })
    .then((res) => {
      if (res.ok) return res.json();
      throw new Error('Failed to record swipe in PostgreSQL');
    })
    .then((data) => {
      if (data.isMatch) {
        setMockFollowBacks((prev) => ({ ...prev, [personId]: true }));
      }
    })
    .catch((err) => console.warn('PostgreSQL swipe recording failed:', err));
  };

  const handleSwipe = (direction: 'like' | 'dislike' | 'superlike') => {
    if (isGuest) {
      setGuestWarningModal('like');
      return;
    }
    
    const activePerson = discoverPeople[activeDiscoverIndex % discoverPeople.length] || AVAILABLE_PEOPLE[0];
    
    if (direction === 'like' || direction === 'superlike') {
      // Follow the user
      toggleFollowUser(activePerson.id);
      navigateTo('spark_match');
    } else {
      // Go to next person
      setActiveDiscoverIndex((prev) => (prev + 1) % discoverPeople.length);
    }
  };

  const isMutualFollower = (partnerId: string) => {
    const following = userProfile.following || [];
    return following.includes(partnerId);
  };

  // Screen navigator helper
  const navigateTo = (screen: Screen) => {
    if (isGuest) {
      if (['edit_profile', 'onboarding_basics', 'onboarding_interests', 'onboarding_photos'].includes(screen)) {
        setGuestWarningModal('profile');
        return;
      }
      if (screen === 'spark_match') {
        setGuestWarningModal('like');
        return;
      }
      if (screen === 'chat') {
        setGuestWarningModal('message');
        return;
      }
    }
    setCurrentScreen(screen);
    localStorage.setItem('aura_current_screen', screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Log tracking event to PostgreSQL
    trackUserAction('page_view', screen);
  };

  // Fetch tracking logs from PostgreSQL database when entering Edit Profile
  useEffect(() => {
    if (currentScreen === 'edit_profile') {
      setLoadingTracking(true);
      fetchFromBackend('/api/tracking/history')
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Failed to fetch user tracking records');
        })
        .then((data) => {
          setTrackingLogs(data || []);
          setLoadingTracking(false);
        })
        .catch((err) => {
          console.warn('PostgreSQL tracking history load failed:', err);
          setLoadingTracking(false);
        });
    }
  }, [currentScreen]);

  return (
    <div className="min-h-screen bg-[#f1f5f9] text-[#111d23] font-sans selection:bg-[#ffb2be] selection:text-[#400014] md:py-8 flex flex-col items-center justify-center">
      {/* Side Screen Switcher (Visible only on Desktop Viewports) */}
      <ScreenSelector
        currentScreen={currentScreen}
        onSelectScreen={(screen) => navigateTo(screen)}
        userRegistered={userRegistered}
      />

      {/* Main Responsive Phone Frame Mockup */}
      <div className="relative w-full max-w-[430px] min-h-[844px] md:h-[880px] md:rounded-[40px] md:border-8 md:border-[#1e293b] md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] bg-[#fdf8f9] overflow-hidden flex flex-col">
        {/* Hidden File Input for Real Photo Upload */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          style={{ display: 'none' }}
        />



        {/* Dynamic Content Window */}
        <div className="flex-1 flex flex-col overflow-y-auto scrollbar-hide relative pb-10">
          {/* Custom Sleek Toast Notifications */}
          {toastMessage && (
            <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-xs font-bold transition-all animate-bounce max-w-[320px] text-center border ${
              toastMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              toastMessage.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
              toastMessage.type === 'spark' ? 'bg-gradient-to-r from-amber-100 to-rose-100 border-rose-200 text-[#b80049]' :
              'bg-[#e3f0f8] border-primary-fixed text-[#111d23]'
            }`}>
              {toastMessage.type === 'success' && <span className="material-symbols-outlined text-sm">check_circle</span>}
              {toastMessage.type === 'error' && <span className="material-symbols-outlined text-sm">error</span>}
              {toastMessage.type === 'spark' && <span className="material-symbols-outlined text-sm animate-pulse">auto_awesome</span>}
              <span>{toastMessage.text}</span>
            </div>
          )}
          {/* ==================== 1. SCREEN: WELCOME / SPLASH ==================== */}
          {currentScreen === 'welcome' && (
            <div className="absolute inset-0 flex flex-col justify-between py-12 px-6 z-10 animate-fade-in">
              {/* Background Hero Image */}
              <div className="absolute inset-0 z-0">
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-[15s] scale-105"
                  style={{ backgroundImage: `url(${IMAGES.coupleBackground})` }}
                ></div>
                <div className="absolute inset-0 bg-vignette"></div>
              </div>

              {/* Logo Section */}
              <div className="relative z-10 flex flex-col items-center mt-12 animate-float">
                <div className="w-28 h-28 rounded-3xl overflow-hidden shadow-2xl bg-white/90 p-4 flex items-center justify-center">
                  <img alt="Aura Logo" className="w-full h-full object-contain" src={IMAGES.auraLogo} />
                </div>
                <h1 className="mt-4 font-title-md text-[32px] tracking-[0.25em] text-white font-bold drop-shadow-md">
                  AURA
                </h1>
                <p className="text-[11px] tracking-[0.4em] text-white/70 uppercase">Find Your Spark</p>
              </div>

              {/* Action Controls */}
              <div className="relative z-10 w-full flex flex-col items-center space-y-5">
                <div className="text-center space-y-2 mb-2">
                  <h2 className="font-title-md text-2xl text-white drop-shadow-lg leading-tight font-extrabold">
                    Find your spark.
                  </h2>
                  <p className="text-xs text-white/90 max-w-[280px] mx-auto drop-shadow-sm leading-relaxed">
                    The premium dating experience for those seeking meaningful connections.
                  </p>
                </div>

                <button
                  onClick={() => navigateTo('signin')}
                  className="w-full bg-primary hover:bg-[#e2165f] text-white font-title-md py-4.5 rounded-2xl transition-all duration-300 transform btn-glow active:scale-95 font-semibold text-center"
                  id="welcome-get-started-btn"
                >
                  Get Started
                </button>

                <button
                  onClick={() => navigateTo('signin')}
                  className="text-xs text-white font-medium hover:text-[#ffb2be] transition-colors duration-200 underline underline-offset-4 decoration-white/40"
                  id="welcome-login-btn"
                >
                  Log In
                </button>

                <p className="text-[10px] text-white/60 text-center px-4 leading-normal">
                  By joining, you agree to our Terms of Service and Privacy Policy.
                </p>
              </div>
            </div>
          )}

          {/* ==================== 2. SCREEN: SIGN IN ==================== */}
          {currentScreen === 'signin' && (
            <div className="absolute inset-0 flex flex-col justify-between py-12 px-6 z-10 animate-fade-in bg-cover bg-center overflow-y-auto scrollbar-hide" style={{ backgroundImage: `url(${IMAGES.coupleCafeBg})` }}>
              <div className="absolute inset-0 bg-vignette opacity-80 z-0"></div>

              {/* Top/Logo */}
              <header className="relative z-10 w-full flex flex-col items-center pt-4">
                <div className="w-16 h-16 mb-2 drop-shadow-xl bg-white/20 backdrop-blur rounded-2xl p-2 flex items-center justify-center">
                  <img alt="Aura Logo" className="w-full h-full object-contain" src={IMAGES.auraLogo} />
                </div>
                <h1 className="font-title-md text-2xl tracking-[0.2em] text-primary font-extrabold uppercase">
                  Aura
                </h1>
              </header>

              {/* Message Section */}
              <section className="relative z-10 w-full text-center my-4">
                <h2 className="font-title-md text-2xl text-white font-bold mb-2">
                  Find meaningful connections
                </h2>
                <p className="text-sm text-white/80 max-w-[280px] mx-auto leading-relaxed">
                  {emailMode === 'login' ? 'Log in with your email' : emailMode === 'signup' ? 'Create a new account' : 'Join a community of individuals seeking depth and genuine sparks.'}
                </p>
              </section>

              {/* Actions Section */}
              <section className="relative z-10 w-full space-y-4">
                <div className="glass-container rounded-3xl p-5 flex flex-col gap-3">
                  
                  {/* Error Notification */}
                  {authError && (
                    <div className="flex flex-col gap-2">
                      <div className="bg-red-500/20 text-red-100 text-xs px-3 py-2.5 rounded-xl text-center border border-red-500/30">
                        {authError}
                      </div>
                      <button
                        type="button"
                        onClick={handleAuthBypass}
                        className="w-full py-2.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border border-amber-500/40 rounded-xl text-center text-xs font-bold transition-all active:scale-95"
                      >
                        ⚡ Bypass Auth & Auto-Login Now
                      </button>
                    </div>
                  )}

                   {emailMode === 'options' && (
                    <>
                      <button
                        onClick={handleGoogleSignIn}
                        disabled={authLoading}
                        className="w-full h-13 bg-white hover:bg-slate-50 text-[#111d23] font-medium rounded-xl flex items-center justify-center gap-3 transition-all shadow-sm border border-outline/10 active:scale-98 text-sm disabled:opacity-50 cursor-pointer"
                        id="signin-google-btn"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                        </svg>
                        <span>Continue with Google</span>
                      </button>

                      <button
                        onClick={() => {
                          setAuthError('');
                          setEmailMode('login');
                        }}
                        className="w-full h-13 bg-primary hover:bg-[#e2165f] text-white font-medium rounded-xl flex items-center justify-center gap-3 transition-all glow-button active:scale-98 text-sm cursor-pointer"
                        id="signin-email-btn"
                      >
                        <span className="material-symbols-outlined text-[20px]">mail</span>
                        <span>Continue with Email</span>
                      </button>

                      <div className="flex flex-col gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setUserProfile({
                              ...INITIAL_USER,
                              username: 'guest',
                              name: 'Guest Explorer',
                              following: [],
                              followers: []
                            });
                            setUserRegistered(false);
                            setIsGuest(true);
                            setAuthError('');
                            navigateTo('discover');
                          }}
                          className="w-full h-11 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98 text-xs cursor-pointer border border-white/20"
                          id="signin-guest-btn"
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span>
                          <span>Explore as Guest</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleAuthBypass}
                          className="w-full h-11 bg-amber-500/80 hover:bg-amber-600/90 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98 text-xs cursor-pointer shadow-md"
                          id="signin-bypass-btn"
                        >
                          <span className="material-symbols-outlined text-sm">bolt</span>
                          <span>Auto-Login (Bypass)</span>
                        </button>
                      </div>
                    </>
                  )}

                  {(emailMode === 'login' || emailMode === 'signup') && (
                    <form onSubmit={emailMode === 'login' ? handleEmailSignIn : handleEmailSignUp} className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-white tracking-wider">EMAIL ADDRESS</label>
                        <input
                          type="email"
                          required
                          placeholder="your.email@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full h-11 bg-white/15 border border-white/20 rounded-xl px-4 text-xs text-white placeholder-white/40 focus:bg-white/20 focus:border-white/50 outline-none transition-all"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-white tracking-wider">PASSWORD</label>
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full h-11 bg-white/15 border border-white/20 rounded-xl px-4 text-xs text-white placeholder-white/40 focus:bg-white/20 focus:border-white/50 outline-none transition-all"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full h-12 mt-2 bg-primary hover:bg-[#e2165f] text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all glow-button active:scale-98 text-xs font-bold disabled:opacity-50 cursor-pointer"
                      >
                        {authLoading ? (
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        ) : emailMode === 'login' ? (
                          'LOG IN'
                        ) : (
                          'SIGN UP'
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEmailMode('options');
                          setEmail('');
                          setPassword('');
                          setAuthError('');
                        }}
                        className="w-full py-1 text-xs text-white/60 hover:text-white transition-colors text-center cursor-pointer"
                      >
                        Back
                      </button>

                      <div className="text-center text-xs text-white/80 mt-2">
                        {emailMode === 'login' ? (
                          <span>
                            Don't have an account?{' '}
                            <button
                              type="button"
                              onClick={() => {
                                setAuthError('');
                                setEmailMode('signup');
                              }}
                              className="text-primary font-bold hover:underline"
                            >
                              Sign Up
                            </button>
                          </span>
                        ) : (
                          <span>
                            Already have an account?{' '}
                            <button
                              type="button"
                              onClick={() => {
                                setAuthError('');
                                setEmailMode('login');
                              }}
                              className="text-primary font-bold hover:underline"
                            >
                              Log In
                            </button>
                          </span>
                        )}
                      </div>
                    </form>
                  )}
                </div>

                <footer className="w-full flex flex-col items-center gap-2 pt-2">
                  <p className="text-[10px] text-white/60 text-center max-w-[280px]">
                    By signing up, you agree to our <a className="underline hover:text-primary decoration-white/30" href="#">Terms</a> and <a className="underline hover:text-primary decoration-white/30" href="#">Privacy Policy</a>
                  </p>
                </footer>
              </section>
            </div>
          )}

          {/* ==================== 3. SCREEN: ONBOARDING BASICS ==================== */}
          {currentScreen === 'onboarding_basics' && (
            <div className="px-6 py-4 space-y-6">
              {/* Header */}
              <div className="flex justify-between items-center h-10">
                <button onClick={() => navigateTo('signin')} className="text-slate-600 hover:text-primary active:scale-95">
                  <span className="material-symbols-outlined">close</span>
                </button>
                <h1 className="font-title-md text-xl text-primary tracking-widest font-extrabold">AURA</h1>
                <div className="w-6"></div>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between items-center mb-1.5 text-xs font-semibold text-primary">
                  <span>Step 1 of 3</span>
                  <span>33%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full progress-glow" style={{ width: '33%' }}></div>
                </div>
              </div>

              {/* Hero Text */}
              <div>
                <h2 className="font-title-md text-2xl text-on-surface font-extrabold mb-1">The basics</h2>
                <p className="text-xs text-secondary">Tell us a bit about yourself to help us find your perfect match.</p>
              </div>

              {/* Form fields */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold tracking-widest text-[#5b3f43] block">FIRST NAME</label>
                  <input
                    type="text"
                    value={onboardingName}
                    onChange={(e) => setOnboardingName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold tracking-widest text-[#5b3f43] block">USERNAME</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">@</span>
                    <input
                      type="text"
                      value={onboardingUsername}
                      onChange={(e) => setOnboardingUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                      placeholder="unique_username"
                      className="w-full h-12 bg-white border border-slate-200 rounded-xl pl-8 pr-4 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all font-mono text-on-surface"
                    />
                  </div>
                  <p className="text-[9px] text-slate-400">This unique username lets friends find and follow you to chat.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold tracking-widest text-[#5b3f43] block">DATE OF BIRTH</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={2}
                      placeholder="DD"
                      value={onboardingDob.dd}
                      onChange={(e) => setOnboardingDob({ ...onboardingDob, dd: e.target.value })}
                      className="w-16 h-12 bg-white border border-slate-200 rounded-xl text-center text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                    />
                    <input
                      type="text"
                      maxLength={2}
                      placeholder="MM"
                      value={onboardingDob.mm}
                      onChange={(e) => setOnboardingDob({ ...onboardingDob, mm: e.target.value })}
                      className="w-16 h-12 bg-white border border-slate-200 rounded-xl text-center text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                    />
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="YYYY"
                      value={onboardingDob.yyyy}
                      onChange={(e) => setOnboardingDob({ ...onboardingDob, yyyy: e.target.value })}
                      className="flex-1 h-12 bg-white border border-slate-200 rounded-xl text-center text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                    />
                  </div>
                  <p className="text-[10px] text-secondary/70">Your age will be public.</p>
                </div>

                {/* Gender */}
                <div className="space-y-2 pt-2">
                  <label className="text-[10px] font-bold tracking-widest text-[#5b3f43] block">GENDER</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Woman', 'Man'].map((gender) => (
                      <button
                        key={gender}
                        onClick={() => setOnboardingGender(gender)}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-xs ${
                          onboardingGender === gender
                            ? 'bg-primary text-white border-primary shadow-md'
                            : 'bg-white text-on-surface border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span>{gender}</span>
                        <span className={`material-symbols-outlined text-[16px] ${onboardingGender === gender ? 'text-white' : 'text-slate-400'}`}>
                          {gender === 'Woman' ? 'female' : 'male'}
                        </span>
                      </button>
                    ))}
                    <button
                      onClick={() => setOnboardingGender('Non-binary')}
                      className={`col-span-2 flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-xs ${
                        onboardingGender === 'Non-binary'
                          ? 'bg-primary text-white border-primary shadow-md'
                          : 'bg-white text-on-surface border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>Non-binary</span>
                      <span className={`material-symbols-outlined text-[16px] ${onboardingGender === 'Non-binary' ? 'text-white' : 'text-slate-400'}`}>
                        transgender
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Error Display */}
              {onboardingError && (
                <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-xs font-semibold text-center animate-shake">
                  ⚠ {onboardingError}
                </div>
              )}

              {/* Quote Decorative Element */}
              <div className="relative overflow-hidden rounded-2xl h-24 bg-[#f4dce4]/40 flex items-center justify-center p-4 text-center mt-6">
                <p className="font-title-md text-xs text-[#524249] leading-tight italic">
                  "Love is not something you find. Love is something that finds you."
                </p>
              </div>

              {/* Bottom Navigation */}
              <nav className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-md flex justify-between items-center px-6 py-4 h-20 shadow-[0_-4px_20px_rgba(38,50,56,0.04)] z-50">
                <button
                  onClick={() => navigateTo('signin')}
                  className="flex flex-col items-center justify-center text-slate-500 hover:text-primary active:scale-95"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                  <span className="text-[10px] font-bold">Back</span>
                </button>
                <button
                  onClick={() => {
                    const dd = parseInt(onboardingDob.dd, 10);
                    const mm = parseInt(onboardingDob.mm, 10);
                    const yyyy = parseInt(onboardingDob.yyyy, 10);

                    if (!onboardingDob.dd || !onboardingDob.mm || !onboardingDob.yyyy) {
                      setOnboardingError('Please enter your full Date of Birth.');
                      return;
                    }

                    if (isNaN(dd) || isNaN(mm) || isNaN(yyyy) || dd < 1 || dd > 31 || mm < 1 || mm > 12 || yyyy < 1920 || yyyy > new Date().getFullYear()) {
                      setOnboardingError('Please enter a valid Date of Birth.');
                      return;
                    }

                    const dobDate = new Date(yyyy, mm - 1, dd);
                    const today = new Date();
                    let computedAge = today.getFullYear() - dobDate.getFullYear();
                    const monthDiff = today.getMonth() - dobDate.getMonth();
                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
                      computedAge--;
                    }

                    if (computedAge < 18) {
                      setOnboardingError('You must be at least 18 years old to join Aura.');
                      return;
                    }

                    setOnboardingError('');

                    // Update user profile properties nicely
                    setUserProfile((prev) => ({
                      ...prev,
                      name: onboardingName || prev.name,
                      username: onboardingUsername.toLowerCase().trim() || onboardingName.toLowerCase().replace(/\s+/g, '_') || prev.username,
                      gender: onboardingGender || prev.gender,
                      dob: onboardingDob,
                      age: computedAge,
                    }));
                    navigateTo('onboarding_interests');
                  }}
                  disabled={!onboardingName || !onboardingUsername || !onboardingGender}
                  className="bg-primary text-white rounded-xl px-6 py-2.5 shadow-lg flex items-center gap-1 hover:brightness-110 active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none text-xs font-semibold"
                >
                  <span>Continue</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </nav>
            </div>
          )}

          {/* ==================== 4. SCREEN: ONBOARDING INTERESTS ==================== */}
          {currentScreen === 'onboarding_interests' && (
            <div className="px-6 py-4 space-y-6">
              {/* Header */}
              <div className="flex justify-between items-center h-10">
                <button onClick={() => navigateTo('onboarding_basics')} className="text-slate-600 hover:text-primary">
                  <span className="material-symbols-outlined">close</span>
                </button>
                <h1 className="font-title-md text-xl text-primary tracking-widest font-extrabold">AURA</h1>
                <div className="w-6"></div>
              </div>

              {/* Progress */}
              <div>
                <div className="flex justify-between items-center text-xs font-semibold text-primary mb-1">
                  <span>Step 2 of 3</span>
                  <span>66%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: '66%' }}></div>
                </div>
              </div>

              {/* Hero */}
              <div>
                <h2 className="font-title-md text-2xl text-on-surface font-extrabold mb-1">What sparks your aura?</h2>
                <p className="text-xs text-secondary">
                  Select at least 5 interests to help us find meaningful connections. We use these to curate your daily matches.
                </p>
              </div>

              {/* Interests Grid */}
              <div className="flex flex-wrap gap-2 pt-2">
                {INTERESTS_OPTIONS.map((interest) => {
                  const isSelected = onboardingInterests.includes(interest.name);
                  return (
                    <button
                      key={interest.name}
                      onClick={() => handleToggleInterest(interest.name)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all ${
                        isSelected
                          ? 'bg-primary text-white border-primary shadow-md'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-[14px] ${isSelected ? 'text-white' : 'text-primary'}`}>
                        {interest.icon}
                      </span>
                      <span>{interest.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Curation Logic Card */}
              <div className="rounded-2xl p-4 bg-secondary-container/40 flex flex-col items-center text-center mt-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <span className="material-symbols-outlined text-primary text-lg">auto_awesome</span>
                </div>
                <h3 className="font-title-md text-[13px] text-on-secondary-container font-bold mb-0.5">Curation Logic</h3>
                <p className="text-[10px] text-secondary-container-variant max-w-[240px] leading-relaxed">
                  Our algorithm pairs you with individuals who share your aesthetic and intellectual pursuits.
                </p>
              </div>

              {/* Navigation */}
              <nav className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-md flex justify-between items-center px-6 py-4 h-20 shadow-[0_-4px_20px_rgba(38,50,56,0.04)] z-50">
                <button
                  onClick={() => navigateTo('onboarding_basics')}
                  className="flex flex-col items-center justify-center text-slate-500 hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                  <span className="text-[10px] font-bold">Back</span>
                </button>
                <button
                  onClick={() => {
                    setUserProfile((prev) => ({
                      ...prev,
                      interests: onboardingInterests,
                    }));
                    navigateTo('onboarding_photos');
                  }}
                  disabled={onboardingInterests.length < 3}
                  className="bg-primary text-white rounded-xl px-6 py-2.5 shadow-lg flex items-center gap-1 hover:brightness-110 active:scale-98 disabled:opacity-50 disabled:pointer-events-none text-xs font-semibold"
                >
                  <span>Continue</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </nav>
            </div>
          )}

          {/* ==================== 5. SCREEN: ONBOARDING PHOTOS ==================== */}
          {currentScreen === 'onboarding_photos' && (
            <div className="px-6 py-4 space-y-6">
              {/* Header */}
              <div className="flex justify-between items-center h-10">
                <button onClick={() => navigateTo('onboarding_interests')} className="text-slate-600 hover:text-primary">
                  <span className="material-symbols-outlined">close</span>
                </button>
                <h1 className="font-title-md text-xl text-primary tracking-widest font-extrabold">AURA</h1>
                <div className="w-6"></div>
              </div>

              {/* Progress */}
              <div>
                <div className="h-1 bg-slate-200 rounded-full overflow-hidden mb-1">
                  <div className="bg-primary h-full w-full"></div>
                </div>
              </div>

              {/* Headline */}
              <div>
                <h2 className="font-title-md text-xl text-on-surface font-extrabold mb-1">Show your best self</h2>
                <p className="text-xs text-secondary leading-relaxed">
                  Upload at least 2 photos to find more meaningful connections. Your primary photo is your first impression.
                </p>
              </div>

              {/* Photo Bento Grid */}
              <div className="grid grid-cols-6 grid-rows-3 gap-3 h-[380px] pt-1">
                {/* Large primary slot */}
                <div className="col-span-4 row-span-2 relative overflow-hidden rounded-2xl bg-slate-100 group shadow-sm">
                  <div className="absolute inset-0 z-10 bg-gradient-to-t from-slate-900/40 to-transparent pointer-events-none"></div>
                  <img
                    alt="Primary user"
                    className="w-full h-full object-cover"
                    src={profilePicUrls[0] || IMAGES.primaryOnboardingPic}
                  />
                  <div className="absolute bottom-3 left-3 z-20">
                    <span className="bg-primary text-white text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full">
                      Primary
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setPhotoSlotToEdit(0);
                      fileInputRef.current?.click();
                    }}
                    className="absolute top-3 right-3 z-20 w-8 h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-primary shadow-sm hover:scale-105 active:scale-90 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                </div>

                {/* Placeholders */}
                {[1, 2, 3, 4, 5].map((idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setPhotoSlotToEdit(idx);
                      fileInputRef.current?.click();
                    }}
                    className="col-span-2 row-span-1 rounded-2xl bg-slate-50 border-2 border-dashed border-[#e4bdc2] flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100/50 hover:border-primary/50 transition-colors overflow-hidden relative"
                  >
                    {profilePicUrls[idx] ? (
                      <>
                        <img src={profilePicUrls[idx]} className="w-full h-full object-cover rounded-2xl" alt="upload preview" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const updated = [...profilePicUrls];
                            updated.splice(idx, 1);
                            setProfilePicUrls(updated);
                          }}
                          className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white text-[10px] hover:bg-black cursor-pointer"
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <span className="material-symbols-outlined text-primary text-[20px]">add_a_photo</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Pro Tip section */}
              <div className="p-3 bg-[#f4dce4] rounded-xl flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-[18px] mt-0.5">lightbulb</span>
                <div>
                  <h4 className="text-xs text-primary font-bold">Pro Tip</h4>
                  <p className="text-[10px] text-[#524249] leading-relaxed">
                    Profiles with clear, smiling outdoor photos get 3x more interest on Aura. Avoid group photos for your primary slot.
                  </p>
                </div>
              </div>

              {/* Navigation */}
              <nav className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-md flex justify-between items-center px-6 py-4 h-20 shadow-[0_-4px_20px_rgba(38,50,56,0.04)] z-50">
                <button
                  onClick={() => navigateTo('onboarding_interests')}
                  className="flex flex-col items-center justify-center text-slate-500 hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                  <span className="text-[10px] font-bold">Back</span>
                </button>
                <button
                  onClick={() => {
                    const finalProfile = {
                      ...userProfile,
                      photos: profilePicUrls,
                    };
                    setUserProfile(finalProfile);
                    saveProfileToFirestore(finalProfile);
                    navigateTo('location_access');
                  }}
                  className="bg-primary text-white rounded-xl px-6 py-2.5 shadow-lg flex items-center gap-1 hover:brightness-110 active:scale-98 text-xs font-semibold cursor-pointer"
                >
                  <span>Continue</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </nav>
            </div>
          )}

          {/* ==================== 6. SCREEN: LOCATION ACCESS ==================== */}
          {currentScreen === 'location_access' && (
            <div className="absolute inset-0 flex flex-col justify-between py-12 px-6 bg-white animate-fade-in">
              {/* Header */}
              <div className="flex justify-between items-center w-full">
                <button onClick={() => navigateTo('discover')} className="text-primary active:scale-95">
                  <span className="material-symbols-outlined">close</span>
                </button>
                <h1 className="font-title-md text-xl text-primary font-bold tracking-widest uppercase">AURA</h1>
                <div className="w-6"></div>
              </div>

              {/* Illustration Map background */}
              <div className="relative w-full h-56 flex items-center justify-center overflow-hidden rounded-3xl mt-2 bg-cover bg-center" style={{ backgroundImage: `url(${IMAGES.mapBackground})` }}>
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/10 to-transparent"></div>
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center shadow-2xl animate-float">
                    <span className="material-symbols-outlined text-4xl text-primary fill-icon">favorite</span>
                  </div>
                  <div className="absolute w-28 h-28 bg-primary/10 rounded-full blur-2xl animate-pulse"></div>
                </div>
              </div>

              {/* Text */}
              <div className="text-center space-y-3 mt-4">
                <h2 className="font-title-md text-2xl text-on-background font-extrabold">Find matches near you</h2>
                <p className="text-xs text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                  Discover meaningful connections just around the corner. Enabling location helps us curate the most relevant profiles in your immediate vicinity.
                </p>
              </div>

              {/* Info Card */}
              <div className="w-full p-4 bg-[#e9f6fd] rounded-2xl shadow-sm flex items-start gap-3">
                <div className="bg-primary/10 p-1.5 rounded-lg">
                  <span className="material-symbols-outlined text-primary text-sm">explore</span>
                </div>
                <div className="flex flex-col text-left space-y-0.5">
                  <p className="text-xs text-[#111d23] font-bold">Smart Proximity</p>
                  <p className="text-[10px] text-slate-500">We prioritize quality over distance, but staying local makes meeting up effortless.</p>
                </div>
              </div>

              {/* Privacy block */}
              <div className="flex items-center justify-center gap-1.5 opacity-70 text-center">
                <span className="material-symbols-outlined text-xs">lock</span>
                <span className="text-[9px] text-slate-500">Privacy Note: Your exact location is never shared with anyone.</span>
              </div>

              {/* Action trigger */}
              <div className="w-full flex flex-col gap-2">
                <button
                  onClick={() => {
                    const finalProfile = { ...userProfile, location: 'San Francisco, CA' };
                    setUserProfile(finalProfile);
                    saveProfileToFirestore(finalProfile);
                    navigateTo('discover');
                  }}
                  className="w-full bg-primary text-white font-title-md text-sm py-3.5 rounded-2xl glow-shadow hover:brightness-110 active:scale-[0.98] transition-all font-semibold cursor-pointer"
                >
                  Enable Location
                </button>
                <button
                  onClick={() => {
                    saveProfileToFirestore();
                    navigateTo('discover');
                  }}
                  className="w-full text-slate-500 hover:text-primary font-medium text-xs py-2 cursor-pointer"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          )}

          {/* ==================== 7. SCREEN: DISCOVER (SWIPE) ==================== */}
          {currentScreen === 'discover' && (() => {
            const activePerson = discoverPeople[activeDiscoverIndex % discoverPeople.length] || AVAILABLE_PEOPLE[0];
            return (
              <div className="px-6 pt-4 flex flex-col animate-fade-in h-full">
                {/* Header */}
                <header className="flex items-center justify-between h-12 w-full mb-2">
                  <button onClick={() => navigateTo('stories')} className="text-primary active:scale-90">
                    <span className="material-symbols-outlined">menu</span>
                  </button>
                  <h1 className="font-title-md text-xl tracking-[0.25em] text-primary font-bold">AURA</h1>
                  <button onClick={() => navigateTo('onboarding_interests')} className="text-primary active:scale-90">
                    <span className="material-symbols-outlined">tune</span>
                  </button>
                </header>

                {/* Main Swipe Profile Card */}
                <div
                  onClick={() => {
                    setSelectedDiscoverPerson(activePerson);
                    navigateTo('profile_details');
                  }}
                  className="relative w-full aspect-[3/4] rounded-3xl overflow-hidden shadow-xl group cursor-pointer border border-[#f3e5f5]"
                >
                  <div className="absolute inset-0 bg-slate-100">
                    <img src={activePerson.photo} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={`${activePerson.name} profile card`} />
                    <div className="vignette-bottom absolute inset-0"></div>
                  </div>

                  {/* Card profile overlay content */}
                  <div className="absolute bottom-0 left-0 w-full p-5 text-white z-10 space-y-2.5">
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 text-left">
                          <h2 className="font-title-md text-2xl text-white font-extrabold leading-none">{activePerson.name}, {activePerson.age || 25}</h2>
                          <span className="material-symbols-outlined text-[18px] text-white fill-icon">verified</span>
                        </div>
                        <p className="text-xs text-white/90 font-medium text-left">@{activePerson.username || activePerson.id}</p>
                      </div>

                      <div className="flex items-center gap-0.5 bg-white/25 backdrop-blur-md px-2.5 py-1 rounded-full text-white text-[10px] font-semibold">
                        <span className="material-symbols-outlined text-[13px]">location_on</span>
                        <span>2 miles</span>
                      </div>
                    </div>

                    {/* Bio Summary */}
                    <p className="text-[11px] text-slate-100/90 font-normal leading-normal text-left line-clamp-2">
                      {activePerson.bio || 'New member of Aura community'}
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-center gap-6 mt-4 w-full">
                  <button
                    onClick={() => handleSwipe('dislike')}
                    className="w-12 h-12 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:text-primary hover:bg-slate-50 transition-all duration-200 active:scale-90 shadow-sm cursor-pointer"
                    title="Dislike"
                  >
                    <span className="material-symbols-outlined text-[24px]">close</span>
                  </button>

                  <button
                    onClick={() => handleSwipe('like')}
                    className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white action-glow-heart hover:scale-105 active:scale-90 transition-all duration-300 cursor-pointer"
                    title="Like"
                  >
                    <span className="material-symbols-outlined text-[32px] fill-icon">favorite</span>
                  </button>

                  <button
                    onClick={() => handleSwipe('superlike')}
                    className="w-12 h-12 rounded-full border border-yellow-300 bg-white flex items-center justify-center text-yellow-600 hover:bg-yellow-50 transition-all duration-200 active:scale-90 shadow-sm cursor-pointer"
                    title="Super Like"
                  >
                    <span className="material-symbols-outlined text-[24px] fill-icon">star</span>
                  </button>
                </div>
              </div>
            );
          })()}

          {/* ==================== 8. SCREEN: PROFILE DETAILS ==================== */}
          {currentScreen === 'profile_details' && (() => {
            const targetUser = selectedDiscoverPerson || discoverPeople[activeDiscoverIndex % discoverPeople.length] || AVAILABLE_PEOPLE[0];
            return (
              <div className="animate-fade-in relative pb-24 text-left">
                {/* Navigation Back */}
                <header className="fixed top-0 w-full max-w-[430px] z-[100] flex items-center justify-between px-4 h-16 bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100">
                  <button onClick={() => navigateTo('discover')} className="text-primary active:scale-90 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                    <span className="text-xs font-bold uppercase tracking-wider">Back</span>
                  </button>
                  <h1 className="font-title-md text-sm text-[#111d23] font-bold truncate max-w-[150px]">
                    {targetUser.name}'s Profile
                  </h1>
                  <div className="flex items-center gap-2">
                    {/* Share Button */}
                    <button
                      onClick={() => {
                        setProfileShareOpen(true);
                        setTimeout(() => setProfileShareOpen(false), 3000);
                        navigator.clipboard?.writeText(window.location.href);
                      }}
                      className="text-slate-600 hover:text-primary active:scale-90 p-1 flex items-center justify-center rounded-full hover:bg-slate-50"
                      title="Share Profile"
                    >
                      <span className="material-symbols-outlined text-[20px]">share</span>
                    </button>
                    {/* Options Button */}
                    <button
                      onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                      className="text-slate-600 hover:text-primary active:scale-90 p-1 flex items-center justify-center rounded-full hover:bg-slate-50"
                      title="More Options"
                    >
                      <span className="material-symbols-outlined text-[20px]">more_vert</span>
                    </button>
                  </div>
                </header>

                {/* Profile Share Success Toast */}
                {profileShareOpen && (
                  <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] bg-slate-900 text-white px-4 py-2 rounded-full text-[11px] font-bold shadow-lg flex items-center gap-1.5 animate-fade-in">
                    <span className="material-symbols-outlined text-xs text-green-400 fill-icon">check_circle</span>
                    <span>Profile link copied to clipboard!</span>
                  </div>
                )}

                {/* Options Dropdown Menu */}
                {profileMenuOpen && (
                  <div className="absolute right-4 top-16 z-[110] bg-white rounded-2xl shadow-xl border border-slate-100 p-2 w-48 animate-fade-in text-left">
                    <button
                      onClick={() => {
                        const targetUid = targetUser.id;
                        setReportedUserIds((prev) => {
                          const updated = [...prev, targetUid];
                          localStorage.setItem('aura_reported_users', JSON.stringify(updated));
                          return updated;
                        });
                        fetchFromBackend('/api/reports', {
                          method: 'POST',
                          body: JSON.stringify({ receiverUid: targetUid, reason: 'inappropriate content' })
                        })
                        .then(() => {
                          showToast(`Reported @${targetUser.username || targetUser.name || targetUser.id}. We will review their profile.`, "success");
                        })
                        .catch(err => {
                          console.warn('Backend report registration failed, saved locally:', err);
                          showToast(`Reported @${targetUser.username || targetUser.name || targetUser.id}.`, "success");
                        });
                        setProfileMenuOpen(false);
                        navigateTo('discover');
                        setActiveDiscoverIndex((prev) => (prev + 1) % discoverPeople.length);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-xl transition-all font-semibold flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">report</span>
                      <span>Report @{targetUser.username || targetUser.id}</span>
                    </button>
                    <button
                      onClick={() => {
                        const targetUid = targetUser.id;
                        setBlockedUserIds((prev) => {
                          const updated = [...prev, targetUid];
                          localStorage.setItem('aura_blocked_users', JSON.stringify(updated));
                          return updated;
                        });
                        fetchFromBackend('/api/blocks', {
                          method: 'POST',
                          body: JSON.stringify({ receiverUid: targetUid })
                        })
                        .then(() => {
                          showToast(`Blocked @${targetUser.username || targetUser.name || targetUser.id}.`, "success");
                        })
                        .catch(err => {
                          console.warn('Backend block registration failed, saved locally:', err);
                          showToast(`Blocked @${targetUser.username || targetUser.name || targetUser.id}.`, "success");
                        });
                        setProfileMenuOpen(false);
                        navigateTo('discover');
                        setActiveDiscoverIndex((prev) => (prev + 1) % discoverPeople.length);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 rounded-xl transition-all font-semibold flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">block</span>
                      <span>Block User</span>
                    </button>
                    <button
                      onClick={() => {
                        setUserSparks(5);
                        localStorage.setItem('aura_user_sparks', '5');
                        showToast("Sparks successfully reset to 5!", "success");
                        setProfileMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-primary hover:bg-purple-50 rounded-xl transition-all font-semibold flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">refresh</span>
                      <span>Reset Sparks (5)</span>
                    </button>
                  </div>
                )}

                {/* Main Profile Details Content */}
                <div className="space-y-4">
                  {/* Single slideshow layout */}
                  <div className="relative w-full aspect-[4/5] overflow-hidden mt-16 shadow-inner bg-slate-50">
                    <img
                      src={targetUser.photo}
                      className="w-full h-full object-cover"
                      alt={`${targetUser.name} portrait`}
                    />
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent"></div>
                  </div>

                  {/* Bio and Info Sections */}
                  <div className="px-6 py-2 space-y-5">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <h2 className="font-title-md text-2xl text-on-surface font-extrabold leading-none">{targetUser.name}, {targetUser.age || 25}</h2>
                          <span className="material-symbols-outlined text-[20px] text-primary fill-icon">verified</span>
                        </div>
                        <p className="text-xs text-slate-500 font-semibold">@{targetUser.username || targetUser.id}</p>
                      </div>
                      <div className="flex items-center text-slate-500 gap-0.5 text-xs font-bold">
                        <span className="material-symbols-outlined text-[16px] text-primary">location_on</span>
                        <span>{targetUser.location || '2 miles away'}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed font-normal">
                      {targetUser.bio || 'Passionate about connecting with mindful people, sharing daily vibes, and discovering the extra-ordinary.'}
                    </p>

                    {/* About Me card */}
                    <div className="space-y-1.5">
                      <h3 className="font-title-md text-sm text-on-surface font-bold">About Me</h3>
                      <div className="bg-[#fce4ec]/30 p-4 rounded-2xl shadow-sm border border-[#e4bdc2]/20">
                        <p className="text-xs text-slate-700 leading-relaxed font-normal">
                          {targetUser.about || `I believe in staying authentic, sharing sparks, and creating deep connections. If you value deep conversations and a positive aura, let's explore together!`}
                        </p>
                      </div>
                    </div>

                    {/* Interests */}
                    <div className="space-y-1.5">
                      <h3 className="font-title-md text-sm text-on-surface font-bold">Interests</h3>
                      <div className="flex flex-wrap gap-2">
                        {(targetUser.interests || ['Art', 'Travel', 'Hiking', 'Music']).map((tag: string) => (
                          <span key={tag} className="px-3 py-1.5 rounded-full bg-[#F3E5F5] text-[#263238] font-bold text-[10px] tracking-wide uppercase">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Prompts Section */}
                    <div className="space-y-3 pt-2">
                      <h3 className="font-title-md text-sm text-on-surface font-bold">Prompts</h3>
                      <div className="p-4 rounded-2xl border border-slate-100 bg-white/70 shadow-sm space-y-1.5">
                        <span className="text-primary font-bold text-[9px] tracking-wider block uppercase">My perfect Sunday...</span>
                        <p className="font-title-md text-sm text-on-surface leading-tight font-extrabold">
                          Starts with fresh espresso, ends with custom vibes and zero stress.
                        </p>
                      </div>
                      <div className="p-4 rounded-2xl border border-slate-100 bg-white/70 shadow-sm space-y-1.5">
                        <span className="text-primary font-bold text-[9px] tracking-wider block uppercase">We'll get along if...</span>
                        <p className="font-title-md text-sm text-on-surface leading-tight font-extrabold">
                          You prefer handwritten thoughts, authentic vibes, and direct chats.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Floating Action Buttons */}
                  <div className="flex justify-center items-center gap-4 py-4 w-full bg-white/95 sticky bottom-10 z-40 border-t border-slate-100 px-6">
                    <button
                      onClick={() => navigateTo('discover')}
                      className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-slate-500 shadow-md border border-slate-100 active:scale-90 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[24px]">close</span>
                    </button>
                    {(() => {
                      const followingList = userProfile.following || [];
                      const isFollowing = followingList.includes(targetUser.id);
                      return (
                        <button
                          onClick={() => {
                            if (isFollowing) {
                              setSelectedChatPartner(targetUser);
                              navigateTo('chat');
                            } else {
                              toggleFollowUser(targetUser.id);
                              navigateTo('spark_match');
                            }
                          }}
                          className={`w-14 h-14 rounded-full flex items-center justify-center text-white active:scale-90 transition-all cursor-pointer shadow-md ${
                            isFollowing
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110'
                              : 'bg-primary glow-shadow'
                          }`}
                          title={isFollowing ? 'Start Chatting' : 'Like'}
                        >
                          <span className="material-symbols-outlined text-[28px] fill-icon">
                            {isFollowing ? 'chat' : 'favorite'}
                          </span>
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ==================== 9. SCREEN: SPARK MATCH ==================== */}
          {currentScreen === 'spark_match' && (() => {
            const activePerson = discoverPeople[activeDiscoverIndex % discoverPeople.length] || AVAILABLE_PEOPLE[0];
            return (
              <div className="absolute inset-0 flex flex-col justify-between py-12 px-6 z-20 animate-fade-in bg-gradient-to-tr from-[#fce4ec] via-[#f4faff] to-[#ffd9de]">
                {/* Gentle floating sparkles background */}
                <div className="absolute inset-0 opacity-40 overflow-hidden pointer-events-none z-0">
                  <div className="absolute top-[10%] left-[20%] w-2 h-2 bg-primary rounded-full animate-float" style={{ animationDelay: '0s' }}></div>
                  <div className="absolute top-[40%] right-[15%] w-3 h-3 bg-[#ffb2be] rounded-full animate-float" style={{ animationDelay: '2s' }}></div>
                  <div className="absolute bottom-[30%] left-[10%] w-2 h-2 bg-primary-container rounded-full animate-float" style={{ animationDelay: '1s' }}></div>
                </div>

                {/* Reward Celebration Icon */}
                <div className="relative z-10 flex flex-col items-center mt-6 animate-float">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary-container text-white shadow-xl">
                    <span className="material-symbols-outlined text-[28px] fill-icon">auto_awesome</span>
                  </div>
                </div>

                {/* Overlapping Profile Photos */}
                <div className="relative z-10 w-full flex justify-center items-center h-48 my-2">
                  {/* Glow rings */}
                  <div className="absolute w-36 h-36 rounded-full border border-primary/20 animate-slow-pulse"></div>
                  <div className="absolute w-48 h-48 rounded-full border border-slate-500/10 animate-slow-pulse" style={{ animationDelay: '-2s' }}></div>

                  <div className="relative flex items-center">
                    {/* Left profile (user) */}
                    <div className="relative z-20 -mr-4 transform hover:scale-105 transition-all">
                      <div className="w-28 h-28 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-slate-200">
                        <img className="w-full h-full object-cover" src={userProfile.photo || IMAGES.userMatchLeft} alt="User matched portrait" />
                      </div>
                      <div className="absolute bottom-0 right-0 bg-white rounded-full p-1.5 shadow-md">
                        <span className="material-symbols-outlined text-primary text-xs fill-icon">favorite</span>
                      </div>
                    </div>

                    {/* Right profile (activePerson) */}
                    <div className="relative z-10 transform hover:scale-105 transition-all">
                      <div className="w-28 h-28 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-slate-200">
                        <img className="w-full h-full object-cover" src={activePerson.photo} alt={`${activePerson.name} portrait`} />
                      </div>
                      <div className="absolute bottom-0 left-0 bg-white rounded-full p-1.5 shadow-md">
                        <span className="material-symbols-outlined text-primary text-xs fill-icon">favorite</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Typography */}
                <div className="relative z-10 text-center space-y-1">
                  <h1 className="font-title-md text-[40px] text-primary tracking-tight font-extrabold">
                    It's a Spark!
                  </h1>
                  <p className="text-sm text-slate-600 max-w-[240px] mx-auto leading-normal">
                    You and {activePerson.name} have liked each other.
                  </p>
                </div>

                {/* Call to Actions */}
                <div className="relative z-10 w-full space-y-3 flex flex-col items-center">
                  <button
                    onClick={() => {
                      setSelectedChatPartner(activePerson);
                      navigateTo('chat');
                    }}
                    className="group relative w-full h-12 bg-primary text-white font-title-md text-sm rounded-xl shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 font-bold cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    <span>Send a Message</span>
                  </button>

                  <button
                    onClick={() => navigateTo('discover')}
                    className="w-full h-12 bg-white/70 border border-slate-300 text-on-surface font-title-md text-sm rounded-xl hover:bg-slate-50 transition-all active:scale-[0.98] font-bold cursor-pointer"
                  >
                    Keep Exploring
                  </button>
                </div>

                {/* Footer discrete branding */}
                <footer className="relative z-10 pt-4 text-center">
                  <span className="text-[10px] text-slate-400 tracking-[0.25em] uppercase font-bold">Aura Premium</span>
                </footer>
              </div>
            );
          })()}

          {/* ==================== 10. SCREEN: CHAT INBOX & ACTIVE CHAT ==================== */}
          {currentScreen === 'chat' && !selectedChatPartner && (
            <div className="absolute inset-0 flex flex-col animate-fade-in bg-[#f4faff]">
              {/* Header */}
              <header className="fixed top-0 w-full max-w-[430px] z-50 bg-white/90 backdrop-blur-xl h-16 flex items-center px-6 justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-extrabold text-on-surface">Direct Messages</h1>
                  <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {Object.keys(conversations).length}
                  </span>
                </div>
                <button onClick={() => navigateTo('discover')} className="text-primary active:scale-90">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </header>

              {/* Scrollable Container */}
              <div className="flex-1 overflow-y-auto px-6 pt-20 pb-4 space-y-4 scrollbar-hide">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
                  <div className="space-y-1">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Search Members by @Username or Name</h2>
                    <p className="text-[10px] text-slate-400">Mutual follow is required to unlock direct messaging.</p>
                  </div>
                  <div className="flex gap-2 bg-slate-50 border border-slate-200/50 rounded-xl px-3 py-2">
                    <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
                    <input
                      type="text"
                      value={chatSearchQuery}
                      onChange={(e) => setChatSearchQuery(e.target.value)}
                      placeholder="Type username (e.g., elena, sarah, leo) or name..."
                      className="bg-transparent border-none w-full text-xs text-on-surface placeholder:text-slate-400 outline-none font-mono"
                    />
                  </div>

                  {/* Search Results */}
                  {chatSearchQuery.trim() !== '' && (
                    <div className="pt-2 border-t border-slate-100 flex flex-col gap-2.5 max-h-[320px] overflow-y-auto scrollbar-hide">
                      {(() => {
                        const query = chatSearchQuery.toLowerCase();
                        
                        // 1. Local Matches
                        const localMatched = AVAILABLE_PEOPLE.filter(
                          (p) =>
                            p.name.toLowerCase().includes(query) ||
                            (p.username && p.username.toLowerCase().includes(query)) ||
                            p.id.toLowerCase().includes(query)
                        );

                        // 2. Live DB Matches
                        const dbMapped: ChatPartner[] = dbSearchResults
                          .filter((dbUser) => dbUser.uid !== auth.currentUser?.uid)
                          .map((dbUser) => ({
                            id: dbUser.uid,
                            name: dbUser.name || 'Anonymous',
                            username: dbUser.username || dbUser.uid,
                            photo: dbUser.photo || IMAGES.primaryOnboardingPic,
                            bio: dbUser.bio || 'Aura Member',
                            age: dbUser.age || 21,
                          }));

                        // 3. De-duplicate (DB matching has priority)
                        const seenIds = new Set<string>();
                        const matched: ChatPartner[] = [];

                        for (const item of [...dbMapped, ...localMatched]) {
                          if (!seenIds.has(item.id)) {
                            seenIds.add(item.id);
                            matched.push(item);
                          }
                        }

                        if (matched.length > 0) {
                          return matched.map((person) => {
                            const followingList = userProfile.following || [];
                            const isFollowing = followingList.includes(person.id);
                            const isFollowedBack = !!mockFollowBacks[person.id];
                            const isMutual = isFollowing && isFollowedBack;

                            return (
                              <div
                                key={person.id}
                                className="p-3 rounded-2xl bg-slate-50/60 border border-slate-100 flex flex-col gap-2 transition-all text-left"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2.5">
                                    <img src={person.photo} alt={person.name} className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm" />
                                    <div className="flex flex-col">
                                      <span className="text-xs font-bold text-[#111d23]">{person.name}</span>
                                      <span className="text-[10px] text-primary font-mono font-bold">@{person.username || person.id}</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    {/* Follow/Unfollow Button */}
                                    <button
                                      type="button"
                                      onClick={() => toggleFollowUser(person.id)}
                                      className={`px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
                                        isFollowing
                                          ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                          : 'bg-primary text-white hover:brightness-110 shadow-sm'
                                      }`}
                                    >
                                      {isFollowing ? '✓ Following' : 'Follow'}
                                    </button>

                                    {/* Message / Lock Chat Action */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedChatPartner(person);
                                        setChatSearchQuery('');
                                      }}
                                      className={`p-2 rounded-full transition-all active:scale-90 cursor-pointer ${
                                        isMutual
                                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                          : 'bg-rose-50 text-rose-500 hover:bg-rose-100'
                                      }`}
                                      title={isMutual ? 'Chat unlocked!' : 'Chat locked. Requires mutual follow.'}
                                    >
                                      <span className="material-symbols-outlined text-[16px] fill-icon">
                                        {isMutual ? 'chat' : 'lock'}
                                      </span>
                                    </button>
                                  </div>
                                </div>

                                {/* Friendship Status Details */}
                                <div className="bg-white/80 rounded-xl p-2 border border-slate-100 flex items-center justify-between text-[9px]">
                                  <div className="flex flex-col gap-0.5 text-left text-slate-500 font-medium">
                                    <span className="flex items-center gap-1">
                                      <span className={`w-1.5 h-1.5 rounded-full ${isFollowing ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                                      {isFollowing ? 'You follow them' : 'You do not follow them'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className={`w-1.5 h-1.5 rounded-full ${isFollowedBack ? 'bg-green-500' : 'bg-slate-300'}`}></span>
                                      {isFollowedBack ? 'They follow you back' : 'They do not follow you yet'}
                                    </span>
                                  </div>

                                  {!isFollowedBack && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMockFollowBacks(prev => ({ ...prev, [person.id]: true }));
                                      }}
                                      className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 rounded-lg font-bold transition-colors border border-amber-500/20 cursor-pointer"
                                    >
                                      ⚡ Force Follow-Back
                                    </button>
                                  )}

                                  {isMutual && (
                                    <span className="font-extrabold text-green-600 tracking-wider uppercase bg-green-50 px-2 py-0.5 rounded border border-green-200">
                                      👥 Mutual Match
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        } else {
                          // Dynamic partner creation for custom usernames
                          const cleanUserQuery = chatSearchQuery.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
                          return (
                            <div className="p-3 rounded-2xl bg-primary/5 border border-primary/10 space-y-2 text-left">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    <span className="material-symbols-outlined">person_add</span>
                                  </div>
                                  <div className="flex flex-col text-left">
                                    <span className="text-xs font-bold text-on-surface font-title-md">Custom User</span>
                                    <span className="text-[10px] text-primary font-mono font-bold">@{cleanUserQuery}</span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const customPartner: ChatPartner = {
                                      id: cleanUserQuery,
                                      username: cleanUserQuery,
                                      name: chatSearchQuery.charAt(0).toUpperCase() + chatSearchQuery.slice(1),
                                      photo: IMAGES.coupleBackground,
                                      bio: 'Custom chat spark',
                                      age: 25,
                                    };
                                    setSelectedChatPartner(customPartner);
                                    setChatSearchQuery('');
                                  }}
                                  className="px-3 py-1.5 rounded-full bg-primary text-white text-[9px] font-bold uppercase tracking-wider active:scale-95 transition-all shadow-sm cursor-pointer"
                                >
                                  Create & Chat
                                </button>
                              </div>
                              <p className="text-[9px] text-slate-500">Tap to start a conversation with a member using username @{cleanUserQuery}.</p>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  )}
                </div>

                {/* New Matches (Horizontal Row) */}
                {(() => {
                  const followingList = userProfile.following || [];
                  const mutualMatches = discoverPeople.filter((p) => {
                    const isFollowing = followingList.includes(p.id);
                    const isFollowedBack = !!mockFollowBacks[p.id];
                    return isFollowing || isFollowedBack;
                  });

                  if (mutualMatches.length === 0) return null;

                  return (
                    <div className="space-y-2 mb-4">
                      <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-left">New Matches</h3>
                      <div className="flex gap-4 overflow-x-auto pb-2 pt-1 scrollbar-hide">
                        {mutualMatches.map((person) => (
                          <button
                            key={person.id}
                            onClick={() => setSelectedChatPartner(person)}
                            className="flex flex-col items-center gap-1.5 focus:outline-none shrink-0 group cursor-pointer"
                          >
                            <div className="relative">
                              <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-primary to-purple-500">
                                <div className="w-full h-full rounded-full border-2 border-white overflow-hidden bg-slate-100">
                                  <img src={person.photo} alt={person.name} className="w-full h-full object-cover" />
                                </div>
                              </div>
                              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-700 group-hover:text-primary transition-colors">{person.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Conversation List */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider text-left">Active Conversations</h3>
                  {(() => {
                    // Get all conversation keys
                    const convKeys = Object.keys(conversations);
                    // Get any mutual followers who don't have a conversation yet
                    const followingList = userProfile.following || [];
                    const mutualMatchedIds = discoverPeople
                      .filter((p) => followingList.includes(p.id))
                      .map((p) => p.id);

                    // Combine and de-duplicate
                    const allPartnerIds = Array.from(new Set([...convKeys, ...mutualMatchedIds]));

                    if (allPartnerIds.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-10 text-center space-y-3 bg-white rounded-2xl p-6 border border-slate-100 animate-fade-in">
                          <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center text-primary animate-pulse">
                            <span className="material-symbols-outlined text-3xl">chat_bubble</span>
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-[#69575e]">No active chats yet</h4>
                            <p className="text-[10px] text-slate-400 max-w-[200px] leading-relaxed mx-auto">
                              Your inbox is completely clean! Like someone in Discover to spark a connection and chat.
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="flex flex-col gap-2 animate-fade-in">
                        {allPartnerIds.map((partnerId) => {
                          const conversationMsgs = conversations[partnerId] || [];
                          const lastMsg = conversationMsgs[conversationMsgs.length - 1];
                          // Find matching person
                          let person = discoverPeople.find((p) => p.id === partnerId) || AVAILABLE_PEOPLE.find((p) => p.id === partnerId);
                          if (!person) {
                            person = {
                              id: partnerId,
                              name: partnerId.charAt(0).toUpperCase() + partnerId.slice(1),
                              photo: IMAGES.coupleBackground,
                            };
                          }

                          return (
                            <div
                              key={partnerId}
                              onClick={() => setSelectedChatPartner(person || null)}
                              className="flex items-center justify-between p-3 rounded-2xl bg-white border border-slate-100 hover:bg-slate-50 active:scale-98 transition-all cursor-pointer shadow-sm text-left"
                            >
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <img src={person.photo} alt={person.name} className="w-11 h-11 rounded-full object-cover border border-slate-100 shadow-sm" />
                                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                                </div>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-on-surface">{person.name}</span>
                                    {chatStreaks[partnerId] !== undefined && chatStreaks[partnerId] > 0 && (
                                      <span className="flex items-center text-[9px] font-extrabold text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200/50">
                                        🔥 {chatStreaks[partnerId]}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-500 max-w-[180px] truncate">
                                    {lastMsg ? (lastMsg.sender === 'user' ? 'You: ' : '') + lastMsg.text : '✨ Click here to type and send messages!'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 text-[9px] text-slate-400">
                                <span>{lastMsg ? lastMsg.time : 'Ready'}</span>
                                {lastMsg && lastMsg.sender === 'user' && (
                                  <span className="material-symbols-outlined text-[12px] text-primary fill-icon">check_circle</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {currentScreen === 'chat' && selectedChatPartner && (
            <div className="absolute inset-0 flex flex-col justify-between animate-fade-in bg-[#efeae2]">
              {/* WhatsApp-style Header */}
              <header className="fixed top-0 w-full max-w-[430px] z-50 bg-[#075e54] text-white h-16 flex items-center px-4 justify-between shadow-md">
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedChatPartner(null)} className="text-white active:scale-90 flex items-center justify-center p-1 hover:bg-black/10 rounded-full transition-colors">
                    <span className="material-symbols-outlined font-bold text-[22px]">arrow_back</span>
                  </button>
                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => {
                    setSelectedDiscoverPerson(selectedChatPartner);
                    navigateTo('profile_details');
                  }}>
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full border border-white/20 overflow-hidden bg-slate-100">
                        <img className="w-full h-full object-cover" src={selectedChatPartner.photo} alt="Chat avatar" />
                      </div>
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border border-[#075e54] rounded-full"></div>
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-bold leading-none tracking-tight">{selectedChatPartner.name}</span>
                      <span className="text-[10px] text-emerald-100 mt-0.5 font-medium">online</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setActiveCall({ partner: selectedChatPartner, type: 'voice', status: 'ringing', duration: 0 });
                      setIsMuted(false);
                      setIsSpeaker(false);
                      trackUserAction('voice_call_initiate', selectedChatPartner.id);
                    }}
                    className="text-white hover:text-emerald-100 active:scale-90 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">call</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveCall({ partner: selectedChatPartner, type: 'video', status: 'ringing', duration: 0 });
                      setIsMuted(false);
                      setIsSpeaker(false);
                      trackUserAction('video_call_initiate', selectedChatPartner.id);
                    }}
                    className="text-white hover:text-emerald-100 active:scale-90 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">videocam</span>
                  </button>
                  {chatStreaks[selectedChatPartner.id] !== undefined && chatStreaks[selectedChatPartner.id] > 0 && (
                    <span className="flex items-center text-[10px] font-extrabold text-amber-300 bg-[#128c7e] px-2 py-0.5 rounded-full border border-amber-400/30">
                      🔥 {chatStreaks[selectedChatPartner.id]}
                    </span>
                  )}
                </div>
              </header>

              {/* Messages Thread Container */}
              <div className="flex-1 overflow-y-auto px-4 pt-20 pb-2 space-y-3.5 scrollbar-hide flex flex-col bg-[#efeae2]">
                <div className="flex justify-center my-1">
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-md bg-[#e1f3fc] text-[#4a889c] shadow-xs uppercase tracking-wider">Today</span>
                </div>

                {/* Encryption Notice */}
                <div className="flex justify-center my-1.5 max-w-[90%] mx-auto">
                  <div className="bg-[#ffeecd] border border-amber-200/40 text-[10px] text-[#554a36] py-1.5 px-3 rounded-lg text-center font-medium shadow-xs flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-xs text-amber-600 fill-icon">lock</span>
                    <span>Messages are end-to-end encrypted and completely private.</span>
                  </div>
                </div>

                {/* Direct Message / Non-Mutual Follow Banner */}
                {!isMutualFollower(selectedChatPartner.id) && (
                  <div className="bg-[#fff3cd] border border-amber-200 rounded-xl p-3 text-center space-y-2.5 shadow-xs my-1 animate-fade-in text-slate-800">
                    <p className="text-[10px] text-slate-600 leading-relaxed font-semibold">
                      You are not mutually following @{selectedChatPartner.username || selectedChatPartner.id} yet. Instantly match to chat without restrictions!
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        toggleFollowUser(selectedChatPartner.id);
                        setMockFollowBacks((prev) => ({ ...prev, [selectedChatPartner.id]: true }));
                      }}
                      className="px-3.5 py-1 bg-[#128c7e] text-white text-[10px] font-bold rounded-md hover:bg-[#075e54] active:scale-95 shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-xs">favorite</span>
                      <span>Instant Match & Unlock</span>
                    </button>
                  </div>
                )}

                {(conversations[selectedChatPartner.id] || []).map((msg) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[85%] ${isUser ? 'self-end items-end' : 'self-start items-start'}`}
                    >
                      <div
                        className={`px-3.5 py-2 rounded-xl relative shadow-sm border ${
                          isUser
                            ? 'bg-[#d9fdd3] text-[#303030] rounded-tr-none border-[#c1ebd0]'
                            : 'bg-white text-[#303030] rounded-tl-none border-[#e1e1e1]'
                        }`}
                      >
                        {msg.image && (
                          <div className="w-full rounded-lg overflow-hidden mb-1 border border-slate-100 shadow-xs">
                            <img src={msg.image} className="w-full max-h-48 object-cover" alt="Image attachment" />
                          </div>
                        )}
                        {msg.text && <p className="text-xs leading-normal font-medium">{msg.text}</p>}
                        
                        <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 mt-1">
                          <span>{msg.time}</span>
                          {isUser && (
                            <span className="material-symbols-outlined text-[13px] text-[#53bdeb] font-bold">done_all</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Typing Indicator */}
                {isElenaTyping && (
                  <div className="flex items-center gap-1.5 self-start animate-pulse">
                    <div className="bg-white border border-slate-200 px-3 py-2 rounded-xl rounded-tl-none flex gap-1 items-center shadow-xs">
                      <span className="text-[10px] text-slate-500 font-medium">typing</span>
                      <div className="w-1 h-1 bg-[#075e54] rounded-full animate-bounce"></div>
                      <div className="w-1 h-1 bg-[#075e54] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-1 h-1 bg-[#075e54] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* WhatsApp-style Input Footer */}
              <footer className="bg-[#f0f0f0] border-t border-slate-200/80 px-3 py-3 flex flex-col gap-2">
                {/* Hello, Hi and Quick Greeting Option Chips */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                  {['👋 Hello!', '✨ Hi!', '💖 Beautiful profile!', '😊 Let\'s connect!', '☕ Coffee soon?'].map((quickMsg) => (
                    <button
                      key={quickMsg}
                      onClick={() => {
                        setInputText(quickMsg);
                      }}
                      className="px-3 py-1 bg-white text-slate-700 text-[11px] font-bold rounded-full border border-slate-200 hover:border-[#128c7e] hover:text-[#128c7e] active:scale-95 transition-all shadow-xs cursor-pointer shrink-0"
                    >
                      {quickMsg}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center bg-white rounded-full px-3.5 h-11 border border-slate-200 shadow-xs">
                    <button onClick={() => setInputText((prev) => prev + ' 😊')} className="text-slate-500 hover:text-[#128c7e] transition-colors active:scale-90 mr-2.5">
                      <span className="material-symbols-outlined text-[22px]">mood</span>
                    </button>
                    
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendMessage();
                      }}
                      placeholder={`Type a message...`}
                      className="flex-1 bg-transparent border-none text-sm text-slate-800 placeholder:text-slate-400 outline-none font-medium"
                    />

                    <input
                      type="file"
                      accept="image/*"
                      ref={chatCameraInputRef}
                      onChange={handleChatCameraChange}
                      className="hidden"
                    />

                    <button
                      onClick={() => chatCameraInputRef.current?.click()}
                      className="text-slate-400 hover:text-[#128c7e] transition-colors active:scale-90 ml-2.5"
                    >
                      <span className="material-symbols-outlined text-[22px]">photo_camera</span>
                    </button>
                  </div>

                  <button
                    onClick={handleSendMessage}
                    className="w-11 h-11 bg-[#128c7e] text-white rounded-full flex items-center justify-center shadow-md active:scale-90 shrink-0 cursor-pointer hover:bg-[#075e54] transition-colors"
                    id="send-chat-btn"
                    title={inputText.trim() ? "Send Message" : "Record Audio"}
                  >
                    <span className="material-symbols-outlined text-[20px] font-bold">
                      {inputText.trim() ? 'send' : 'mic'}
                    </span>
                  </button>
                </div>
              </footer>
            </div>
          )}

          {/* ==================== 11. SCREEN: STORIES & SOCIAL DISCOVERY ==================== */}
          {currentScreen === 'stories' && (
            <div className="px-6 pt-4 space-y-5 animate-fade-in">
              {/* Header */}
              <header className="flex justify-between items-center h-10">
                <button onClick={() => navigateTo('discover')} className="text-primary active:scale-90">
                  <span className="material-symbols-outlined">auto_awesome</span>
                </button>
                <h1 className="font-title-md text-xl tracking-[0.25em] text-primary italic font-bold">AURA</h1>
                <button onClick={() => navigateTo('edit_profile')} className="text-primary active:scale-90">
                  <span className="material-symbols-outlined">settings</span>
                </button>
              </header>

              {/* Search Bar */}
              <div className="space-y-3">
                <div className="rounded-full bg-white px-4 py-2.5 flex items-center gap-2.5 shadow-sm border border-slate-100">
                  <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
                  <input
                    type="text"
                    value={homeSearchQuery}
                    onChange={(e) => setHomeSearchQuery(e.target.value)}
                    placeholder="Search people by username..."
                    className="bg-transparent border-none w-full text-xs text-on-surface placeholder:text-slate-400 outline-none"
                  />
                  {homeSearchQuery && (
                    <button onClick={() => setHomeSearchQuery('')} className="text-slate-400 hover:text-primary transition-all">
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  )}
                  <button onClick={() => navigateTo('onboarding_interests')} className="text-primary">
                    <span className="material-symbols-outlined text-lg">tune</span>
                  </button>
                </div>

                {/* Home Search Dropdown Results */}
                {homeSearchQuery.trim() !== '' && (
                  <div className="bg-white rounded-2xl p-4 shadow-md border border-slate-100 space-y-3 animate-fade-in max-h-60 overflow-y-auto scrollbar-hide text-left">
                    <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Search Results</h4>
                    {(() => {
                      const filtered = discoverPeople.filter((p) =>
                        (p.username || p.id).toLowerCase().includes(homeSearchQuery.toLowerCase()) ||
                        p.name.toLowerCase().includes(homeSearchQuery.toLowerCase())
                      );
                      if (filtered.length === 0) {
                        return <p className="text-xs text-slate-400 py-2">No users found with username "{homeSearchQuery}"</p>;
                      }
                      return filtered.map((person) => (
                        <div
                          key={person.id}
                          onClick={() => {
                            setSelectedDiscoverPerson(person);
                            // Let's set active index to this person
                            const idx = discoverPeople.findIndex((p) => p.id === person.id);
                            if (idx !== -1) {
                              setActiveDiscoverIndex(idx);
                            }
                            setHomeSearchQuery('');
                            navigateTo('discover');
                          }}
                          className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-all cursor-pointer border border-slate-50"
                        >
                          <div className="flex items-center gap-3">
                            <img src={person.photo} alt={person.name} className="w-9 h-9 rounded-full object-cover border border-slate-100 shadow-sm" />
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-800 leading-tight">{person.name}</span>
                              <span className="text-[10px] text-slate-400">@{person.username || person.id}</span>
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-primary text-sm">chevron_right</span>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>

              {/* Stories Row */}
              {(() => {
                const combinedStories = [...userStories, ...STORIES];
                return (
                  <section className="space-y-2">
                    {/* Hidden upload input */}
                    <input
                      type="file"
                      ref={storyFileInputRef}
                      onChange={handleStoryUpload}
                      accept="image/*"
                      className="hidden"
                    />

                    <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase">Social Stories</h3>
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide py-1">
                      {/* Your story slot */}
                      <div
                        onClick={() => storyFileInputRef.current?.click()}
                        className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer"
                      >
                        <div className="sunset-gradient-ring w-14 h-14 rounded-full flex items-center justify-center">
                          <div className="w-full h-full rounded-full border-2 border-white flex items-center justify-center bg-slate-50 overflow-hidden">
                            {userStories.length > 0 ? (
                              <img className="w-full h-full object-cover" src={userStories[0].photo} alt="Your story" />
                            ) : (
                              <span className="material-symbols-outlined text-primary text-lg">add</span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-500 font-semibold">Your Story</span>
                      </div>

                      {/* Other stories */}
                      {combinedStories.map((story, idx) => (
                        <div
                          key={story.id}
                          onClick={() => setActiveStoryIndex(idx)}
                          className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer"
                        >
                          <div className="sunset-gradient-ring w-14 h-14 rounded-full flex items-center justify-center">
                            <div className="w-full h-full rounded-full border-2 border-white overflow-hidden">
                              <img className="w-full h-full object-cover" src={story.photo} alt={story.name} />
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-800 font-semibold">{story.name}</span>
                        </div>
                      ))}
                    </div>

                    {/* Story Fullscreen Overlay */}
                    {activeStoryIndex !== null && combinedStories[activeStoryIndex] && (() => {
                      const story = combinedStories[activeStoryIndex];
                      const isOwnStory = story.id.startsWith('user_story_') || story.id === 'julian';
                      const hasAccess = true; // Completely unlocked without follow constraints

                      return (
                        <div className="fixed inset-0 bg-black/95 z-[10000] flex flex-col justify-between py-6 px-4 animate-fade-in text-white">
                          {/* Top Timer Bar & Header */}
                          <div className="w-full flex flex-col gap-3">
                            <div className="flex gap-1.5 w-full">
                              {combinedStories.map((_, idx) => {
                                let widthPercent = 0;
                                if (idx < activeStoryIndex) widthPercent = 100;
                                else if (idx === activeStoryIndex) widthPercent = activeStoryTimeLeft;
                                return (
                                  <div key={idx} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                                    <div className="bg-white h-full transition-all ease-linear" style={{ width: `${widthPercent}%` }}></div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Story Header */}
                            <div className="flex items-center justify-between text-white">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full border border-white overflow-hidden bg-slate-100">
                                  <img src={story.photo} alt={story.name} className="w-full h-full object-cover" />
                                </div>
                                <span className="text-xs font-bold">{story.name}</span>
                              </div>
                              <button onClick={() => setActiveStoryIndex(null)} className="text-white hover:text-primary p-1">
                                <span className="material-symbols-outlined text-[20px]">close</span>
                              </button>
                            </div>
                          </div>

                          {/* Top Banner Ad */}
                          <div className="bg-gradient-to-r from-purple-900/80 to-indigo-950/80 border border-purple-500/30 rounded-xl p-2.5 text-center text-[10px] font-medium text-purple-200 shadow-sm animate-pulse flex items-center justify-center gap-1.5 select-none">
                            <span className="material-symbols-outlined text-[12px] text-amber-400">workspace_premium</span>
                            <span>SPONSORED: Spark more profiles with Aura Premium for 5x match rates!</span>
                          </div>

                          {/* Story Main Image */}
                          <div className="flex-1 flex items-center justify-center my-4 overflow-hidden rounded-2xl">
                            <img
                              src={story.photo}
                              className="w-full max-h-[50vh] object-contain rounded-2xl shadow-xl"
                              alt="story full view"
                            />
                          </div>

                          {/* Bottom Banner Ad */}
                          <div className="bg-gradient-to-r from-rose-950/80 to-slate-900/80 border border-rose-500/30 rounded-xl p-2.5 text-center text-[10px] font-medium text-rose-200 shadow-sm flex items-center justify-center gap-1.5 select-none">
                            <span className="material-symbols-outlined text-[12px] text-rose-400">ads_click</span>
                            <span>AD: Try Aura Gold standard today to boost profile views by 400%!</span>
                          </div>

                          {/* Story footer chat shortcut */}
                          <div className="flex gap-2 items-center mt-2">
                            <input
                              type="text"
                              placeholder={`Reply to ${story.name}...`}
                              className="flex-1 bg-white/10 text-white placeholder:text-white/60 border border-white/20 rounded-full py-2 px-4 text-xs outline-none focus:bg-white/20 focus:border-white"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  alert(`Message reply sent to ${story.name}!`);
                                  setActiveStoryIndex(null);
                                }
                              }}
                            />
                            <button className="text-white hover:text-primary">
                              <span className="material-symbols-outlined text-[20px]">favorite</span>
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </section>
                );
              })()}

              {/* Sparks Connections requests */}
              <section className="space-y-3 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase">New Sparks</h3>
                    <span className="bg-primary text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                      {sparksList.filter((s) => s.status === 'pending').length}
                    </span>
                  </div>
                  
                  {/* Sparks Balance & Actions */}
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold text-amber-500 flex items-center gap-0.5 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      <span className="material-symbols-outlined text-[12px] font-bold">stars</span>
                      <span>{userSparks} Sparks ✨</span>
                    </span>
                  </div>
                </div>

                {/* Ad & Reset buttons side-by-side */}
                <div className="flex gap-2 w-full pb-1">
                  <button
                    onClick={() => {
                      setAdTimeLeft(2); // 2 second ad simulation
                      setWatchingAd(true);
                    }}
                    className="flex-1 bg-amber-500 text-white text-[10px] font-bold py-1.5 px-3 rounded-xl hover:bg-amber-600 transition-colors flex items-center justify-center gap-1 active:scale-95 cursor-pointer shadow-sm animate-pulse"
                  >
                    <span className="material-symbols-outlined text-xs">play_circle</span>
                    <span>Watch Ad (+5 ✨)</span>
                  </button>
                  <button
                    onClick={resetSparksList}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold py-1.5 px-3 rounded-xl transition-colors flex items-center justify-center gap-1 active:scale-95 cursor-pointer border border-slate-200/50 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-xs">refresh</span>
                    <span>Reset Sparks</span>
                  </button>
                </div>

                <div className="flex gap-3 overflow-x-auto scrollbar-hide py-1">
                  {sparksList.map((spark) => (
                    <div
                      key={spark.id}
                      className="bg-slate-50 border border-slate-100/80 rounded-2xl p-3 min-w-[130px] flex flex-col items-center text-center space-y-2 shadow-sm"
                    >
                      <div className="w-14 h-14 rounded-full overflow-hidden border border-primary-fixed">
                        <img className="w-full h-full object-cover" src={spark.photo} alt={spark.name} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-on-surface leading-none">{spark.name}</p>
                        <p className="text-[9px] text-primary font-semibold mt-0.5">
                          {spark.status === 'pending'
                            ? 'Wants to connect'
                            : spark.status === 'accepted'
                            ? 'Connected ✓'
                            : 'Declined'}
                        </p>
                      </div>

                      {spark.status === 'pending' && (
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleSparkAction(spark.id, 'decline')}
                            className="w-7 h-7 rounded-full bg-slate-200/70 hover:bg-red-50 text-slate-500 hover:text-red-500 transition-colors flex items-center justify-center active:scale-90"
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                          <button
                            onClick={() => handleSparkAction(spark.id, 'accept')}
                            className="w-7 h-7 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors flex items-center justify-center active:scale-90"
                          >
                            <span className="material-symbols-outlined text-[14px]">favorite</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Suggested Profiles */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase">Suggested for you</h3>
                <div className="space-y-3">
                  {SUGGESTIONS.map((s) => (
                    <div
                      key={s.id}
                      className="relative w-full aspect-[4/5] rounded-[24px] overflow-hidden group shadow-sm border border-slate-100"
                    >
                      <img src={s.photo} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={s.name} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>

                      <div className="absolute bottom-0 inset-x-0 p-4 space-y-2">
                        <div className="flex justify-between items-end">
                          <div className="text-white">
                            <h4 className="font-title-md text-lg leading-none">{s.name}, {s.age}</h4>
                            <p className="text-[10px] opacity-80 font-medium">{s.location}</p>
                          </div>
                          <button
                            onClick={() => alert(`Sparking query with ${s.name}!`)}
                            className="w-9 h-9 rounded-full bg-primary text-white shadow-lg flex items-center justify-center active:scale-90"
                          >
                            <span className="material-symbols-outlined text-sm">{s.type === 'bolt' ? 'bolt' : 'auto_fix_high'}</span>
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {s.interests.map((tag) => (
                            <span key={tag} className="bg-white/20 text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Social Activity */}
              <section className="space-y-2 pb-6">
                <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase">Social Activity</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100/50 hover:bg-slate-100/50 cursor-pointer">
                    <div className="w-9 h-9 rounded-full overflow-hidden">
                      <img src={STORIES[1].photo} className="w-full h-full object-cover" alt="Leo activity" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] text-[#111d23] font-medium"><span className="font-bold">Leo</span> added a new story</p>
                      <p className="text-[9px] text-slate-400">2m ago</p>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100/50 hover:bg-slate-100/50 cursor-pointer">
                    <div className="w-9 h-9 rounded-full overflow-hidden">
                      <img src={STORIES[2].photo} className="w-full h-full object-cover" alt="Maya activity" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] text-[#111d23] font-medium"><span className="font-bold">Maya</span> is nearby</p>
                      <p className="text-[9px] text-slate-400">15m ago</p>
                    </div>
                    <span className="material-symbols-outlined text-primary/60 text-sm">near_me</span>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ==================== 12. SCREEN: EDIT PROFILE ==================== */}
          {currentScreen === 'edit_profile' && (
            <div className="px-6 pt-4 space-y-6 animate-fade-in">
              {/* Header */}
              <header className="fixed top-0 w-full max-w-[430px] z-50 bg-white/90 backdrop-blur-md flex justify-between items-center px-6 h-16 shadow-sm">
                <button onClick={() => navigateTo('stories')} className="text-primary active:scale-95">
                  <span className="material-symbols-outlined">close</span>
                </button>
                <h1 className="font-title-md text-sm text-on-surface font-extrabold">Edit Profile</h1>
                <button
                  onClick={() => {
                    saveProfileToFirestore();
                    navigateTo('stories');
                  }}
                  className="text-primary text-xs font-bold active:scale-95 cursor-pointer"
                  id="edit-profile-done-btn"
                >
                  Done
                </button>
              </header>

              {/* Space for fixed header */}
              <div className="h-10"></div>

              {/* Toast notifier */}
              {saveSuccessToast && (
                <div className="fixed top-20 inset-x-6 z-[9999] bg-[#e3f0f8] border border-primary-fixed text-[#111d23] py-2 px-4 rounded-xl text-center shadow-lg font-semibold text-xs animate-bounce">
                  ✓ Profile Changes Saved Successfully!
                </div>
              )}

              {/* Photo selector grid */}
              <section className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 row-span-2 relative aspect-square rounded-xl overflow-hidden card-shadow bg-slate-100">
                    <img className="w-full h-full object-cover" src={userProfile.photos[0] || IMAGES.julianEditPhoto} alt="Primary user edit" />
                    <button
                      onClick={() => {
                        setPhotoSlotToEdit(0);
                        fileInputRef.current?.click();
                      }}
                      className="absolute bottom-2 right-2 bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg cursor-pointer active:scale-90"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                  </div>

                  {[1, 2, 3, 4, 5].map((idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setPhotoSlotToEdit(idx);
                        fileInputRef.current?.click();
                      }}
                      className="aspect-square bg-slate-100 rounded-xl border border-dashed border-[#e4bdc2] flex items-center justify-center cursor-pointer hover:bg-slate-200/50 overflow-hidden relative"
                    >
                      {userProfile.photos[idx] ? (
                        <>
                          <img src={userProfile.photos[idx]} className="w-full h-full object-cover rounded-xl" alt="upload preview" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const updatedPhotos = [...userProfile.photos];
                              updatedPhotos.splice(idx, 1);
                              const updatedProfile = { ...userProfile, photos: updatedPhotos };
                              setUserProfile(updatedProfile);
                              saveProfileToFirestore(updatedProfile);
                            }}
                            className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white text-[10px] hover:bg-black cursor-pointer"
                          >
                            ×
                          </button>
                        </>
                      ) : (
                        <span className="material-symbols-outlined text-slate-400">add</span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-center text-[10px] text-slate-400 font-medium">Click on slots to add or edit photos</p>
              </section>

              {/* Profile Completion percentage */}
              <section className="bg-[#e9f6fd] p-4 rounded-xl border border-primary-fixed/20 shadow-sm space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-primary font-bold">Profile {profileCompletion}% Complete</span>
                  <span className="text-[10px] text-slate-500">
                    {profileCompletion === 100 ? 'Verified & Complete! 🎉' : 'Almost there!'}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${profileCompletion}%` }}></div>
                </div>

                <input
                  type="file"
                  accept="video/*"
                  ref={videoFileInputRef}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setProfileCompletion(100);
                      showToast("🎥 Short bio video successfully uploaded and verified!", "success");
                    }
                  }}
                />

                <button
                  onClick={() => videoFileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-primary text-[10px] font-bold mt-1 hover:underline cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">videocam</span>
                  {profileCompletion === 100 ? 'Update bio video' : 'Add a video to reach 100%'}
                </button>
              </section>

              {/* Bio description text area */}
              <section className="space-y-1.5">
                <h3 className="text-xs font-bold text-slate-700 block">About Me</h3>
                <div className="relative">
                  <textarea
                    value={userProfile.bio}
                    onChange={(e) => setUserProfile({ ...userProfile, bio: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-700 focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all resize-none h-24"
                    maxLength={500}
                  ></textarea>
                  <div className="absolute bottom-2 right-2 text-slate-400 text-[9px]">
                    {userProfile.bio.length}/500
                  </div>
                </div>
              </section>

              {/* Interests chips editor */}
              <section className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-700">My Interests</h3>
                  <button onClick={() => navigateTo('onboarding_interests')} className="text-xs text-primary font-bold">
                    Edit Tags
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {userProfile.interests.map((tag) => (
                    <span key={tag} className="bg-[#F3E5F5] text-[#263238] font-bold text-[9px] tracking-wide uppercase px-2.5 py-1 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </section>

              {/* Prompts list editor */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold text-slate-700">Profile Prompts</h3>
                <div className="space-y-3">
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                    {isEditingPrompt ? (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Select Prompt Category</label>
                          <select
                            value={profilePrompt}
                            onChange={(e) => setProfilePrompt(e.target.value)}
                            className="w-full bg-white border border-slate-200 text-xs rounded-lg p-2 outline-none font-bold text-primary"
                          >
                            <option value="My perfect Sunday...">My perfect Sunday...</option>
                            <option value="Most spontaneous thing I've done...">Most spontaneous thing I've done...</option>
                            <option value="I'm looking for someone who...">I'm looking for someone who...</option>
                            <option value="A random fact I love is...">A random fact I love is...</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Your Response</label>
                          <input
                            type="text"
                            value={profilePromptResponse}
                            onChange={(e) => setProfilePromptResponse(e.target.value)}
                            placeholder="Write your answer..."
                            className="w-full bg-white border border-slate-200 text-xs rounded-lg p-2.5 outline-none font-semibold text-slate-800"
                          />
                        </div>

                        <div className="flex gap-2 text-[10px] font-bold">
                          <button
                            onClick={() => {
                              setIsEditingPrompt(false);
                              showToast("✨ Profile prompt updated!", "success");
                            }}
                            className="flex-1 py-2 bg-primary text-white rounded-lg active:scale-95 transition-all cursor-pointer text-center"
                          >
                            Save Prompt
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-[10px] text-primary font-bold italic">{profilePrompt}</p>
                        <p className="text-xs text-slate-800 font-bold leading-tight">{profilePromptResponse}</p>
                        <div className="flex gap-2 pt-1 text-[10px] font-bold">
                          <button
                            onClick={() => setIsEditingPrompt(true)}
                            className="flex-1 py-1.5 bg-[#f4dce4] text-[#25181e] rounded-lg hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                          >
                            Change Prompt & Answer
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </section>

              {/* Basic input forms */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold text-slate-700">Basic Info</h3>
                <div className="space-y-2 text-xs">
                  <div className="space-y-1">
                    <label className="text-slate-500 font-semibold">Username</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs">@</span>
                      <input
                        type="text"
                        value={userProfile.username || ''}
                        onChange={(e) => setUserProfile({ ...userProfile, username: e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, '') })}
                        className="w-full bg-white border border-slate-200 rounded-xl pl-7 pr-3 py-2 outline-none focus:border-primary text-xs font-mono text-on-surface"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-500 font-semibold">Display Name</label>
                    <input
                      type="text"
                      value={userProfile.name}
                      onChange={(e) => setUserProfile({ ...userProfile, name: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-primary text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-slate-500 font-semibold">Age</label>
                      <input
                        type="number"
                        value={userProfile.age}
                        onChange={(e) => setUserProfile({ ...userProfile, age: parseInt(e.target.value) || 18 })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-primary text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-slate-500 font-semibold">Location</label>
                      <input
                        type="text"
                        value={userProfile.location}
                        onChange={(e) => setUserProfile({ ...userProfile, location: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-primary text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-500 font-semibold">Profession</label>
                    <input
                      type="text"
                      value={userProfile.profession}
                      onChange={(e) => setUserProfile({ ...userProfile, profession: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-primary text-xs"
                    />
                  </div>
                </div>
              </section>

              {/* Account, monetization & premium status link buttons */}
              <section className="space-y-2 pt-2 pb-6">
                <h3 className="text-xs font-bold text-slate-700">Account Settings</h3>
                <div className="space-y-2 text-xs">
                  {/* Premium subscription tier selector link */}
                  <div
                    onClick={() => navigateTo('aura_gold')}
                    className="bg-white border border-slate-200/60 p-3.5 rounded-xl cursor-pointer hover:bg-slate-50 flex items-center justify-between shadow-sm active:scale-98"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
                        <span className="material-symbols-outlined text-sm">star</span>
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          Aura Premium Tier
                          <span className="bg-[#b80049] text-white text-[8px] font-bold px-1 rounded">VIP</span>
                        </span>
                        <p className="text-[10px] text-slate-400">Upgrade for unlimited sparks and see who likes you</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 text-sm">chevron_right</span>
                  </div>

                  {/* Creator monetization panel link */}
                  <div
                    onClick={() => navigateTo('creator_monetization')}
                    className="bg-white border border-slate-200/60 p-3.5 rounded-xl cursor-pointer hover:bg-slate-50 flex items-center justify-between shadow-sm active:scale-98"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#fce4ec] flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-sm">payments</span>
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                          Creator Revenue
                          <span className="bg-[#ea4335] text-white text-[8px] font-bold px-1 rounded">HOT</span>
                        </span>
                        <p className="text-[10px] text-slate-400">Track and request payouts on ad earnings</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-slate-400 text-sm">chevron_right</span>
                  </div>

                  {/* PostgreSQL User Data Tracking Hub */}
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-4 rounded-xl shadow-sm text-left space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-600">database</span>
                        <h4 className="font-bold text-slate-800 text-xs">PostgreSQL Tracking Hub</h4>
                      </div>
                      <span className="bg-emerald-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">Active</span>
                    </div>

                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Every swipe, profile update, page navigation, and message is recorded securely in your **Cloud SQL PostgreSQL database**.
                    </p>

                    {loadingTracking ? (
                      <div className="text-[10px] text-slate-400 py-1 flex items-center gap-1.5">
                        <span className="animate-spin material-symbols-outlined text-xs">sync</span> Loading analytics...
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Event Stats summary */}
                        <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                          <div className="bg-white/80 p-1.5 rounded-lg border border-slate-100">
                            <span className="block font-mono font-bold text-emerald-600 text-xs">
                              {trackingLogs.filter(l => l.eventType === 'page_view').length}
                            </span>
                            <span className="text-[8px] text-slate-400 uppercase font-semibold">Views</span>
                          </div>
                          <div className="bg-white/80 p-1.5 rounded-lg border border-slate-100">
                            <span className="block font-mono font-bold text-emerald-600 text-xs">
                              {trackingLogs.filter(l => l.eventType.startsWith('swipe')).length}
                            </span>
                            <span className="text-[8px] text-slate-400 uppercase font-semibold">Swipes</span>
                          </div>
                          <div className="bg-white/80 p-1.5 rounded-lg border border-slate-100">
                            <span className="block font-mono font-bold text-emerald-600 text-xs">
                              {trackingLogs.filter(l => l.eventType === 'send_message').length}
                            </span>
                            <span className="text-[8px] text-slate-400 uppercase font-semibold">Chats</span>
                          </div>
                        </div>

                        {/* Event list */}
                        <div className="max-h-36 overflow-y-auto border border-slate-100/80 rounded-lg bg-white/95 p-2 space-y-1.5 scrollbar-hide">
                          {trackingLogs.length === 0 ? (
                            <p className="text-[10px] text-slate-400 text-center py-4">No tracking data synced yet. Start exploring!</p>
                          ) : (
                            trackingLogs.slice(0, 15).map((log, lIdx) => (
                              <div key={log.id || lIdx} className="text-[9px] flex justify-between items-start border-b border-slate-100/50 pb-1 last:border-0 last:pb-0">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1">
                                    <span className="bg-emerald-100 text-emerald-800 font-bold px-1 rounded-sm text-[7px] uppercase">
                                      {log.eventType.replace('_', ' ')}
                                    </span>
                                    {log.screenName && (
                                      <span className="text-slate-400 font-mono text-[7px]">@{log.screenName}</span>
                                    )}
                                  </div>
                                  {log.details && (
                                    <p className="text-slate-600 line-clamp-1 break-all text-[8px]">{log.details}</p>
                                  )}
                                </div>
                                <span className="text-[8px] text-slate-400 font-mono">
                                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sign Out Action Button */}
                  <div
                    onClick={handleLogout}
                    className="bg-white border border-red-200 p-3.5 rounded-xl cursor-pointer hover:bg-red-50 flex items-center justify-between shadow-sm active:scale-98"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                        <span className="material-symbols-outlined text-sm">logout</span>
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="font-bold text-red-800">Sign Out</span>
                        <p className="text-[10px] text-red-400/85">Logout of your Aura account securely</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-red-400 text-sm">chevron_right</span>
                  </div>
                </div>
              </section>

              {/* Quick floating action Save Button at bottom */}
              <div className="pt-2 pb-10 flex justify-center">
                <button
                  onClick={() => {
                    saveProfileToFirestore();
                  }}
                  className="w-full bg-primary text-white font-title-md py-3 rounded-full shadow-lg glow-button hover:brightness-110 active:scale-95 transition-transform flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          )}

          {/* ==================== 13. SCREEN: CREATOR REVENUE MONETIZATION ==================== */}
          {currentScreen === 'creator_monetization' && (
            <div className="px-6 pt-4 space-y-6 animate-fade-in pb-12">
              {/* Header */}
              <header className="flex justify-between items-center h-10 w-full mb-1">
                <button onClick={() => navigateTo('edit_profile')} className="text-primary active:scale-90">
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="font-title-md text-base text-[#111d23] font-bold">Creator Revenue</h1>
                <button onClick={() => navigateTo('stories')} className="text-primary active:scale-90">
                  <span className="material-symbols-outlined">settings</span>
                </button>
              </header>

              {/* Total earnings cards details */}
              <section className="relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br from-[#E91E63] to-[#C2185B] shadow-lg">
                <div className="relative z-10 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/90">Total Earnings</p>
                  <h2 className="font-title-md text-3xl font-extrabold text-white">$1,240.50</h2>
                  <div className="flex items-center gap-1.5 pt-2 text-[10px]">
                    <span className="bg-white/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[10px]">trending_up</span> +12.4%
                    </span>
                    <span className="text-white/70">vs last month</span>
                  </div>
                </div>
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
              </section>

              {/* Milestone unlocked card details banner */}
              <div className="bg-[#f4dce4] rounded-xl p-3.5 flex items-center gap-3.5 border border-[#e4bdc2]/20">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-lg fill-icon">stars</span>
                </div>
                <div className="text-left">
                  <p className="text-xs text-[#111d23] font-bold leading-tight">1,000+ Followers reached!</p>
                  <p className="text-[9px] text-[#524249] leading-tight">Ads Enabled • Revenue sharing is active</p>
                </div>
              </div>

              {/* Ad Revenue interactive chart */}
              <section className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-[#111d23]">Ad Revenue History</h3>
                  <span className="material-symbols-outlined text-slate-400 text-sm hover:text-primary cursor-pointer">info</span>
                </div>

                {/* Performance Graph bar chart mock */}
                <div className="h-28 bg-[#f4faff] rounded-xl p-3 flex items-end justify-between overflow-hidden relative border border-slate-200/40">
                  <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none select-none">
                    <span className="text-sm font-bold tracking-widest italic">AURA</span>
                  </div>
                  {/* Bars representing weekly payout metrics */}
                  <div className="w-[8%] bg-primary/20 rounded-t-full h-[40%]" title="Week 1"></div>
                  <div className="w-[8%] bg-primary/30 rounded-t-full h-[65%]" title="Week 2"></div>
                  <div className="w-[8%] bg-primary/40 rounded-t-full h-[55%]" title="Week 3"></div>
                  <div className="w-[8%] bg-primary/60 rounded-t-full h-[80%]" title="Week 4"></div>
                  <div className="w-[8%] bg-primary/50 rounded-t-full h-[45%]" title="Week 5"></div>
                  <div className="w-[8%] bg-primary/80 rounded-t-full h-[90%]" title="Week 6"></div>
                  <div className="w-[8%] bg-primary rounded-t-full h-[100%]" title="Week 7"></div>
                  <div className="w-[8%] bg-primary/40 rounded-t-full h-[60%]" title="Week 8"></div>
                  <div className="w-[8%] bg-primary/20 rounded-t-full h-[30%]" title="Week 9"></div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-slate-100">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Impressions</p>
                    <p className="text-xs font-bold text-slate-800">42.8k</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">CPM</p>
                    <p className="text-xs font-bold text-slate-800">$4.12</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Share</p>
                    <p className="text-xs font-bold text-slate-800">45%</p>
                  </div>
                </div>
              </section>

              {/* Recent payouts history log */}
              <section className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-800">Recent Payouts</h3>
                  <button onClick={() => setPayoutModalOpen(true)} className="text-primary text-[10px] font-bold hover:underline cursor-pointer">
                    View All
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="bg-white border border-slate-100 flex items-center justify-between p-3.5 rounded-xl shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-base">account_balance_wallet</span>
                      </div>
                      <div className="text-left">
                        <p className="text-xs text-slate-800 font-bold leading-none">October Payout</p>
                        <p className="text-[9px] text-slate-400 mt-1">Oct 28, 2026</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-800 leading-none">$412.20</p>
                      <p className="text-[9px] font-bold text-green-600 mt-1 uppercase">Completed</p>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-100 flex items-center justify-between p-3.5 rounded-xl shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-base">account_balance_wallet</span>
                      </div>
                      <div className="text-left">
                        <p className="text-xs text-slate-800 font-bold leading-none">September Payout</p>
                        <p className="text-[9px] text-slate-400 mt-1">Sep 28, 2026</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-800 leading-none">$385.15</p>
                      <p className="text-[9px] font-bold text-green-600 mt-1 uppercase">Completed</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Request Payout trigger and state simulation */}
              <div className="pt-2">
                {payoutStatus === 'idle' ? (
                  <button
                    onClick={() => {
                      setPayoutStatus('loading');
                      setTimeout(() => setPayoutStatus('success'), 2000);
                    }}
                    className="w-full py-3 bg-primary text-white rounded-full font-bold shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 text-xs uppercase"
                  >
                    <span className="material-symbols-outlined text-base">payments</span>
                    <span>Request Payout</span>
                  </button>
                ) : payoutStatus === 'loading' ? (
                  <button className="w-full py-3 bg-primary/70 text-white rounded-full font-bold shadow-md cursor-not-allowed flex items-center justify-center gap-2 text-xs uppercase">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Processing Payout...</span>
                  </button>
                ) : (
                  <div className="w-full py-3.5 bg-green-100 text-green-800 rounded-xl border border-green-200 text-center font-bold text-xs">
                    ✓ Payout of $1,240.50 Requested successfully!
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== SCREEN: NOTIFICATIONS ==================== */}
          {currentScreen === 'notifications' && (
            <div className="px-6 pt-4 space-y-6 animate-fade-in pb-24 h-full overflow-y-auto scrollbar-hide">
              {/* Clear All button without header container */}
              <div className="flex justify-end pr-2">
                <button
                  onClick={() => {
                    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                  }}
                  className="text-primary text-[10px] font-bold uppercase tracking-wider hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>

              {/* Notification List */}
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                    <span className="material-symbols-outlined text-3xl">notifications_off</span>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-700">No Notifications</h3>
                    <p className="text-[10px] text-slate-400 font-normal">We'll alert you when someone follows you back or likes your posts.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notif) => {
                    const isMutual = isMutualFollower(notif.senderId);
                    return (
                      <div
                        key={notif.id}
                        onClick={() => {
                          setNotifications((prev) =>
                            prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
                          );
                        }}
                        className={`p-4 rounded-2xl border transition-all flex gap-3.5 relative overflow-hidden ${
                          notif.read
                            ? 'bg-white border-slate-100 shadow-sm'
                            : 'bg-rose-50/40 border-rose-100/40 shadow-sm ring-1 ring-rose-500/5'
                        }`}
                      >
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          <img
                            src={notif.senderPhoto}
                            alt={notif.senderName}
                            className="w-11 h-11 rounded-full object-cover border border-slate-100"
                          />
                          {!notif.read && (
                            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full border-2 border-white animate-pulse"></span>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 space-y-2">
                          <div className="space-y-0.5 text-left">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800 font-title-md">
                                {notif.senderName}
                              </span>
                              <span className="text-[8px] text-slate-400 font-medium">
                                {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[10.5px] text-slate-500 leading-relaxed font-normal">
                              {notif.message}
                            </p>
                          </div>

                          {/* Action buttons */}
                          {notif.type === 'follow' && (
                            <div className="flex items-center gap-2 pt-1">
                              {isMutual ? (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-50 text-green-700 text-[10px] font-bold">
                                  <span className="material-symbols-outlined text-[13px] font-bold">check_circle</span>
                                  <span>Mutual Connection!</span>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleFollowUser(notif.senderId);
                                    setMockFollowBacks((prev) => ({ ...prev, [notif.senderId]: true }));
                                    setNotifications((prev) =>
                                      prev.map((n) =>
                                        n.id === notif.id ? { ...n, read: true, canFollowBack: false } : n
                                      )
                                    );
                                  }}
                                  className="px-4 py-1.5 bg-primary text-white text-[10px] font-bold rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[12px]">favorite</span>
                                  <span>Follow Back</span>
                                </button>
                              )}
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const partner = STORIES.find((s) => s.id === notif.senderId) || {
                                    id: notif.senderId,
                                    name: notif.senderName,
                                    photo: notif.senderPhoto,
                                    username: notif.senderUsername
                                  };
                                  setSelectedChatPartner(partner);
                                  navigateTo('chat');
                                }}
                                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[10px] font-bold rounded-xl border border-slate-200/50 active:scale-95 transition-all cursor-pointer"
                              >
                                View Chat
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ==================== 14. SCREEN: AURA GOLD PLAN ==================== */}
          {currentScreen === 'aura_gold' && (
            <div className="absolute inset-0 bg-[#263238] text-white flex flex-col justify-between py-12 px-6 overflow-y-auto scrollbar-hide animate-fade-in z-20">
              {/* Header */}
              <header className="flex justify-between items-center w-full pb-4">
                <button onClick={() => navigateTo('edit_profile')} className="text-primary-fixed active:scale-90">
                  <span className="material-symbols-outlined text-white">arrow_back</span>
                </button>
                <h1 className="font-title-md text-sm text-[#ffb2be] tracking-[0.25em] font-extrabold uppercase">AURA GOLD</h1>
                <button onClick={() => alert("Help and explanations can be found in our VIP Guide.")} className="text-primary-fixed active:scale-90">
                  <span className="material-symbols-outlined text-white">help_outline</span>
                </button>
              </header>

              {/* Hero */}
              <section className="text-center space-y-1 my-2">
                <h1 className="font-title-md text-2xl rose-gold-text font-extrabold">Elevate Your Connection</h1>
                <p className="text-slate-300 text-xs px-2 leading-relaxed">
                  Experience Aura without limits. Designed for those who value depth and exclusivity.
                </p>
              </section>

              {/* Premium features bento grid */}
              <section className="grid grid-cols-2 gap-3.5 my-4">
                <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-4 text-center space-y-2 flex flex-col items-center">
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary-fixed">
                    <span className="material-symbols-outlined text-xl fill-icon">auto_awesome</span>
                  </div>
                  <h3 className="font-title-md text-xs text-[#ffb2be] font-bold">Unlimited Sparks</h3>
                  <p className="text-[9px] text-slate-300 leading-normal">Ignite conversations without daily caps.</p>
                </div>

                <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-4 text-center space-y-2 flex flex-col items-center">
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary-fixed">
                    <span className="material-symbols-outlined text-xl fill-icon">favorite</span>
                  </div>
                  <h3 className="font-title-md text-xs text-[#ffb2be] font-bold">See Who Liked You</h3>
                  <p className="text-[9px] text-slate-300 leading-normal">No more guessing. View your secret admirers.</p>
                </div>

                <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-4 text-center space-y-2 flex flex-col items-center">
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary-fixed">
                    <span className="material-symbols-outlined text-xl">tune</span>
                  </div>
                  <h3 className="font-title-md text-xs text-[#ffb2be] font-bold">Advanced Filters</h3>
                  <p className="text-[9px] text-slate-300 leading-normal">Refine your search with elite criteria.</p>
                </div>

                <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-4 text-center space-y-2 flex flex-col items-center">
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary-fixed">
                    <span className="material-symbols-outlined text-xl fill-icon">bolt</span>
                  </div>
                  <h3 className="font-title-md text-xs text-[#ffb2be] font-bold">Profile Boost</h3>
                  <p className="text-[9px] text-slate-300 leading-normal">Be seen by 10x more people in your area.</p>
                </div>
              </section>

              {/* Plans selector details */}
              <section className="space-y-3">
                <h4 className="text-center text-[#ffb2be] font-bold text-xs uppercase tracking-widest">Choose Your Journey</h4>

                {/* Yearly */}
                <div
                  onClick={() => setSelectedPlan('yearly')}
                  className={`bg-white/5 p-4.5 rounded-2xl relative cursor-pointer border transition-all duration-300 ${
                    selectedPlan === 'yearly'
                      ? 'border-[#ffb2be] ring-1 ring-[#ffb2be] scale-[1.01]'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="absolute -top-2.5 right-4 bg-primary text-white text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    SAVE 45%
                  </div>
                  <div className="flex justify-between items-center text-left">
                    <div>
                      <h4 className="text-xs font-extrabold text-white">Yearly Plan</h4>
                      <p className="text-[9px] text-slate-400">Billed annually</p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-extrabold text-[#ffb2be]">$99.99</span>
                      <span className="text-[9px] block opacity-60">≈ $8.33/mo</span>
                    </div>
                  </div>
                </div>

                {/* Monthly */}
                <div
                  onClick={() => setSelectedPlan('monthly')}
                  className={`bg-white/5 p-4.5 rounded-2xl relative cursor-pointer border transition-all duration-300 ${
                    selectedPlan === 'monthly'
                      ? 'border-[#ffb2be] ring-1 ring-[#ffb2be] scale-[1.01]'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="flex justify-between items-center text-left">
                    <div>
                      <h4 className="text-xs font-extrabold text-white">Monthly Plan</h4>
                      <p className="text-[9px] text-slate-400">Cancel anytime</p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-extrabold text-[#ffb2be]">$14.99</span>
                      <span className="text-[9px] block opacity-60">per month</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* CTA upgrades button trigger */}
              <section className="text-center pt-4 space-y-3">
                <button
                  onClick={() => {
                    setGoldShadowSuccess(true);
                    setGoldUser(true);
                  }}
                  className="glow-button w-full py-3.5 bg-primary text-white font-bold rounded-2xl text-xs uppercase"
                >
                  Upgrade to Gold
                </button>

                <div className="flex items-center justify-center gap-1.5 text-[9px] text-slate-400">
                  <span className="material-symbols-outlined text-xs">lock</span>
                  <p>Safe, secure & private transactions</p>
                </div>

                <p className="text-[8px] text-slate-500 leading-normal px-2">
                  Subscription automatically renews for the same price and duration period until you cancel in settings. By tapping 'Upgrade', your payment will be charged to your store account. You agree to our Terms and Privacy Policy.
                </p>
              </section>

              {/* Success celebration gold modal */}
              {goldSuccess && (
                <div className="fixed inset-0 bg-[#263238] z-[1000] flex items-center justify-center p-8 animate-fade-in text-center">
                  <div className="space-y-6">
                    <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto shadow-2xl animate-float">
                      <span className="material-symbols-outlined text-[#ffb2be] text-4xl fill-icon">star</span>
                    </div>
                    <div className="space-y-2">
                      <h2 className="font-title-md text-2xl text-[#ffb2be] font-extrabold">Welcome to Gold</h2>
                      <p className="text-xs text-slate-300">Your premium journey starts now.</p>
                    </div>
                    <button
                      onClick={() => {
                        setGoldShadowSuccess(false);
                        navigateTo('discover');
                      }}
                      className="bg-primary text-white px-8 py-3 rounded-full text-xs font-bold uppercase active:scale-95 shadow-lg"
                    >
                      Start Exploring
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Voice/Video Calling Overlay Screen */}
        {activeCall && (
          <div className="absolute inset-0 z-[200] bg-slate-900 flex flex-col justify-between py-16 px-8 text-white animate-fade-in">
            {/* Background Image blur for Voice Calls or Viewfinder simulation for Video Calls */}
            {activeCall.type === 'video' && activeCall.status === 'connected' ? (
              <div className="absolute inset-0 z-0 bg-black overflow-hidden">
                <div className="absolute inset-0 bg-cover bg-center opacity-60 filter blur-xs" style={{ backgroundImage: `url(${activeCall.partner.photo})` }}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-slate-950"></div>
                <div className="absolute bottom-32 right-6 w-24 h-36 bg-slate-800 border-2 border-white/20 rounded-2xl overflow-hidden shadow-2xl z-20">
                  <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(${userProfile.photos[0] || IMAGES.primaryOnboardingPic})` }}></div>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[7px] bg-black/60 px-1 py-0.5 rounded text-white whitespace-nowrap">You</div>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-cover bg-center scale-110 filter blur-xl opacity-30" style={{ backgroundImage: `url(${activeCall.partner.photo})` }}></div>
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950"></div>
              </div>
            )}

            {/* Top header details */}
            <div className="relative z-10 text-center space-y-2 mt-4">
              <span className="bg-white/10 text-primary-fixed border border-white/5 text-[9px] font-extrabold uppercase px-3 py-1 rounded-full tracking-[0.2em]">
                {activeCall.type === 'video' ? 'Aura High-Def Video' : 'Aura Secure Voice'}
              </span>
              <h2 className="font-title-md text-2xl font-extrabold">{activeCall.partner.name}</h2>
              <p className="text-xs text-slate-400 font-medium font-mono">
                {activeCall.status === 'ringing' ? 'Ringing...' : (
                  <span>
                    Connected • {Math.floor(activeCall.duration / 60).toString().padStart(2, '0')}:
                    {(activeCall.duration % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </p>
            </div>

            {/* Center avatar representation */}
            {!(activeCall.type === 'video' && activeCall.status === 'connected') && (
              <div className="relative z-10 flex justify-center py-6">
                <div className="relative">
                  {activeCall.status === 'ringing' && (
                    <>
                      <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping scale-125"></div>
                      <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping scale-150"></div>
                    </>
                  )}
                  <div className="w-28 h-28 rounded-full border-4 border-white/10 overflow-hidden shadow-2xl relative z-10">
                    <img src={activeCall.partner.photo} className="w-full h-full object-cover" alt="Call recipient" />
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Controls panel */}
            <div className="relative z-10 flex flex-col items-center space-y-6 mb-4">
              <div className="flex items-center gap-6">
                {/* Mute Button */}
                <button
                  onClick={() => {
                    setIsMuted(!isMuted);
                    showToast(isMuted ? 'Microphone unmuted' : 'Microphone muted', 'info');
                  }}
                  className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all active:scale-90 ${
                    isMuted ? 'bg-red-500 border-red-500 text-white' : 'bg-white/10 border-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">{isMuted ? 'mic_off' : 'mic'}</span>
                </button>

                {/* Speaker Button */}
                <button
                  onClick={() => {
                    setIsSpeaker(!isSpeaker);
                    showToast(isSpeaker ? 'Speaker mode disabled' : 'Speaker mode enabled', 'info');
                  }}
                  className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all active:scale-90 ${
                    isSpeaker ? 'bg-[#ffb2be] border-[#ffb2be] text-[#400014]' : 'bg-white/10 border-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">{isSpeaker ? 'volume_up' : 'volume_down'}</span>
                </button>
              </div>

              {/* End Call Button */}
              <button
                onClick={() => {
                  trackUserAction('call_ended', JSON.stringify({ partnerId: activeCall.partner.id, durationSeconds: activeCall.duration }));
                  setActiveCall(null);
                  showToast('Call ended', 'info');
                }}
                className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-lg hover:shadow-red-900/30 active:scale-90 transition-transform cursor-pointer"
              >
                <span className="material-symbols-outlined text-2xl text-white">call_end</span>
              </button>
            </div>
          </div>
        )}

        {/* Global Bottom Sticky Tab Bar (For feed contexts only: stories, discover, chat, edit_profile, creator_monetization) */}
        {['discover', 'stories', 'edit_profile', 'chat', 'notifications'].includes(currentScreen) && (
          <nav className="absolute bottom-0 left-0 w-full z-40 bg-white/95 backdrop-blur-md h-[72px] flex justify-around items-center border-t border-slate-100 px-4 select-none pb-4">
            <button
              onClick={() => navigateTo('stories')}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 ${
                currentScreen === 'stories' ? 'text-primary scale-105' : 'text-slate-400 hover:text-primary'
              }`}
            >
              <span className={`material-symbols-outlined text-[22px] ${currentScreen === 'stories' ? 'fill-icon' : ''}`}>home</span>
              <span className="text-[9px] font-bold leading-none mt-0.5">Home</span>
            </button>

            <button
              onClick={() => navigateTo('discover')}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 ${
                currentScreen === 'discover' ? 'text-primary scale-105' : 'text-slate-400 hover:text-primary'
              }`}
            >
              <span className={`material-symbols-outlined text-[22px] ${currentScreen === 'discover' ? 'fill-icon' : ''}`}>explore</span>
              <span className="text-[9px] font-bold leading-none mt-0.5">Discover</span>
            </button>

            <button
              onClick={() => navigateTo('chat')}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 relative ${
                currentScreen === 'chat' ? 'text-primary scale-105' : 'text-slate-400 hover:text-primary'
              }`}
            >
              <span className={`material-symbols-outlined text-[22px] ${currentScreen === 'chat' ? 'fill-icon' : ''}`}>chat_bubble</span>
              <span className="text-[9px] font-bold leading-none mt-0.5">Chat</span>
              <span className="absolute top-1 right-6 w-2 h-2 rounded-full bg-primary animate-ping"></span>
            </button>

            <button
              onClick={() => navigateTo('notifications')}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 relative ${
                currentScreen === 'notifications' ? 'text-primary scale-105' : 'text-slate-400 hover:text-primary'
              }`}
            >
              <span className={`material-symbols-outlined text-[22px] ${currentScreen === 'notifications' ? 'fill-icon' : ''}`}>notifications</span>
              <span className="text-[9px] font-bold leading-none mt-0.5">Alerts</span>
              {(() => {
                const count = notifications.filter(n => !n.read).length;
                return count > 0 ? (
                  <span className="absolute top-1 right-6 bg-primary text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center">
                    {count}
                  </span>
                ) : null;
              })()}
            </button>

            <button
              onClick={() => navigateTo('edit_profile')}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 ${
                currentScreen === 'edit_profile' ? 'text-primary scale-105' : 'text-slate-400 hover:text-primary'
              }`}
            >
              <span className={`material-symbols-outlined text-[22px] ${currentScreen === 'edit_profile' ? 'fill-icon' : ''}`}>person</span>
              <span className="text-[9px] font-bold leading-none mt-0.5">Profile</span>
            </button>
          </nav>
        )}

        {/* Guest Action Warning Modal */}
        {guestWarningModal && (
          <div className="absolute inset-0 bg-[#0f172a]/85 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-white rounded-3xl p-6 text-center space-y-5 max-w-[320px] shadow-2xl border border-rose-100/20">
              <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mx-auto text-primary">
                <span className="material-symbols-outlined text-3xl">block</span>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-title-md text-base font-extrabold text-[#111d23]">
                  {guestWarningModal === 'profile' && 'Profile Creation Locked'}
                  {guestWarningModal === 'like' && 'Liking is Disabled'}
                  {guestWarningModal === 'message' && 'Messaging is Locked'}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {guestWarningModal === 'profile' && 'Guests cannot create, edit, or customize a profile. Please register to build your unique presence!'}
                  {guestWarningModal === 'like' && 'Guests can only explore. To like profiles, send Spark requests, or make matches, please register!'}
                  {guestWarningModal === 'message' && 'Guests cannot chat or send messages. Both users must follow each other to unlock chats!'}
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => {
                    setGuestWarningModal(null);
                    setIsGuest(false);
                    setCurrentScreen('welcome');
                  }}
                  className="w-full py-3 bg-primary text-white font-bold rounded-xl text-xs uppercase hover:brightness-110 transition-all active:scale-95 shadow-md"
                >
                  Sign In / Create Account
                </button>
                <button
                  onClick={() => setGuestWarningModal(null)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase transition-all active:scale-95"
                >
                  Keep Exploring as Guest
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Ad Simulation Overlay */}
        {watchingAd && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-[1000] flex flex-col items-center justify-center text-white p-6 animate-fade-in text-center">
            <div className="relative w-72 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center animate-bounce">
                <span className="material-symbols-outlined text-4xl">play_circle</span>
              </div>
              <div className="space-y-1">
                <h3 className="font-title-md text-base font-bold text-white">Sponsor Advertisement</h3>
                <p className="text-[11px] text-slate-400">Please watch the ad to claim your reward...</p>
              </div>
              
              {/* Simulated Video Player Box */}
              <div className="w-full aspect-video bg-black rounded-2xl flex flex-col items-center justify-center border border-slate-800 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-rose-500/10 to-primary/10 animate-pulse"></div>
                <span className="material-symbols-outlined text-3xl text-slate-700 animate-spin">sync</span>
                <span className="text-[10px] text-slate-400 mt-2 font-mono">Simulating video playback...</span>
              </div>

              <div className="w-full space-y-2">
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="bg-amber-500 h-full transition-all duration-1000 ease-linear" 
                    style={{ width: `${((2 - adTimeLeft) / 2) * 100}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-bold font-mono">
                  <span>Reward in:</span>
                  <span>{adTimeLeft}s</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Creator Statement Modal */}
        {payoutModalOpen && (
          <div className="absolute inset-0 bg-[#0f172a]/85 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-[28px] w-full max-w-[340px] p-5 shadow-2xl border border-slate-100 flex flex-col space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="font-title-md text-base font-extrabold text-[#111d23]">Aura Creator Statement</h3>
                <button
                  onClick={() => setPayoutModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 active:scale-90 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm font-bold">close</span>
                </button>
              </div>

              <div className="space-y-3.5 max-h-[320px] overflow-y-auto pr-1 text-left scrollbar-hide">
                <div className="bg-purple-50 p-3 rounded-2xl border border-purple-100/50 space-y-1">
                  <span className="text-[9px] font-bold text-primary uppercase tracking-wider">Unreleased Earnings</span>
                  <p className="text-xl font-extrabold text-primary">$182.40</p>
                  <p className="text-[8px] text-slate-400 font-medium font-mono">Next distribution scheduled for Nov 28, 2026</p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Historical Earnings Log</h4>
                  
                  <div className="space-y-1.5 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100/50 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-700">October CPM share</p>
                        <p className="text-[9px] text-slate-400 font-mono">Completed Oct 28</p>
                      </div>
                      <span className="font-bold text-slate-800">$412.20</span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100/50 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-700">September Spark Referrals</p>
                        <p className="text-[9px] text-slate-400 font-mono">Completed Sep 28</p>
                      </div>
                      <span className="font-bold text-slate-800">$180.00</span>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100/50 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-700">August Creator Boost</p>
                        <p className="text-[9px] text-slate-400 font-mono">Completed Aug 28</p>
                      </div>
                      <span className="font-bold text-slate-800">$295.50</span>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100/50 flex gap-2 items-start">
                  <span className="material-symbols-outlined text-sm text-amber-600 fill-icon mt-0.5">verified_user</span>
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold text-amber-800">Creator Protection Enabled</p>
                    <p className="text-[8px] text-slate-500 leading-normal">Your payouts are protected using industry-grade multi-layer encryption and verified against invalid traffic clicks.</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  showToast("📄 Statement downloaded successfully!", "success");
                  setPayoutModalOpen(false);
                }}
                className="w-full py-3 bg-[#111d23] text-white font-bold rounded-xl text-xs uppercase hover:bg-black transition-all active:scale-95 shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">download</span>
                <span>Download Statement</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
