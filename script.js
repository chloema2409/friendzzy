const quizKey = "bestieQuizQuestions";
const savedQuizzesKey = "bestieSavedQuizzes";
const leaderboardKey = "bestieQuizLeaderboard";
const quizLeaderboardsKey = "bestieQuizLeaderboardsByQuiz";
const onlineQuizProvider = "Supabase";
const supabaseUrl = window.FRIENDZZY_SUPABASE_URL || "https://henagvofjujsksuuuhfe.supabase.co";
const supabasePublishableKey = window.FRIENDZZY_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_u54a7Fx1Dz7fxP_FjSmTGw_Eb_uSfM0";
const starLeaderboardKey = "bestieStarLeaderboard";
const gameLeaderboardsKey = "bestieGameLeaderboards";
const guestStarNicknameKey = "bestieStarLeaderboardGuestNickname";
const usedNicknamesKey = "bestieUsedNicknames";
const playerProfilesKey = "bestieQuizPlayerProfiles";
const currentPlayerKey = "bestieQuizCurrentPlayer";
const guestStarsKey = "bestieQuizGuestStars";
const guestRewardsKey = "bestieQuizGuestRewards";
const guestDiaryKey = "bestieQuizGuestDiaryNotes";
const diaryEntriesKey = "bestieDiaryEntries";
const activeThemeKey = "bestieQuizActiveTheme";
const friendChatKey = "bestieFriendChatMessages";
const friendActivityKey = "bestieFriendActivity";
const friendRewardLogKey = "bestieFriendRewardLog";
const boxOfLiesRoundsKey = "friendzzyBoxOfLiesRounds";
const tradingInventoryKey = "friendzzyTradingInventory";
const tradingTradesKey = "friendzzyTradingTrades";
const tradingAppliedTradesKey = "friendzzyTradingAppliedTrades";
const supabaseAuthSessionKey = "friendzzySupabaseAuthSession";
const minQuestions = 5;
const maxQuestions = 30;
const maxLeaderboardEntries = 10;
const friendOnlineWindowMs = 5 * 60 * 1000;
const presenceUpdateIntervalMs = 60 * 1000;
const boxOfLiesInviteExpiryMs = 24 * 60 * 60 * 1000;
const tradingOfferExpiryMs = 72 * 60 * 60 * 1000;

const shopCategories = ["Diary", "Themes", "Games", "Profile"];
let activeShopCategory = shopCategories[0];

function isSupabaseConfigured() {
  return Boolean(
    supabaseUrl
    && supabasePublishableKey
    && supabaseUrl.startsWith("https://")
    && supabasePublishableKey.startsWith("sb_publishable_")
  );
}

function getSupabaseAuthSession() {
  const savedSession = localStorage.getItem(supabaseAuthSessionKey);

  if (!savedSession) {
    return null;
  }

  try {
    const session = JSON.parse(savedSession);
    return session?.access_token ? session : null;
  } catch {
    return null;
  }
}

function saveSupabaseAuthSession(session) {
  if (!session?.access_token) {
    return;
  }

  const expiresAt = session.expires_at || Math.floor(Date.now() / 1000) + (session.expires_in || 3600);
  localStorage.setItem(supabaseAuthSessionKey, JSON.stringify({
    ...session,
    expires_at: expiresAt,
  }));
}

function clearSupabaseAuthSession() {
  localStorage.removeItem(supabaseAuthSessionKey);
}

function getSupabaseAccessToken() {
  return getSupabaseAuthSession()?.access_token || "";
}

function getSupabaseAuthUser() {
  return getSupabaseAuthSession()?.user || null;
}

async function supabaseAuthRequest(path, { method = "POST", body = null, token = "" } = {}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase URL or publishable key is missing.");
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/${path}`, {
    method,
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${token || supabasePublishableKey}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`Supabase Auth request failed: ${response.status} ${response.statusText}. ${rawText || "No response body."}`);
  }

  return rawText ? JSON.parse(rawText) : null;
}

async function supabaseRequest(path, { method = "GET", body = null, prefer = "", auth = false } = {}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase URL or publishable key is missing.");
  }

  const bearerToken = auth ? getSupabaseAccessToken() : supabasePublishableKey;

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${bearerToken || supabasePublishableKey}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status} ${response.statusText}. ${rawText || "No response body."}`);
  }

  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch (error) {
    console.error("Supabase returned non-JSON response:", {
      status: response.status,
      statusText: response.statusText,
      rawText,
    });
    throw error;
  }
}

const onlineQuizSharing = {
  get isConfigured() {
    return isSupabaseConfigured();
  },
  async saveQuiz(quiz) {
    await supabaseRequest("quizzes", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        quiz_id: quiz.quizId,
        title: quiz.title,
        theme: quiz.theme,
        questions_json: quiz.questions,
        creator_nickname: quiz.creatorNickname || null,
      },
    });
  },
  async loadQuiz(quizId) {
    const query = new URLSearchParams({
      select: "quiz_id,title,theme,questions_json,creator_nickname,created_at",
      quiz_id: `eq.${quizId}`,
      limit: "1",
    });
    const data = await supabaseRequest(`quizzes?${query.toString()}`);
    const quiz = Array.isArray(data) ? data[0] : null;

    return quiz ? {
      quizId: quiz.quiz_id,
      title: quiz.title,
      theme: quiz.theme,
      questions: quiz.questions_json,
      creatorNickname: quiz.creator_nickname,
      createdAt: quiz.created_at,
    } : null;
  },
  async saveScore(score) {
    await supabaseRequest("quiz_scores", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        quiz_id: score.quizId,
        nickname: score.nickname,
        score_percent: score.scorePercent,
        correct_answers: score.correctAnswers,
        total_questions: score.totalQuestions,
        result_message: score.resultMessage,
      },
    });
  },
  async loadScores(quizId) {
    const query = new URLSearchParams({
      select: "id,nickname,score_percent,correct_answers,total_questions,result_message,created_at",
      quiz_id: `eq.${quizId}`,
      order: "score_percent.desc,created_at.asc",
      limit: String(maxLeaderboardEntries),
    });
    const data = await supabaseRequest(`quiz_scores?${query.toString()}`);

    return (data || []).map((entry) => ({
      id: entry.id,
      nickname: entry.nickname,
      avatar: null,
      scorePercentage: entry.score_percent,
      correctAnswers: entry.correct_answers,
      totalQuestions: entry.total_questions,
      message: entry.result_message,
      quizId,
      createdAt: new Date(entry.created_at).getTime(),
    }));
  },
};
window.bestieOnlineQuizSharing = onlineQuizSharing;

function normalizeOnlineFriendProfile(profile) {
  if (!profile) {
    return null;
  }

  const friendCode = normalizeFriendCode(profile.friend_code || profile.friendCode || "");
  const emojiAvatar = profile.emoji_avatar || profile.emojiAvatar || profile.avatar?.emojiAvatar || defaultEmojiAvatar;

  if (!friendCode) {
    return null;
  }

  return {
    userId: profile.user_id || profile.userId || "",
    nickname: profile.nickname || "Friend",
    friendCode,
    stars: Number.parseInt(profile.stars || "0", 10) || 0,
    lastSeenAt: profile.last_seen_at
      ? new Date(profile.last_seen_at).getTime()
      : profile.lastSeenAt || (profile.updated_at ? new Date(profile.updated_at).getTime() : 0),
    avatar: {
      ...createDefaultAvatar(),
      ...(profile.avatar || {}),
      emojiAvatar,
    },
  };
}

const onlineFriendCodes = {
  get isConfigured() {
    return isSupabaseConfigured();
  },
  async saveProfile(profile) {
    const safeProfile = ensureFriendProfile(profile);
    const avatar = getUnlockedAvatar(safeProfile.avatar || createDefaultAvatar());

    return supabaseRequest("profiles?on_conflict=friend_code", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: {
        ...((safeProfile.userId || onlineAccountStorage.isLoggedIn) ? { user_id: safeProfile.userId || onlineAccountStorage.userId } : {}),
        nickname: safeProfile.nickname,
        normalized_nickname: normalizeNickname(safeProfile.nickname),
        emoji_avatar: avatar.emojiAvatar || defaultEmojiAvatar,
        friend_code: normalizeFriendCode(safeProfile.friendCode),
        stars: safeProfile.stars || 0,
        updated_at: new Date().toISOString(),
      },
    });
  },
  async findProfileByFriendCode(friendCode) {
    const query = new URLSearchParams({
      select: "user_id,nickname,normalized_nickname,emoji_avatar,friend_code,stars,active_theme,created_at,updated_at",
      friend_code: `eq.${normalizeFriendCode(friendCode)}`,
      limit: "1",
    });
    const data = await supabaseRequest(`profiles?${query.toString()}`);
    return normalizeOnlineFriendProfile(Array.isArray(data) ? data[0] : null);
  },
  async saveFriend(ownerProfile, friendProfile) {
    const safeOwner = normalizeOnlineFriendProfile(ownerProfile);
    const safeFriend = normalizeOnlineFriendProfile(friendProfile);

    if (!safeOwner || !safeFriend || safeOwner.friendCode === safeFriend.friendCode) {
      return null;
    }

    return supabaseRequest("friends?on_conflict=owner_friend_code,friend_friend_code", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: [
        {
          owner_user_id: safeOwner.userId || null,
          friend_user_id: safeFriend.userId || null,
          owner_friend_code: safeOwner.friendCode,
          friend_friend_code: safeFriend.friendCode,
          friend_nickname: safeFriend.nickname,
          friend_emoji_avatar: safeFriend.avatar?.emojiAvatar || defaultEmojiAvatar,
        },
        {
          owner_user_id: safeFriend.userId || null,
          friend_user_id: safeOwner.userId || null,
          owner_friend_code: safeFriend.friendCode,
          friend_friend_code: safeOwner.friendCode,
          friend_nickname: safeOwner.nickname,
          friend_emoji_avatar: safeOwner.avatar?.emojiAvatar || defaultEmojiAvatar,
        },
      ],
    });
  },
  async loadFriends(ownerFriendCode) {
    const safeOwnerCode = normalizeFriendCode(ownerFriendCode);
    const outgoingQuery = new URLSearchParams({
      select: "friend_user_id,friend_friend_code,friend_nickname,friend_emoji_avatar,created_at",
      owner_friend_code: `eq.${safeOwnerCode}`,
      order: "created_at.desc",
    });
    const incomingQuery = new URLSearchParams({
      select: "owner_user_id,owner_friend_code,created_at",
      friend_friend_code: `eq.${safeOwnerCode}`,
      order: "created_at.desc",
    });
    const [outgoingRows, incomingRows] = await Promise.all([
      supabaseRequest(`friends?${outgoingQuery.toString()}`),
      supabaseRequest(`friends?${incomingQuery.toString()}`),
    ]);
    const friendProfiles = [];

    for (const friend of outgoingRows || []) {
      const latestProfile = await onlineFriendCodes.findProfileByFriendCode(friend.friend_friend_code).catch(() => null);
      friendProfiles.push(latestProfile || normalizeOnlineFriendProfile({
        nickname: friend.friend_nickname,
        friend_code: friend.friend_friend_code,
        emoji_avatar: friend.friend_emoji_avatar,
      }));
    }

    for (const friend of incomingRows || []) {
      const latestProfile = await onlineFriendCodes.findProfileByFriendCode(friend.owner_friend_code).catch(() => null);
      friendProfiles.push(latestProfile || normalizeOnlineFriendProfile({
        friend_code: friend.owner_friend_code,
      }));
    }

    const friendsByCode = new Map();
    friendProfiles.filter(Boolean).forEach((friendProfile) => {
      if (friendProfile.friendCode !== safeOwnerCode) {
        friendsByCode.set(friendProfile.friendCode, friendProfile);
      }
    });

    return [...friendsByCode.values()];
  },
};
window.bestieOnlineFriendCodes = onlineFriendCodes;

function normalizeOnlineMessage(message) {
  if (!message) {
    return null;
  }

  return {
    id: message.id || crypto.randomUUID(),
    chatId: message.conversation_id || message.chatId || "",
    senderUserId: message.sender_user_id || message.senderUserId || "",
    receiverUserId: message.receiver_user_id || message.receiverUserId || "",
    senderCode: normalizeFriendCode(message.sender_friend_code || message.senderCode || ""),
    receiverCode: normalizeFriendCode(message.receiver_friend_code || message.receiverCode || ""),
    senderNickname: message.sender_nickname || message.senderNickname || "Friend",
    receiverNickname: message.receiver_nickname || message.receiverNickname || "Friend",
    text: message.message_text || message.text || "",
    type: message.message_type || message.type || "typed",
    sticker: message.sticker || "",
    quizInvite: {
      quizId: message.quiz_id || message.quizId || message.quizInvite?.quizId || "",
      quizTitle: message.quiz_title || message.quizTitle || message.quizInvite?.quizTitle || "",
      quizLink: message.quiz_link || message.quizLink || message.quizInvite?.quizLink || "",
      questionCount: Number.parseInt(message.quiz_question_count || message.quizQuestionCount || message.quizInvite?.questionCount || "0", 10) || 0,
    },
    gameData: message.game_data || message.gameData || {},
    createdAt: message.created_at ? new Date(message.created_at).getTime() : message.createdAt || Date.now(),
    readAt: message.read_at || message.readAt || null,
  };
}

const onlineFriendMessages = {
  get isConfigured() {
    return isSupabaseConfigured();
  },
  async saveMessage(message) {
    const safeMessage = normalizeOnlineMessage(message);

    if (!safeMessage?.chatId || !safeMessage.senderCode || !safeMessage.receiverCode || !safeMessage.text) {
      throw new Error("Message is missing required chat fields.");
    }

    const data = await supabaseRequest("messages", {
      method: "POST",
      auth: onlineAccountStorage.isLoggedIn,
      prefer: "return=representation",
      body: {
        conversation_id: safeMessage.chatId,
        sender_user_id: activePlayer?.userId || (onlineAccountStorage.isLoggedIn ? onlineAccountStorage.userId : null),
        receiver_user_id: getFriendProfileSnapshot(safeMessage.receiverCode).userId || null,
        sender_friend_code: safeMessage.senderCode,
        receiver_friend_code: safeMessage.receiverCode,
        sender_nickname: safeMessage.senderNickname,
        sender_emoji_avatar: activePlayer?.avatar?.emojiAvatar || defaultEmojiAvatar,
        receiver_nickname: safeMessage.receiverNickname,
        receiver_emoji_avatar: getFriendProfileSnapshot(safeMessage.receiverCode).avatar?.emojiAvatar || defaultEmojiAvatar,
        message_text: safeMessage.text,
        message_type: safeMessage.type,
        sticker: safeMessage.sticker,
        ...(safeMessage.type === "quiz_invite" ? {
          quiz_id: safeMessage.quizInvite?.quizId || null,
          quiz_title: safeMessage.quizInvite?.quizTitle || null,
          quiz_link: safeMessage.quizInvite?.quizLink || null,
          quiz_question_count: safeMessage.quizInvite?.questionCount || null,
        } : {}),
        ...(["box_of_lies_invite", "trading_game_offer"].includes(safeMessage.type) && Object.keys(safeMessage.gameData || {}).length > 0 ? {
          game_data: safeMessage.gameData,
        } : {}),
      },
    });

    return normalizeOnlineMessage(Array.isArray(data) ? data[0] : null) || safeMessage;
  },
  async loadMessages(conversationId) {
    const query = new URLSearchParams({
      select: "*",
      conversation_id: `eq.${conversationId}`,
      order: "created_at.asc",
    });
    const data = await supabaseRequest(`messages?${query.toString()}`, { auth: onlineAccountStorage.isLoggedIn });

    return (data || []).map(normalizeOnlineMessage).filter(Boolean);
  },
};
window.bestieOnlineFriendMessages = onlineFriendMessages;

function normalizeOnlineGamePayload(record) {
  if (!record) {
    return null;
  }

  const payload = record.payload || record.gamePayload || {};
  const inviteId = record.invite_id || record.inviteId || payload.id || "";
  const gameType = record.game_type || record.gameType || payload.gameType || "";

  if (!inviteId || !gameType) {
    return null;
  }

  return {
    ...payload,
    id: inviteId,
    gameType,
    fromFriendCode: normalizeFriendCode(record.from_friend_code || record.fromFriendCode || payload.fromFriendCode || ""),
    toFriendCode: normalizeFriendCode(record.to_friend_code || record.toFriendCode || payload.toFriendCode || ""),
    status: record.status || payload.status || "pending",
    createdAt: record.created_at ? new Date(record.created_at).getTime() : payload.createdAt || Date.now(),
    updatedAt: record.updated_at ? new Date(record.updated_at).getTime() : payload.updatedAt || Date.now(),
    completedAt: record.completed_at ? new Date(record.completed_at).getTime() : payload.completedAt || null,
  };
}

function normalizeOnlineInventoryRow(row) {
  if (!row) {
    return null;
  }

  return {
    friendCode: normalizeFriendCode(row.friend_code || row.friendCode || ""),
    items: normalizeTradingItems(row.inventory_json || row.inventoryJson || row.items || []),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : row.updatedAt || Date.now(),
  };
}

const onlineFriendGames = {
  get isConfigured() {
    return isSupabaseConfigured();
  },
  async saveGame(gameRecord) {
    const payload = normalizeOnlineGamePayload(gameRecord);

    if (!payload?.id || !payload.gameType || !payload.fromFriendCode || !payload.toFriendCode) {
      throw new Error("Game record is missing required fields.");
    }

    await supabaseRequest("game_invites?on_conflict=invite_id", {
      method: "POST",
      auth: onlineAccountStorage.isLoggedIn,
      prefer: "resolution=merge-duplicates,return=minimal",
      body: {
        invite_id: payload.id,
        game_type: payload.gameType,
        from_friend_code: payload.fromFriendCode,
        to_friend_code: payload.toFriendCode,
        status: payload.status || "pending",
        payload,
        updated_at: new Date(payload.updatedAt || Date.now()).toISOString(),
        completed_at: payload.completedAt ? new Date(payload.completedAt).toISOString() : null,
      },
    });

    return payload;
  },
  async loadGame(inviteId) {
    const query = new URLSearchParams({
      select: "invite_id,game_type,from_friend_code,to_friend_code,status,payload,created_at,updated_at,completed_at",
      invite_id: `eq.${inviteId}`,
      limit: "1",
    });
    const data = await supabaseRequest(`game_invites?${query.toString()}`, { auth: onlineAccountStorage.isLoggedIn });
    return normalizeOnlineGamePayload(Array.isArray(data) ? data[0] : null);
  },
  async loadGamesForPlayer(friendCode) {
    const safeFriendCode = normalizeFriendCode(friendCode);

    if (!safeFriendCode) {
      return [];
    }

    const query = new URLSearchParams({
      select: "invite_id,game_type,from_friend_code,to_friend_code,status,payload,created_at,updated_at,completed_at",
      order: "updated_at.desc",
      limit: "80",
    });
    query.set("or", `(from_friend_code.eq.${safeFriendCode},to_friend_code.eq.${safeFriendCode})`);
    const data = await supabaseRequest(`game_invites?${query.toString()}`, { auth: onlineAccountStorage.isLoggedIn });
    return (data || []).map(normalizeOnlineGamePayload).filter(Boolean);
  },
  async saveInventory(friendCode, items) {
    const safeFriendCode = normalizeFriendCode(friendCode);

    if (!safeFriendCode) {
      throw new Error("Inventory needs a friend code.");
    }

    await supabaseRequest("player_inventories?on_conflict=friend_code", {
      method: "POST",
      auth: onlineAccountStorage.isLoggedIn,
      prefer: "resolution=merge-duplicates,return=minimal",
      body: {
        friend_code: safeFriendCode,
        inventory_json: normalizeTradingItems(items),
        updated_at: new Date().toISOString(),
      },
    });
  },
  async loadInventory(friendCode) {
    const safeFriendCode = normalizeFriendCode(friendCode);

    if (!safeFriendCode) {
      return null;
    }

    const query = new URLSearchParams({
      select: "friend_code,inventory_json,updated_at",
      friend_code: `eq.${safeFriendCode}`,
      limit: "1",
    });
    const data = await supabaseRequest(`player_inventories?${query.toString()}`, { auth: onlineAccountStorage.isLoggedIn });
    return normalizeOnlineInventoryRow(Array.isArray(data) ? data[0] : null);
  },
};
window.bestieOnlineFriendGames = onlineFriendGames;

function normalizeAuthProfile(profile) {
  if (!profile) {
    return null;
  }

  const avatar = {
    ...createDefaultAvatar(),
    emojiAvatar: profile.emoji_avatar || profile.emojiAvatar || defaultEmojiAvatar,
  };

  return ensureFriendProfile({
    userId: profile.user_id || profile.userId || "",
    nickname: profile.nickname || "Mystery Player",
    normalizedNickname: profile.normalized_nickname || normalizeNickname(profile.nickname || ""),
    avatar,
    friendCode: normalizeFriendCode(profile.friend_code || profile.friendCode || ""),
    stars: Number.parseInt(profile.stars || "0", 10) || 0,
    lastSeenAt: profile.last_seen_at
      ? new Date(profile.last_seen_at).getTime()
      : profile.lastSeenAt || (profile.updated_at ? new Date(profile.updated_at).getTime() : 0),
    activeTheme: profile.active_theme || "default",
    purchasedRewards: [],
    diaryAccess: false,
    diaryNotes: {},
    settings: {},
    createdAt: profile.created_at ? new Date(profile.created_at).getTime() : Date.now(),
  });
}

const onlineAccountStorage = {
  get isLoggedIn() {
    return Boolean(getSupabaseAccessToken() && getSupabaseAuthUser()?.id);
  },
  get userId() {
    return getSupabaseAuthUser()?.id || "";
  },
  async signUp({ email, password, nickname }) {
    return supabaseAuthRequest("signup", {
      body: {
        email,
        password,
        data: {
          nickname,
        },
      },
    });
  },
  async signIn({ email, password }) {
    return supabaseAuthRequest("token?grant_type=password", {
      body: {
        email,
        password,
      },
    });
  },
  async refreshSession() {
    const session = getSupabaseAuthSession();

    if (!session?.refresh_token) {
      return null;
    }

    const refreshedSession = await supabaseAuthRequest("token?grant_type=refresh_token", {
      body: {
        refresh_token: session.refresh_token,
      },
    });
    saveSupabaseAuthSession(refreshedSession);
    return refreshedSession;
  },
  async signOut() {
    const token = getSupabaseAccessToken();

    if (token) {
      await supabaseAuthRequest("logout", {
        token,
        body: {},
      }).catch((error) => console.error("Supabase logout error:", error));
    }

    clearSupabaseAuthSession();
  },
  async loadProfile() {
    const userId = this.userId;

    if (!userId) {
      return null;
    }

    const query = new URLSearchParams({
      select: "user_id,nickname,normalized_nickname,emoji_avatar,friend_code,stars,active_theme,created_at,updated_at",
      user_id: `eq.${userId}`,
      limit: "1",
    });
    const data = await supabaseRequest(`profiles?${query.toString()}`, { auth: true });
    return normalizeAuthProfile(Array.isArray(data) ? data[0] : null);
  },
  async saveProfile(profile) {
    const userId = this.userId;

    if (!userId || !profile?.nickname) {
      return null;
    }

    const avatar = getUnlockedAvatar(profile.avatar || createDefaultAvatar());
    const data = await supabaseRequest("profiles?on_conflict=user_id", {
      method: "POST",
      auth: true,
      prefer: "resolution=merge-duplicates,return=representation",
      body: {
        user_id: userId,
        nickname: profile.nickname,
        normalized_nickname: normalizeNickname(profile.nickname),
        emoji_avatar: avatar.emojiAvatar || defaultEmojiAvatar,
        friend_code: normalizeFriendCode(profile.friendCode),
        stars: profile.stars || 0,
        active_theme: getActiveTheme(),
        updated_at: new Date().toISOString(),
      },
    });

    return normalizeAuthProfile(Array.isArray(data) ? data[0] : null);
  },
  async loadPurchases() {
    const query = new URLSearchParams({
      select: "item_id,purchased_at",
      order: "purchased_at.asc",
    });
    const data = await supabaseRequest(`purchases?${query.toString()}`, { auth: true });
    return (data || []).map((purchase) => purchase.item_id).filter(Boolean);
  },
  async savePurchases(itemIds) {
    const userId = this.userId;
    const uniqueItemIds = [...new Set(itemIds || [])].filter(Boolean);

    if (!userId || uniqueItemIds.length === 0) {
      return;
    }

    await supabaseRequest("purchases?on_conflict=user_id,item_id", {
      method: "POST",
      auth: true,
      prefer: "resolution=merge-duplicates,return=minimal",
      body: uniqueItemIds.map((itemId) => ({
        user_id: userId,
        item_id: itemId,
      })),
    });
  },
  async loadDiaryEntries() {
    const query = new URLSearchParams({
      select: "id,local_entry_id,text,mood,sticker,created_at",
      order: "created_at.desc",
    });
    const data = await supabaseRequest(`diary_entries?${query.toString()}`, { auth: true });

    return normalizeDiaryEntries((data || []).map((entry) => {
      const createdAt = entry.created_at ? new Date(entry.created_at) : new Date();
      return {
        id: entry.local_entry_id || entry.id,
        date: createdAt.toISOString().slice(0, 10),
        time: createdAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        text: entry.text,
        mood: entry.mood || "",
        sticker: entry.sticker || "",
        createdAt: createdAt.getTime(),
      };
    }));
  },
  async saveDiaryEntries(entries) {
    const userId = this.userId;
    const safeEntries = normalizeDiaryEntries(entries);

    if (!userId || safeEntries.length === 0) {
      return;
    }

    await supabaseRequest("diary_entries?on_conflict=user_id,local_entry_id", {
      method: "POST",
      auth: true,
      prefer: "resolution=merge-duplicates,return=minimal",
      body: safeEntries.map((entry) => ({
        user_id: userId,
        local_entry_id: entry.id,
        text: entry.text,
        mood: entry.mood || null,
        sticker: entry.sticker || null,
        created_at: new Date(entry.createdAt || Date.now()).toISOString(),
      })),
    });
  },
  async loadQuizzes() {
    const query = new URLSearchParams({
      select: "id,local_quiz_id,quiz_id,title,theme,questions_json,created_at,updated_at",
      order: "updated_at.desc",
    });
    const data = await supabaseRequest(`quizzes?${query.toString()}`, { auth: true });

    return (data || [])
      .map((quiz, index) => normalizeSavedQuizRecord({
        id: quiz.local_quiz_id || quiz.quiz_id || quiz.id,
        onlineQuizId: quiz.quiz_id,
        title: quiz.title,
        theme: quiz.theme,
        questions: quiz.questions_json,
        createdAt: quiz.created_at,
        updatedAt: quiz.updated_at || quiz.created_at,
      }, index === 0 ? "My Online Quiz" : `Online Quiz ${index + 1}`))
      .filter((quiz) => quiz.questions.length > 0);
  },
  async saveQuizzes(quizzes) {
    const userId = this.userId;
    const safeQuizzes = (quizzes || []).map((quiz) => normalizeSavedQuizRecord(quiz)).filter((quiz) => quiz.questions.length > 0);

    if (!userId || safeQuizzes.length === 0) {
      return;
    }

    await supabaseRequest("quizzes?on_conflict=owner_id,local_quiz_id", {
      method: "POST",
      auth: true,
      prefer: "resolution=merge-duplicates,return=minimal",
      body: safeQuizzes.map((quiz) => ({
        owner_id: userId,
        local_quiz_id: quiz.id,
        quiz_id: quiz.onlineQuizId || quiz.quizId || `LOCAL-${quiz.id.replace(/[^a-z0-9]/gi, "").slice(0, 12).toUpperCase()}`,
        title: quiz.title,
        theme: quiz.theme,
        questions_json: quiz.questions,
        creator_nickname: activePlayer?.nickname || null,
        created_at: quiz.createdAt || new Date().toISOString(),
        updated_at: quiz.updatedAt || new Date().toISOString(),
      })),
    });
  },
};
window.bestieOnlineAccountStorage = onlineAccountStorage;

function normalizeUsernameAccount(account) {
  if (!account) {
    return null;
  }

  const username = cleanPlayerNickname(account.username || account.nickname || "");
  const friendCode = normalizeFriendCode(account.friend_code || account.friendCode || "");

  if (!username || !friendCode) {
    return null;
  }

  let purchases = account.purchases_json || account.purchasesJson || [];
  let savedQuizzes = account.saved_quizzes_json || account.savedQuizzesJson || [];

  if (!Array.isArray(purchases)) {
    purchases = [];
  }

  if (!Array.isArray(savedQuizzes)) {
    savedQuizzes = [];
  }

  return {
    playerId: account.id || account.player_id || account.playerId || "",
    username,
    normalizedUsername: account.normalized_username || normalizeNickname(username),
    friendCode,
    emojiAvatar: account.emoji_avatar || account.emojiAvatar || defaultEmojiAvatar,
    stars: Number.parseInt(account.stars || "0", 10) || 0,
    activeTheme: account.active_theme || account.activeTheme || "default",
    purchases,
    savedQuizzes,
    createdAt: account.created_at || account.createdAt || "",
    updatedAt: account.updated_at || account.updatedAt || "",
  };
}

function profileFromUsernameAccount(account) {
  const safeAccount = normalizeUsernameAccount(account);

  if (!safeAccount) {
    return null;
  }

  return ensureFriendProfile({
    playerId: safeAccount.playerId,
    nickname: safeAccount.username,
    friendCode: safeAccount.friendCode,
    stars: safeAccount.stars,
    purchasedRewards: safeAccount.purchases,
    diaryAccess: safeAccount.purchases.includes("daily-diary"),
    diaryNotes: {},
    settings: {},
    avatar: {
      ...createDefaultAvatar(),
      emojiAvatar: safeAccount.emojiAvatar,
    },
    createdAt: safeAccount.createdAt ? new Date(safeAccount.createdAt).getTime() : Date.now(),
  });
}

const onlineUsernameAccounts = {
  get isConfigured() {
    return isSupabaseConfigured();
  },
  async createAccount({ username, pin, emojiAvatar }) {
    const data = await supabaseRequest("rpc/create_player_account", {
      method: "POST",
      body: {
        player_username: username,
        player_pin: pin,
        player_emoji_avatar: emojiAvatar || defaultEmojiAvatar,
      },
    });
    return normalizeUsernameAccount(Array.isArray(data) ? data[0] : data);
  },
  async login({ username, pin }) {
    const data = await supabaseRequest("rpc/login_player_with_pin", {
      method: "POST",
      body: {
        player_username: username,
        player_pin: pin,
      },
    });
    return normalizeUsernameAccount(Array.isArray(data) ? data[0] : data);
  },
  async saveProgress({ username, pin, profile = activePlayer, purchases = getPurchasedRewards(), quizzes = getSavedQuizzes() }) {
    if (!username || !pin || !profile) {
      return null;
    }

    const avatar = getUnlockedAvatar(profile.avatar || createDefaultAvatar());
    const data = await supabaseRequest("rpc/save_player_progress", {
      method: "POST",
      body: {
        player_username: username,
        player_pin: pin,
        player_emoji_avatar: avatar.emojiAvatar || defaultEmojiAvatar,
        player_stars: profile.stars || 0,
        player_active_theme: getActiveTheme(),
        player_purchases_json: purchases,
        player_saved_quizzes_json: quizzes,
      },
    });

    return normalizeUsernameAccount(Array.isArray(data) ? data[0] : data);
  },
  async saveCurrentProgress() {
    if (!usernamePinSession || !activePlayer) {
      return null;
    }

    return this.saveProgress({
      username: usernamePinSession.username,
      pin: usernamePinSession.pin,
      profile: activePlayer,
      purchases: getPurchasedRewards(),
      quizzes: getSavedQuizzes(),
    });
  },
};
window.bestieOnlineUsernameAccounts = onlineUsernameAccounts;

const themeRewards = {
  "secret-notebook-theme": {
    name: "Secret Notebook Theme",
    className: "theme-secret-notebook",
  },
  "moonlight-library-theme": {
    name: "Moonlight Library Theme",
    className: "theme-moonlight-library",
  },
  "blush-diary-theme": {
    name: "Blush Diary Theme",
    className: "theme-blush-diary",
  },
  "cloudy-blue-theme": {
    name: "Cloudy Blue Theme",
    className: "theme-cloudy-blue",
  },
  "secret-garden-theme": {
    name: "Secret Garden Theme",
    className: "theme-secret-garden",
  },
};

const activeGamePackIds = new Set([
  "this-or-that-pack",
  "would-you-rather-pack",
  "mystery-personality-pack",
  "extra-quiz-theme-pack",
]);

const comingSoonGamePackIds = new Set(["hard-mode"]);
const activeDiaryRewardIds = new Set(["secret-sticker-pack", "mood-tracker"]);
const comingSoonDiaryRewardIds = new Set(["premium-diary-cover", "memory-box"]);
const diaryStickerOptions = ["Star", "Moon", "Heart", "Key", "Diary", "Flower", "Cloud", "Sparkle"];
const diaryMoodOptions = ["Happy", "Calm", "Excited", "Tired", "Nervous", "Sad", "Proud", "Confused"];
const quickChatMessages = [
  "Hi!",
  "Play my quiz!",
  "I got 10/10!",
  "Try again!",
  "You know me so well!",
  "New quiz is ready!",
  "Let’s play a game!",
  "Want to play a quiz?",
  "Want to play This or That?",
  "Want to play Would You Rather?",
  "I sent you a quiz!",
  "Good game!",
  "That was fun!",
  "Want to try again?",
  "Check my score!",
  "I unlocked something in the shop!",
];
const safeGameInvites = [
  "Want to play Bestie Quiz?",
  "Want to play This or That?",
  "Want to play Would You Rather?",
  "Want to try Mystery Personality Quiz?",
  "Want to play Box of Lies?",
  "Want to trade collectibles?",
];
const stickerReactions = [
  { label: "Amazing", text: "🌟 Amazing!" },
  { label: "Funny", text: "😂 Funny!" },
  { label: "Bestie", text: "💖 Bestie!" },
  { label: "Champion", text: "🏆 Champion!" },
  { label: "Surprised", text: "😮 I didn’t know that!" },
  { label: "Play Again", text: "🎮 Play again!" },
  { label: "Star", text: "⭐ Star" },
  { label: "Heart", text: "💜 Heart" },
  { label: "Clue", text: "🔍 Clue" },
  { label: "Moon", text: "🌙 Moon" },
  { label: "Sparkle", text: "✨ Sparkle" },
  { label: "Trophy", text: "🏆 Trophy" },
  { label: "Diary", text: "📓 Diary" },
  { label: "Game", text: "🎮 Game" },
];
const blockedChatWords = ["stupid", "idiot", "hate", "shut up", "dumb", "kill"];
const boxOfLiesItems = [
  { emoji: "🐱", text: "A cat wearing a wizard hat" },
  { emoji: "🦄", text: "A tiny unicorn on a skateboard" },
  { emoji: "🐸", text: "A frog wearing sunglasses" },
  { emoji: "🍕", text: "A pizza with wings" },
  { emoji: "🐶", text: "A dog wearing a crown" },
  { emoji: "🐼", text: "A panda eating noodles" },
  { emoji: "🐧", text: "A penguin holding a cupcake" },
  { emoji: "🦖", text: "A dinosaur in pajamas" },
  { emoji: "🍩", text: "A donut spaceship" },
  { emoji: "🐰", text: "A bunny with roller skates" },
];
const tradingCollectibles = [
  { itemId: "star-sticker", emoji: "🌟", name: "Star Sticker", rarity: "Common", source: "starter" },
  { itemId: "blue-gem", emoji: "💎", name: "Blue Gem", rarity: "Rare", source: "trade" },
  { itemId: "cat-card", emoji: "🐱", name: "Cat Card", rarity: "Common", source: "starter" },
  { itemId: "unicorn-card", emoji: "🦄", name: "Unicorn Card", rarity: "Rare", source: "trade" },
  { itemId: "rainbow-sticker", emoji: "🌈", name: "Rainbow Sticker", rarity: "Common", source: "starter" },
  { itemId: "frog-sticker", emoji: "🐸", name: "Frog Sticker", rarity: "Common", source: "trade" },
  { itemId: "puppy-card", emoji: "🐶", name: "Puppy Card", rarity: "Common", source: "trade" },
  { itemId: "pizza-badge", emoji: "🍕", name: "Pizza Badge", rarity: "Fun", source: "trade" },
  { itemId: "panda-sticker", emoji: "🐼", name: "Panda Sticker", rarity: "Common", source: "trade" },
  { itemId: "tiny-crown", emoji: "👑", name: "Tiny Crown", rarity: "Rare", source: "trade" },
  { itemId: "pink-bow", emoji: "🎀", name: "Pink Bow", rarity: "Cute", source: "trade" },
  { itemId: "cupcake-charm", emoji: "🧁", name: "Cupcake Charm", rarity: "Common", source: "starter" },
];
const tradingStarterInventory = [
  { itemId: "star-sticker", quantity: 2 },
  { itemId: "cat-card", quantity: 1 },
  { itemId: "rainbow-sticker", quantity: 1 },
  { itemId: "cupcake-charm", quantity: 1 },
];
const defaultEmojiAvatar = "🌙";

const emojiAvatarCategories = {
  Mystery: ["🌙", "⭐", "✨", "🔮", "🗝️", "📓", "🕯️", "🕵️‍♀️", "🕵️", "🖤", "💜", "🪞", "🧩", "🕰️", "🦇", "🧿", "🕳️", "🧭", "🗺️", "🧳", "🪄", "🧪", "🧬", "🪐"],
  "Cute Animals": ["🐈‍⬛", "🐱", "🐶", "🐰", "🦊", "🐼", "🐻", "🐨", "🐹", "🐥", "🦋", "🐝", "🦉", "🐬", "🐧", "🐢", "🦭", "🦔", "🦝", "🐿️", "🐇", "🐕", "🐩", "🐕‍🦺", "🦜"],
  "Pretty / Aesthetic": ["🌸", "🌷", "🌹", "🌻", "🌼", "🪷", "🍀", "🌿", "🍃", "☁️", "🌈", "🫧", "🪽", "💫", "💎", "🎀", "🧸", "🐚", "🪩", "🕊️", "🪻", "🌺", "💐", "🕯️", "🪞"],
  "Cool / Gamer": ["🎧", "🎮", "🕶️", "⚡", "🔥", "🧠", "🏆", "🎲", "🎯", "🛼", "🎨", "📷", "🎵", "🛸", "🚀", "💻", "📱", "⌨️", "🖱️", "🕹️", "🎤", "🎬", "🧩", "🧪", "🧭"],
  "Food / Drinks": ["🍓", "🍒", "🍎", "🍏", "🍊", "🍋", "🍌", "🍉", "🍇", "🫐", "🍑", "🍍", "🥭", "🥝", "🥥", "🥑", "🥕", "🌽", "🥒", "🥦", "🥗", "🍙", "🍚", "🍜", "🍣", "🥟", "🥪", "🍳", "🥞", "🥐", "🧋", "🧃", "🥤", "🥛", "🍵", "☕", "🫖", "🍦", "🍪", "🍫", "🧁", "🍰"],
  "School / Creative": ["📚", "✏️", "📝", "📒", "📔", "📎", "🖊️", "🖌️", "🎨", "🧶", "🪡", "✂️", "📐", "📏", "🔬", "🔭", "🧮", "🧠", "💡", "🧪"],
  "Travel / Dream Trip": ["✈️", "🚄", "🚗", "🚌", "🚲", "🛴", "🏰", "🎡", "🎢", "🗼", "🗽", "🏝️", "🏔️", "🌋", "🏕️", "🏖️", "🗺️", "🧳", "🛫", "🌃"],
  "Vibes / Feelings": ["😊", "😎", "🤩", "🥰", "😴", "😌", "😇", "🤔", "😜", "🥳", "🫶", "💅", "💃", "🧘", "🫧", "💭", "💌", "💕", "💜", "🤍"],
};

const shopItems = [
  { id: "daily-diary", name: "Daily Diary", cost: 50, icon: "📔", category: "Diary", description: "Unlock a private daily diary page where you can write one note each day.", effect: "This unlocks the Daily Diary page." },
  { id: "premium-diary-cover", name: "Premium Diary Cover", cost: 80, icon: "✨", category: "Diary", description: "A special cover style for the diary.", effect: "This unlocks a prettier diary cover style. Coming soon." },
  { id: "secret-sticker-pack", name: "Secret Sticker Pack", cost: 30, icon: "🏷️", category: "Diary", description: "Decorate diary entries with small stickers.", effect: "This unlocks sticker choices inside the diary." },
  { id: "mood-tracker", name: "Mood Tracker", cost: 40, icon: "🌤️", category: "Diary", description: "Add a simple mood check-in to your diary.", effect: "This unlocks diary moods like happy, tired, excited, calm, or proud." },
  { id: "memory-box", name: "Memory Box", cost: 70, icon: "📦", category: "Diary", description: "Save special notes and favourite quiz results.", effect: "This unlocks a future page where players can save favourite quiz results or special notes. Coming soon." },
  { id: "secret-notebook-theme", name: "Secret Notebook Theme", cost: 25, icon: "📓", category: "Themes", description: "A soft mystery-style theme for your quiz.", effect: "This unlocks a cream paper look with notebook-style borders and lavender accents." },
  { id: "moonlight-library-theme", name: "Moonlight Library Theme", cost: 70, icon: "🕯️", category: "Themes", description: "A calm manga mystery theme for the app.", effect: "This unlocks pale moonlight blue, soft silver, and lavender shadows." },
  { id: "blush-diary-theme", name: "Blush Diary Theme", cost: 45, icon: "💗", category: "Themes", description: "A soft pink diary-style theme.", effect: "This unlocks blush pink, pearl white, and soft rose diary cards." },
  { id: "cloudy-blue-theme", name: "Cloudy Blue Theme", cost: 45, icon: "☁️", category: "Themes", description: "A pale blue soft mystery theme.", effect: "This unlocks pale blue, cloud white, soft grey, and gentle blue buttons." },
  { id: "secret-garden-theme", name: "Secret Garden Theme", cost: 65, icon: "🌿", category: "Themes", description: "A light garden mystery theme.", effect: "This unlocks cream, soft green, pale lavender, and garden mystery styling." },
  { id: "extra-quiz-theme-pack", name: "Extra Quiz Theme Pack", cost: 35, icon: "🎲", category: "Games", description: "Unlock extra built-in quiz themes.", effect: "This unlocks more quiz theme options later, such as family, sibling, classmate, mystery, or diary-style quiz themes. Coming soon." },
  { id: "mystery-personality-pack", name: "Mystery Personality Quiz Pack", cost: 50, icon: "🔍", category: "Games", description: "Unlock extra mystery personality quiz results.", effect: "This unlocks more result types for the Mystery Personality Quiz. Coming soon." },
  { id: "would-you-rather-pack", name: "Would You Rather Pack", cost: 35, icon: "💭", category: "Games", description: "Unlock more Would You Rather questions.", effect: "This unlocks extra Would You Rather questions. Coming soon." },
  { id: "this-or-that-pack", name: "This or That Pack", cost: 35, icon: "⚖️", category: "Games", description: "Unlock more This or That questions.", effect: "This unlocks extra This or That questions. Coming soon." },
  { id: "hard-mode", name: "Hard Mode", cost: 60, icon: "🧠", category: "Games", description: "Unlock harder questions and challenge mode.", effect: "This unlocks harder versions of games or quizzes later. Coming soon." },
  { id: "profile-frame", name: "Profile Frame", cost: 15, icon: "🖼️", category: "Profile", description: "A stylish frame for your result card.", effect: "This adds a stylish frame to your result card." },
  { id: "secret-badge", name: "Secret Badge", cost: 25, icon: "🏅", category: "Profile", description: "A badge that can show on your result card.", effect: "This unlocks a badge that can appear next to the player’s name or quiz result. Coming soon." },
  { id: "top-investigator-badge", name: "Top Investigator Badge", cost: 75, icon: "🏆", category: "Profile", description: "A special badge for top leaderboard players.", effect: "This unlocks a premium badge for leaderboard or profile display. Coming soon." },
  { id: "custom-result-card", name: "Custom Result Card", cost: 50, icon: "💌", category: "Profile", description: "Unlock a prettier result card style.", effect: "This unlocks a more stylish result card after finishing a quiz. Coming soon." },
];

const avatarOptions = {
  style: ["Girl", "Boy", "Non-binary", "Prefer not to say"],
  faceShape: ["Round", "Oval", "Heart", "Soft square"],
  skinTone: ["Light", "Fair", "Medium", "Tan", "Deep", "Rich"],
  eyeShape: ["Soft eyes", "Big eyes", "Sleepy eyes", "Wink", "Smiley eyes", "Sharp eyes", "Mysterious eyes", "Round eyes", "Soft almond eyes", "Upturned almond eyes", "Soft monolid eyes"],
  eyeColour: ["Brown", "Dark brown", "Black", "Blue", "Green", "Hazel", "Grey", "Violet", "Amber"],
  height: ["Short", "Medium", "Tall", "Extra tall"],
  hairstyle: ["Long waves", "Short bob", "Ponytail", "Braids", "Curly hair", "Straight hair", "Messy bun", "Layered hair"],
  hairColour: ["Black", "Dark brown", "Light brown", "Blonde", "Auburn", "Pink", "Purple", "Blue", "Silver"],
  outfit: ["Cozy hoodie", "Mystery jacket", "School cardigan", "Soft sweater", "Diary club outfit", "Moonlight coat", "Casual dress", "Sporty outfit"],
  outfitColour: ["Blush pink", "Lavender", "Cream", "Pearl white", "Pale blue", "Soft grey", "Black", "Dusty purple", "Mint", "Cherry red"],
  accessory: ["None", "Silver key", "Notebook", "Headphones", "Ribbon", "Star clip", "Moon necklace", "Glasses", "Tiny bag"],
  accessoryColour: ["Silver", "Gold", "Rose gold", "Black", "White", "Pink", "Purple", "Blue", "Red"],
  diaryColour: ["Lavender", "Cream", "Dusty pink", "Pale blue", "Black", "Silver", "Soft brown"],
  background: ["Lavender room", "Secret diary desk", "Moonlight window", "Soft library", "Cloudy sky", "Cafe corner", "Study desk"],
  backgroundColour: ["Cream", "Lavender", "Pale blue", "Blush pink", "Soft grey", "Moonlight white"],
};

const shopBackgroundRewards = [];

const avatarLabels = {
  style: "Avatar style / gender",
  faceShape: "Face shape",
  skinTone: "Skin tone",
  eyeShape: "Eye shape",
  eyeColour: "Eye colour",
  height: "Height style",
  hairstyle: "Hair style",
  hairColour: "Hair colour",
  outfit: "Outfit",
  outfitColour: "Outfit colour",
  accessory: "Accessory",
  accessoryColour: "Accessory colour",
  diaryColour: "Diary / notebook colour",
  background: "Background",
  backgroundColour: "Background colour",
};

const colourSwatches = {
  "Blush pink": "#ffd6e8",
  Lavender: "#e7dcff",
  Cream: "#fff8df",
  "Pearl white": "#ffffff",
  "Pale blue": "#d9ecff",
  "Soft grey": "#dfe3ec",
  Black: "#2f2b36",
  "Dusty purple": "#a98ac5",
  Mint: "#cdf7e7",
  "Cherry red": "#d84f69",
  Silver: "#cfd5df",
  Gold: "#f3cf75",
  "Rose gold": "#e7a7a1",
  White: "#ffffff",
  Pink: "#ffb8d7",
  Purple: "#b79cff",
  Blue: "#8fc7ff",
  Red: "#df5b6c",
  "Dusty pink": "#e9b6c6",
  "Soft brown": "#b79273",
  "Moonlight white": "#f8fbff",
  Brown: "#7a5236",
  "Dark brown": "#432a1f",
  Green: "#70a878",
  Hazel: "#9b7b45",
  Grey: "#9aa0a8",
  Violet: "#8d6bd1",
  Amber: "#d3913c",
  "Light brown": "#9b6b43",
  Blonde: "#e7c66b",
  Auburn: "#9a4e33",
};

const colourOptionKeys = new Set(["eyeColour", "hairColour", "outfitColour", "accessoryColour", "diaryColour", "backgroundColour"]);

const avatarColourValues = {
  skinTone: {
    Light: "#f8dccb",
    Fair: "#f1c7ad",
    Medium: "#d8a178",
    Tan: "#b97855",
    Deep: "#7b4d39",
    Rich: "#523126",
  },
  eyeColour: colourSwatches,
  hairColour: colourSwatches,
  outfitColour: colourSwatches,
  accessoryColour: colourSwatches,
  diaryColour: colourSwatches,
  backgroundColour: colourSwatches,
};

const avatarBackgroundThemes = {
  "Lavender room": { base: "#e7dcff", tint: "#fff7fb", accent: "#ffffff", line: "#9f83c9" },
  "Secret diary desk": { base: "#fff8df", tint: "#ffe4ef", accent: "#e9b6c6", line: "#a98a76" },
  "Moonlight window": { base: "#d9ecff", tint: "#f8fbff", accent: "#ffffff", line: "#8aa6d1" },
  "Soft library": { base: "#ffe7f0", tint: "#ffffff", accent: "#e7dcff", line: "#b088a5" },
  "Cloudy sky": { base: "#d9ecff", tint: "#ffffff", accent: "#f8fbff", line: "#8fc7ff" },
  "Cafe corner": { base: "#ffe6ef", tint: "#fff8df", accent: "#ffffff", line: "#c98fa4" },
  "Study desk": { base: "#fff8df", tint: "#f6f8ff", accent: "#d9ecff", line: "#b79273" },
  "Premium Study Desk Background": { base: "#f8fbff", tint: "#e7dcff", accent: "#fff8df", line: "#8b5ea8" },
  "Clue Board Background": { base: "#d9ecff", tint: "#fff8df", accent: "#ffd6e8", line: "#7c86b8" },
  "Mystery Room Theme": { base: "#e7dcff", tint: "#f8fbff", accent: "#d9ecff", line: "#7f6aa5" },
};

const safeQuizzes = [
  {
    title: "Would You Rather?",
    description: "Silly choices for brave case solvers.",
    mode: "opinion",
    questions: [
      { text: "Would you rather find a secret note or a hidden map?", answers: ["Secret note", "Hidden map", "Both please", "A shiny sticker"] },
      { text: "Would you rather solve a puzzle in a library or a garden?", answers: ["Library", "Garden", "Treehouse", "Kitchen"] },
      { text: "Would you rather have a magnifying glass or a lucky notebook?", answers: ["Magnifying glass", "Lucky notebook", "Detective hat", "Snack bag"] },
      { text: "Would you rather follow sparkles or tiny footprints?", answers: ["Sparkles", "Footprints", "Both clues", "Neither clue"] },
      { text: "Would you rather crack a code or spot a pattern?", answers: ["Crack a code", "Spot a pattern", "Ask a friend", "Draw the clue"] },
    ],
  },
  {
    title: "This or That?",
    description: "Quick choices with light mystery vibes.",
    mode: "opinion",
    questions: [
      { text: "Best mystery snack?", answers: ["Popcorn", "Grapes", "Pretzels", "All of them"] },
      { text: "Best clue color?", answers: ["Mint", "Lavender", "Sunshine", "Rainbow"] },
      { text: "Best mystery helper?", answers: ["Notebook", "Sticker", "Flashlight", "Kind friend"] },
      { text: "Best case name?", answers: ["The Missing Button", "The Sleepy Pencil", "The Secret Star", "The Cozy Clue"] },
      { text: "Best victory move?", answers: ["High five", "Tiny dance", "Big grin", "All three"] },
    ],
  },
  {
    title: "Mystery Vibe Quiz",
    description: "Find your playful detective style.",
    questions: [
      { text: "A clue appears. What do you do first?", answers: ["Look closely", "Make a list", "Ask a teammate", "Guess fast"], correct: 0 },
      { text: "Your case room needs music. Pick one.", answers: ["Bouncy beats", "Calm tunes", "Movie music", "No music"], correct: 1 },
      { text: "Which clue feels most important?", answers: ["A pattern", "A kind note", "A calendar", "A doodle"], correct: 0 },
      { text: "A friend is stuck. What helps?", answers: ["Kind hint", "Loud countdown", "Walking away", "Changing rules"], correct: 0 },
      { text: "Case solved. What now?", answers: ["Celebrate", "Thank helpers", "Save notes", "All of these"], correct: 3 },
    ],
  },
  {
    title: "Friendship Style Quiz",
    description: "A gentle quiz about being a good friend.",
    questions: [
      { text: "A friend feels left out. What is kind?", answers: ["Invite them in", "Ignore them", "Tease them", "Hide"], correct: 0 },
      { text: "A friend wins a game. What can you say?", answers: ["No fair", "Good job", "I quit", "Whatever"], correct: 1 },
      { text: "A friend makes a mistake. What helps?", answers: ["Laugh loudly", "Give a kind reminder", "Tell everyone", "Take over"], correct: 1 },
      { text: "What makes teamwork better?", answers: ["Listening", "Bossing", "Grabbing", "Shouting"], correct: 0 },
      { text: "What is a good friend clue?", answers: ["Kind words", "Sharing", "Being honest", "All of these"], correct: 3 },
    ],
  },
  {
    title: "School Vibes Quiz",
    description: "Safe school-day choices, no private details.",
    questions: [
      { text: "Best way to start a group project?", answers: ["Make a plan", "Argue first", "Hide supplies", "Skip it"], correct: 0 },
      { text: "A classmate drops papers. What do you do?", answers: ["Help pick them up", "Walk past", "Point", "Laugh"], correct: 0 },
      { text: "Best desk item for a mystery case?", answers: ["Pencil", "Notebook", "Eraser", "All of them"], correct: 3 },
      { text: "What helps during tricky work?", answers: ["Taking a breath", "Trying again", "Asking kindly", "All of these"], correct: 3 },
      { text: "Best recess case?", answers: ["Find the sunny spot", "Plan a fair game", "Share turns", "All of these"], correct: 3 },
    ],
  },
  {
    title: "My Secret Case",
    description: "A ready-made quiz about favourite things.",
    questions: [
      { text: "What is my third favourite colour?", answers: ["Purple", "Pink", "Blue", "Green"], correct: 2 },
      { text: "What is my dream trip?", answers: ["Disneyland", "First class trip to Japan", "First class trip to China", "Skip school for a week"], correct: 1 },
      { text: "About how many people are in my family?", answers: ["4", "8", "9", "21"], correct: 1 },
      { text: "What is one of my favourite treats?", answers: ["Meat", "Ice cream", "Sushi", "Oreos"], correct: 2 },
      { text: "What is my hobby?", answers: ["Eating", "Reading", "Talking", "Sleeping for as long as I like"], correct: 1 },
      { text: "What do I like to do when I play with a friend?", answers: ["Watch a movie", "Eat", "Go to a park", "Have a picnic"], correct: 0 },
      { text: "What is Diva's last name?", answers: ["Chen", "Ma", "Diva", "Da Burritoooooo"], correct: 3 },
      { text: "What do I do in my free time?", answers: ["Read", "Draw", "Play with Diva", "Day-dream"], correct: 1 },
      { text: "Who is my second best friend?", answers: ["Katie", "Georgina", "Tiana", "Freya (from art)"], correct: 3 },
      { text: "What is my favourite crafting game?", answers: ["Minecraft", "DIY making craft", "Origami", "Other"], correct: 0 },
    ],
  },
];

const builtInGames = {
  wouldYouRather: {
    title: "Would You Rather?",
    eyebrow: "Choice Game",
    type: "completion",
    roundSize: 10,
    packId: "would-you-rather-pack",
    stars: 3,
    resultTitle: "Round saved!",
    resultMessage: "Your choices have been saved for this round!",
    freeQuestions: [
      { text: "Would you rather find a secret note or a hidden key?", answers: ["Secret note", "Hidden key"] },
      { text: "Would you rather have a cozy movie night or a sunny picnic?", answers: ["Movie night", "Sunny picnic"] },
      { text: "Would you rather solve a library mystery or a cafe mystery?", answers: ["Library mystery", "Cafe mystery"] },
      { text: "Would you rather follow a map or crack a code?", answers: ["Follow a map", "Crack a code"] },
      { text: "Would you rather decorate a diary or design a clue board?", answers: ["Decorate a diary", "Design a clue board"] },
      { text: "Would you rather wear a moon necklace or a star hair clip?", answers: ["Moon necklace", "Star hair clip"] },
      { text: "Would you rather have a sleepover mystery or a weekend case?", answers: ["Sleepover mystery", "Weekend case"] },
      { text: "Would you rather search a garden path or a bookshelf?", answers: ["Garden path", "Bookshelf"] },
      { text: "Would you rather keep a lucky pencil or a lucky notebook?", answers: ["Lucky pencil", "Lucky notebook"] },
      { text: "Would you rather find a clue in a cupcake box or a pencil case?", answers: ["Cupcake box", "Pencil case"] },
      { text: "Would you rather solve a case with music or quiet?", answers: ["Music", "Quiet"] },
      { text: "Would you rather make a friendship bracelet or a mystery badge?", answers: ["Friendship bracelet", "Mystery badge"] },
      { text: "Would you rather visit a cloud cafe or a moon library?", answers: ["Cloud cafe", "Moon library"] },
      { text: "Would you rather get one big clue or three tiny clues?", answers: ["One big clue", "Three tiny clues"] },
      { text: "Would you rather write with glitter ink or invisible ink?", answers: ["Glitter ink", "Invisible ink"] },
      { text: "Would you rather solve a case before lunch or after school?", answers: ["Before lunch", "After school"] },
      { text: "Would you rather have a lavender room or a pale blue room?", answers: ["Lavender room", "Pale blue room"] },
      { text: "Would you rather pick the team name or the case name?", answers: ["Team name", "Case name"] },
      { text: "Would you rather find a clue in a movie ticket or a bookmark?", answers: ["Movie ticket", "Bookmark"] },
      { text: "Would you rather have a secret handshake or a secret symbol?", answers: ["Secret handshake", "Secret symbol"] },
      { text: "Would you rather solve a mystery at a picnic or a party?", answers: ["Picnic", "Party"] },
      { text: "Would you rather keep clues in a tiny bag or a diary pocket?", answers: ["Tiny bag", "Diary pocket"] },
      { text: "Would you rather choose the snacks or choose the playlist?", answers: ["Snacks", "Playlist"] },
      { text: "Would you rather draw the suspect board or write the timeline?", answers: ["Suspect board", "Timeline"] },
      { text: "Would you rather find a clue under a cushion or behind a poster?", answers: ["Under a cushion", "Behind a poster"] },
      { text: "Would you rather be the clue spotter or the note keeper?", answers: ["Clue spotter", "Note keeper"] },
      { text: "Would you rather have a mystery jacket or a cozy hoodie?", answers: ["Mystery jacket", "Cozy hoodie"] },
      { text: "Would you rather solve a morning case or a moonlight case?", answers: ["Morning case", "Moonlight case"] },
      { text: "Would you rather share your theory first or hear your friend’s theory first?", answers: ["Share first", "Hear theirs first"] },
      { text: "Would you rather find the final clue in a library or a cafe?", answers: ["Library", "Cafe"] },
    ],
    packQuestions: [
      { text: "Would you rather unlock a secret door or open a secret box?", answers: ["Secret door", "Secret box"] },
      { text: "Would you rather solve a rainy day case or a sunny day case?", answers: ["Rainy day", "Sunny day"] },
      { text: "Would you rather have a pearl-white notebook or a silver keychain?", answers: ["Pearl-white notebook", "Silver keychain"] },
      { text: "Would you rather find clues with a friend or make a solo theory first?", answers: ["With a friend", "Solo theory first"] },
      { text: "Would you rather visit a clue museum or a diary shop?", answers: ["Clue museum", "Diary shop"] },
      { text: "Would you rather create a secret code or design a secret logo?", answers: ["Secret code", "Secret logo"] },
      { text: "Would you rather have a clue hidden in a song or a drawing?", answers: ["Song", "Drawing"] },
      { text: "Would you rather solve a case at a birthday party or a book fair?", answers: ["Birthday party", "Book fair"] },
      { text: "Would you rather keep your clues in a silver tin or a velvet pouch?", answers: ["Silver tin", "Velvet pouch"] },
      { text: "Would you rather find a mystery sticker or a tiny charm?", answers: ["Mystery sticker", "Tiny charm"] },
      { text: "Would you rather plan the first clue or reveal the final clue?", answers: ["First clue", "Final clue"] },
      { text: "Would you rather have a secret library card or a secret cafe pass?", answers: ["Library card", "Cafe pass"] },
      { text: "Would you rather solve a case with riddles or picture clues?", answers: ["Riddles", "Picture clues"] },
      { text: "Would you rather choose the team colour or the team badge?", answers: ["Team colour", "Team badge"] },
      { text: "Would you rather find a clue in a lunchbox note or a library receipt?", answers: ["Lunchbox note", "Library receipt"] },
      { text: "Would you rather have a soft garden case or a moon room case?", answers: ["Garden case", "Moon room case"] },
      { text: "Would you rather carry a mini torch or a mini notebook?", answers: ["Mini torch", "Mini notebook"] },
      { text: "Would you rather make a case scrapbook or a case playlist?", answers: ["Scrapbook", "Playlist"] },
      { text: "Would you rather discover a hidden drawer or a folded map?", answers: ["Hidden drawer", "Folded map"] },
      { text: "Would you rather solve clues with snacks or stickers?", answers: ["Snacks", "Stickers"] },
      { text: "Would you rather have a mystery desk lamp or a secret bookmark?", answers: ["Desk lamp", "Secret bookmark"] },
      { text: "Would you rather pick the mystery theme or the mystery prize?", answers: ["Mystery theme", "Mystery prize"] },
      { text: "Would you rather find clues in neat handwriting or tiny doodles?", answers: ["Handwriting", "Doodles"] },
      { text: "Would you rather solve a clue before breakfast or before bedtime?", answers: ["Before breakfast", "Before bedtime"] },
      { text: "Would you rather unlock a bonus round or a bonus badge?", answers: ["Bonus round", "Bonus badge"] },
    ],
  },
  thisOrThat: {
    title: "This or That",
    eyebrow: "Vibe Game",
    type: "vibe",
    roundSize: 10,
    packId: "this-or-that-pack",
    stars: 3,
    freeQuestions: [
      { text: "Sushi or ice cream?", answers: ["Sushi", "Ice cream"] },
      { text: "Reading or drawing?", answers: ["Reading", "Drawing"] },
      { text: "Movie night or picnic?", answers: ["Movie night", "Picnic"] },
      { text: "Lavender or pale blue?", answers: ["Lavender", "Pale blue"] },
      { text: "Mystery movie or comedy?", answers: ["Mystery movie", "Comedy"] },
      { text: "Notebook or clue board?", answers: ["Notebook", "Clue board"] },
      { text: "Moonlight or sunshine?", answers: ["Moonlight", "Sunshine"] },
      { text: "Cafe corner or soft library?", answers: ["Cafe corner", "Soft library"] },
      { text: "Cozy hoodie or mystery jacket?", answers: ["Cozy hoodie", "Mystery jacket"] },
      { text: "Star clip or ribbon?", answers: ["Star clip", "Ribbon"] },
      { text: "Sketching or journaling?", answers: ["Sketching", "Journaling"] },
      { text: "Popcorn or cupcakes?", answers: ["Popcorn", "Cupcakes"] },
      { text: "Board game or card game?", answers: ["Board game", "Card game"] },
      { text: "Secret code or hidden map?", answers: ["Secret code", "Hidden map"] },
      { text: "Blush pink or mint?", answers: ["Blush pink", "Mint"] },
      { text: "Friendship bracelet or secret badge?", answers: ["Friendship bracelet", "Secret badge"] },
      { text: "Soft sweater or school cardigan?", answers: ["Soft sweater", "School cardigan"] },
      { text: "Cloudy sky or secret garden?", answers: ["Cloudy sky", "Secret garden"] },
      { text: "Tiny bag or notebook?", answers: ["Tiny bag", "Notebook"] },
      { text: "Morning mystery or evening mystery?", answers: ["Morning mystery", "Evening mystery"] },
      { text: "Puzzle box or treasure jar?", answers: ["Puzzle box", "Treasure jar"] },
      { text: "Diary sticker or bookmark?", answers: ["Diary sticker", "Bookmark"] },
      { text: "Comedy night or mystery night?", answers: ["Comedy night", "Mystery night"] },
      { text: "Pale blue desk or lavender room?", answers: ["Pale blue desk", "Lavender room"] },
      { text: "Silver key or moon necklace?", answers: ["Silver key", "Moon necklace"] },
      { text: "Drawing clues or writing clues?", answers: ["Drawing clues", "Writing clues"] },
      { text: "Picnic blanket or beanbag chair?", answers: ["Picnic blanket", "Beanbag chair"] },
      { text: "Library pass or cafe coupon?", answers: ["Library pass", "Cafe coupon"] },
      { text: "Soft grey or pearl white?", answers: ["Soft grey", "Pearl white"] },
      { text: "Quiet playlist or upbeat playlist?", answers: ["Quiet playlist", "Upbeat playlist"] },
      { text: "Case file or memory box?", answers: ["Case file", "Memory box"] },
      { text: "Friend quiz or personality quiz?", answers: ["Friend quiz", "Personality quiz"] },
      { text: "Warm cocoa or fruit tea?", answers: ["Warm cocoa", "Fruit tea"] },
      { text: "Clue board background or study desk background?", answers: ["Clue board", "Study desk"] },
      { text: "Sparkly pen or smooth pencil?", answers: ["Sparkly pen", "Smooth pencil"] },
      { text: "Moon boots or comfy sneakers?", answers: ["Moon boots", "Comfy sneakers"] },
      { text: "Secret diary desk or moonlight window?", answers: ["Secret diary desk", "Moonlight window"] },
      { text: "Case captain or clue keeper?", answers: ["Case captain", "Clue keeper"] },
      { text: "Garden clue or library clue?", answers: ["Garden clue", "Library clue"] },
      { text: "Ribbon bow or hair clip?", answers: ["Ribbon bow", "Hair clip"] },
      { text: "Result card or leaderboard badge?", answers: ["Result card", "Leaderboard badge"] },
    ],
    packQuestions: [
      { text: "Moonlight library or blush diary?", answers: ["Moonlight library", "Blush diary"] },
      { text: "Hard mode or cozy mode?", answers: ["Hard mode", "Cozy mode"] },
      { text: "Secret case bag or silver key necklace?", answers: ["Secret case bag", "Silver key necklace"] },
      { text: "Sticker pack or diary cover?", answers: ["Sticker pack", "Diary cover"] },
      { text: "Top investigator badge or secret badge?", answers: ["Top investigator badge", "Secret badge"] },
      { text: "Secret garden or moonlight window?", answers: ["Secret garden", "Moonlight window"] },
      { text: "Case notes or clue sketches?", answers: ["Case notes", "Clue sketches"] },
      { text: "Friend match or quiz challenge?", answers: ["Friend match", "Quiz challenge"] },
      { text: "Tiny charm or shiny badge?", answers: ["Tiny charm", "Shiny badge"] },
      { text: "Study desk or cafe table?", answers: ["Study desk", "Cafe table"] },
      { text: "Mystery jacket or lavender hoodie?", answers: ["Mystery jacket", "Lavender hoodie"] },
      { text: "Secret sticker or moon clip?", answers: ["Secret sticker", "Moon clip"] },
      { text: "Clue folder or memory box?", answers: ["Clue folder", "Memory box"] },
      { text: "Pale moonlight or soft sunrise?", answers: ["Pale moonlight", "Soft sunrise"] },
      { text: "Notebook border or diary cover?", answers: ["Notebook border", "Diary cover"] },
      { text: "Hidden drawer or locked diary?", answers: ["Hidden drawer", "Locked diary"] },
      { text: "Puzzle mood or art mood?", answers: ["Puzzle mood", "Art mood"] },
      { text: "Soft green or dusty purple?", answers: ["Soft green", "Dusty purple"] },
      { text: "Case clue or friendship clue?", answers: ["Case clue", "Friendship clue"] },
      { text: "Quiet cafe or cloud room?", answers: ["Quiet cafe", "Cloud room"] },
      { text: "New outfit or new background?", answers: ["New outfit", "New background"] },
      { text: "Diary page or result card?", answers: ["Diary page", "Result card"] },
      { text: "Silver necklace or rose-gold ribbon?", answers: ["Silver necklace", "Rose-gold ribbon"] },
      { text: "Mystery board or soft library?", answers: ["Mystery board", "Soft library"] },
      { text: "Bonus question or bonus theme?", answers: ["Bonus question", "Bonus theme"] },
    ],
  },
  mysteryPersonality: {
    title: "Mystery Personality Quiz",
    eyebrow: "Mystery Style",
    type: "personality",
    roundSize: 8,
    packId: "mystery-personality-pack",
    stars: 5,
    resultTypes: {
      detective: {
        title: "Soft Detective",
        description: "You notice small details and like solving little mysteries calmly.",
        traits: ["Observant", "Calm", "Clever"],
        badge: "Detail Finder",
      },
      library: {
        title: "Cozy Library Friend",
        description: "You like quiet spaces, stories, comfort, and thoughtful moments.",
        traits: ["Thoughtful", "Gentle", "Story-loving"],
        badge: "Library Light",
      },
      diary: {
        title: "Secret Diary Keeper",
        description: "You are thoughtful, private, creative, and good at keeping memories.",
        traits: ["Private", "Creative", "Reflective"],
        badge: "Secret Notes",
      },
      artist: {
        title: "Moonlight Artist",
        description: "You are creative, dreamy, and full of quiet imagination.",
        traits: ["Dreamy", "Artistic", "Imaginative"],
        badge: "Moon Sketcher",
      },
      movie: {
        title: "Mystery Movie Girl",
        description: "You like suspense, clues, and spooky stories that are not too scary.",
        traits: ["Curious", "Stylish", "Brave"],
        badge: "Soft Horror Sleuth",
      },
      collector: {
        title: "Clue Collector",
        description: "You remember details, spot patterns, and like putting pieces together.",
        traits: ["Sharp", "Focused", "Detail-loving"],
        badge: "Clue Master",
      },
      strategist: {
        title: "Quiet Strategist",
        description: "You think before you act and like making smart choices.",
        traits: ["Smart", "Patient", "Careful"],
        badge: "Silent Planner",
      },
      tripPlanner: {
        title: "Dream Trip Planner",
        description: "You love imagining places, adventures, holidays, and future plans.",
        traits: ["Adventurous", "Hopeful", "Organised"],
        badge: "Future Explorer",
      },
      stylish: {
        title: "Stylish Investigator",
        description: "You like mystery, but you also care about style, mood, and aesthetic.",
        traits: ["Aesthetic", "Curious", "Confident"],
        badge: "Case Stylist",
      },
      bestie: {
        title: "Secret Bestie Expert",
        description: "You understand your friends well and notice what makes them special.",
        traits: ["Loyal", "Thoughtful", "Friendly"],
        badge: "Bestie Reader",
      },
      puzzle: {
        title: "Puzzle Solver",
        description: "You enjoy challenges, questions, riddles, and figuring things out.",
        traits: ["Logical", "Curious", "Determined"],
        badge: "Puzzle Pro",
      },
      calm: {
        title: "Calm Star",
        description: "You have a gentle energy and make things feel peaceful.",
        traits: ["Peaceful", "Kind", "Soft"],
        badge: "Gentle Glow",
      },
      maker: {
        title: "Creative Maker",
        description: "You like making things, drawing, designing, crafting, or building ideas.",
        traits: ["Inventive", "Hands-on", "Original"],
        badge: "Idea Builder",
      },
      midnight: {
        title: "Midnight Thinker",
        description: "You think deeply, imagine stories, and like mysterious ideas.",
        traits: ["Deep", "Imaginative", "Mysterious"],
        badge: "Night Mind",
      },
      vibe: {
        title: "Vibe Reader",
        description: "You can sense the mood of a room and understand people's energy.",
        traits: ["Intuitive", "Social", "Observant"],
        badge: "Mood Matcher",
      },
    },
    freeQuestions: [
      { text: "Pick a clue tool.", answers: [{ text: "Magnifying glass", type: "detective" }, { text: "Tiny notebook", type: "diary" }, { text: "Library card", type: "library" }, { text: "Silver pencil", type: "artist" }] },
      { text: "Pick a quiet place.", answers: [{ text: "Clue board corner", type: "detective" }, { text: "Secret desk", type: "diary" }, { text: "Soft library", type: "library" }, { text: "Moonlit window", type: "artist" }] },
      { text: "Pick a case mood.", answers: [{ text: "Notice every detail", type: "detective" }, { text: "Write it all down", type: "diary" }, { text: "Read the room", type: "library" }, { text: "Imagine the answer", type: "artist" }] },
      { text: "Pick a reward.", answers: [{ text: "A solved case stamp", type: "detective" }, { text: "A diary sticker", type: "diary" }, { text: "A new book", type: "library" }, { text: "A shiny art pen", type: "artist" }] },
      { text: "Pick your mystery colour.", answers: [{ text: "Soft silver", type: "detective" }, { text: "Blush pink", type: "diary" }, { text: "Cream", type: "library" }, { text: "Lavender", type: "artist" }] },
      { text: "A clue goes missing. What do you do?", answers: [{ text: "Check every corner", type: "detective" }, { text: "Write what happened", type: "diary" }, { text: "Look for a helpful book", type: "library" }, { text: "Draw the scene", type: "artist" }] },
      { text: "Pick a mystery snack.", answers: [{ text: "Trail mix", type: "detective" }, { text: "Heart cookies", type: "diary" }, { text: "Tea and biscuits", type: "library" }, { text: "Rainbow fruit", type: "artist" }] },
      { text: "Pick a team job.", answers: [{ text: "Lead the search", type: "detective" }, { text: "Keep the notes", type: "diary" }, { text: "Find facts", type: "library" }, { text: "Make the clue map", type: "artist" }] },
      { text: "Pick a case title.", answers: [{ text: "The Missing Key", type: "detective" }, { text: "The Diary Secret", type: "diary" }, { text: "The Library Light", type: "library" }, { text: "The Moon Sketch", type: "artist" }] },
      { text: "What would you notice first?", answers: [{ text: "A tiny footprint", type: "detective" }, { text: "A folded note", type: "diary" }, { text: "A misplaced book", type: "library" }, { text: "A strange pattern", type: "artist" }] },
      { text: "Pick a desk item.", answers: [{ text: "Sticky labels", type: "detective" }, { text: "Diary lock", type: "diary" }, { text: "Reading lamp", type: "library" }, { text: "Paint marker", type: "artist" }] },
      { text: "Pick a friend compliment.", answers: [{ text: "You notice everything", type: "detective" }, { text: "You remember the sweet details", type: "diary" }, { text: "You give calm advice", type: "library" }, { text: "You make everything creative", type: "artist" }] },
      { text: "Pick a weekend plan.", answers: [{ text: "Mini investigation", type: "detective" }, { text: "Diary decorating", type: "diary" }, { text: "Library visit", type: "library" }, { text: "Art afternoon", type: "artist" }] },
      { text: "Pick a clue container.", answers: [{ text: "Case folder", type: "detective" }, { text: "Secret envelope", type: "diary" }, { text: "Book sleeve", type: "library" }, { text: "Sketch pouch", type: "artist" }] },
      { text: "Pick a mystery sound.", answers: [{ text: "Tiny click", type: "detective" }, { text: "Page turn", type: "diary" }, { text: "Soft footsteps", type: "library" }, { text: "Pencil scratch", type: "artist" }] },
      { text: "Pick a room detail.", answers: [{ text: "Clue pins", type: "detective" }, { text: "Diary stickers", type: "diary" }, { text: "Book stacks", type: "library" }, { text: "Moon poster", type: "artist" }] },
      { text: "Pick a final move.", answers: [{ text: "Solve the timeline", type: "detective" }, { text: "Save the memory", type: "diary" }, { text: "Explain the clue", type: "library" }, { text: "Draw the answer", type: "artist" }] },
      { text: "Pick a badge.", answers: [{ text: "Investigator badge", type: "detective" }, { text: "Diary keeper badge", type: "diary" }, { text: "Library friend badge", type: "library" }, { text: "Moon artist badge", type: "artist" }] },
      { text: "Pick a bag charm.", answers: [{ text: "Silver key", type: "detective" }, { text: "Tiny heart", type: "diary" }, { text: "Mini book", type: "library" }, { text: "Star charm", type: "artist" }] },
      { text: "Pick how you solve problems.", answers: [{ text: "Look closely", type: "detective" }, { text: "Think about feelings", type: "diary" }, { text: "Research calmly", type: "library" }, { text: "Try a new idea", type: "artist" }] },
      { text: "Pick a secret club name.", answers: [{ text: "The Case Crew", type: "detective" }, { text: "The Diary Circle", type: "diary" }, { text: "The Book Nook", type: "library" }, { text: "The Moon Makers", type: "artist" }] },
      { text: "What kind of place would you explore first?", answers: [{ text: "Old cinema lobby", type: "movie" }, { text: "Puzzle room", type: "puzzle" }, { text: "Pretty boutique corner", type: "stylish" }, { text: "Quiet garden path", type: "calm" }] },
      { text: "What would you bring to a mystery sleepover?", answers: [{ text: "A clue checklist", type: "collector" }, { text: "A craft kit", type: "maker" }, { text: "A soft blanket", type: "calm" }, { text: "A suspense movie list", type: "movie" }] },
      { text: "What kind of story do you like most?", answers: [{ text: "A clever puzzle story", type: "puzzle" }, { text: "A dreamy midnight story", type: "midnight" }, { text: "A bestie secret story", type: "bestie" }, { text: "A travel adventure story", type: "tripPlanner" }] },
      { text: "What do your friends come to you for?", answers: [{ text: "Kind advice", type: "bestie" }, { text: "A smart plan", type: "strategist" }, { text: "Creative ideas", type: "maker" }, { text: "Reading the mood", type: "vibe" }] },
      { text: "What would your secret notebook be filled with?", answers: [{ text: "Patterns and clues", type: "collector" }, { text: "Outfit ideas", type: "stylish" }, { text: "Trip plans", type: "tripPlanner" }, { text: "Deep story ideas", type: "midnight" }] },
      { text: "What kind of clue would you notice first?", answers: [{ text: "A tiny pattern", type: "collector" }, { text: "A strange sound", type: "movie" }, { text: "A mood shift", type: "vibe" }, { text: "A hard riddle", type: "puzzle" }] },
      { text: "What is your weekend vibe?", answers: [{ text: "Designing something", type: "maker" }, { text: "Planning a dream trip", type: "tripPlanner" }, { text: "A calm cozy day", type: "calm" }, { text: "A stylish case board", type: "stylish" }] },
      { text: "What kind of room feels most like you?", answers: [{ text: "A moonlit thinking room", type: "midnight" }, { text: "A puzzle table room", type: "puzzle" }, { text: "A bestie hangout room", type: "bestie" }, { text: "A soft aesthetic room", type: "stylish" }] },
      { text: "What would you do if you found a locked box?", answers: [{ text: "Plan a careful way to open it", type: "strategist" }, { text: "Collect every clue around it", type: "collector" }, { text: "Imagine the story behind it", type: "midnight" }, { text: "Make a tiny sketch of it", type: "maker" }] },
      { text: "What kind of badge would you want?", answers: [{ text: "Mood Matcher", type: "vibe" }, { text: "Future Explorer", type: "tripPlanner" }, { text: "Case Stylist", type: "stylish" }, { text: "Puzzle Pro", type: "puzzle" }] },
    ],
    packQuestions: [
      { text: "Pick a premium clue style.", answers: [{ text: "Laser focus", type: "detective" }, { text: "Memory keeper", type: "diary" }, { text: "Quiet wisdom", type: "library" }, { text: "Dreamy maker", type: "artist" }] },
      { text: "Pick a mystery room.", answers: [{ text: "Case wall", type: "detective" }, { text: "Diary desk", type: "diary" }, { text: "Moon library", type: "library" }, { text: "Art window", type: "artist" }] },
      { text: "Pick a special power.", answers: [{ text: "Spot hidden clues", type: "detective" }, { text: "Remember kind moments", type: "diary" }, { text: "Know where to look", type: "library" }, { text: "Imagine new paths", type: "artist" }] },
      { text: "Pick a bonus case board.", answers: [{ text: "Colour-coded plan", type: "strategist" }, { text: "Pressed flower clue", type: "calm" }, { text: "Library map", type: "library" }, { text: "Sketch trail", type: "artist" }] },
      { text: "Pick a premium badge phrase.", answers: [{ text: "Plan first", type: "strategist" }, { text: "Notice the vibe", type: "vibe" }, { text: "Keep the story", type: "diary" }, { text: "Find the detail", type: "detective" }] },
      { text: "Pick a new clue place.", answers: [{ text: "Garden bench", type: "calm" }, { text: "Strategy desk", type: "strategist" }, { text: "Reading nook", type: "library" }, { text: "Moon art wall", type: "artist" }] },
      { text: "Pick how you help the team.", answers: [{ text: "Make a careful plan", type: "strategist" }, { text: "Keep everyone calm", type: "calm" }, { text: "Save the memories", type: "diary" }, { text: "Search the scene", type: "detective" }] },
      { text: "Pick a premium colour mix.", answers: [{ text: "Soft green and cream", type: "calm" }, { text: "Silver and blue", type: "strategist" }, { text: "Pink and pearl", type: "diary" }, { text: "Lavender and ink", type: "artist" }] },
      { text: "Pick a clue challenge.", answers: [{ text: "Arrange the clues", type: "strategist" }, { text: "Match the mood", type: "vibe" }, { text: "Read between lines", type: "library" }, { text: "Spot the sparkle", type: "detective" }] },
      { text: "Pick a secret meeting spot.", answers: [{ text: "Garden arch", type: "calm" }, { text: "Planning table", type: "strategist" }, { text: "Diary desk", type: "diary" }, { text: "Library window", type: "library" }] },
      { text: "Pick a mystery habit.", answers: [{ text: "Sort clues neatly", type: "strategist" }, { text: "Notice soft details", type: "vibe" }, { text: "Write kind notes", type: "diary" }, { text: "Draw fresh ideas", type: "artist" }] },
      { text: "Pick a premium result card.", answers: [{ text: "The Planner", type: "strategist" }, { text: "The Gentle Glow", type: "calm" }, { text: "The Quiet Reader", type: "library" }, { text: "The Detail Hunter", type: "detective" }] },
      { text: "Pick a final case reward.", answers: [{ text: "Silver plan pin", type: "strategist" }, { text: "Soft star charm", type: "calm" }, { text: "Diary ribbon", type: "diary" }, { text: "Moon pencil", type: "artist" }] },
      { text: "Pick a movie-night clue.", answers: [{ text: "A suspenseful soundtrack", type: "movie" }, { text: "A hidden pattern", type: "collector" }, { text: "A stylish poster", type: "stylish" }, { text: "A friend reaction", type: "bestie" }] },
      { text: "Pick a future plan.", answers: [{ text: "Dream holiday map", type: "tripPlanner" }, { text: "Step-by-step list", type: "strategist" }, { text: "Craft supplies", type: "maker" }, { text: "Quiet thinking time", type: "midnight" }] },
      { text: "Pick a harder clue.", answers: [{ text: "A riddle with layers", type: "puzzle" }, { text: "A tiny repeated symbol", type: "collector" }, { text: "A secret friendship hint", type: "bestie" }, { text: "A room mood change", type: "vibe" }] },
      { text: "Pick a secret notebook page.", answers: [{ text: "Puzzle grid", type: "puzzle" }, { text: "Travel wishlist", type: "tripPlanner" }, { text: "Fashion case board", type: "stylish" }, { text: "Midnight thoughts", type: "midnight" }] },
      { text: "Pick your mystery role.", answers: [{ text: "Clue archivist", type: "collector" }, { text: "Scene stylist", type: "stylish" }, { text: "Bestie reader", type: "bestie" }, { text: "Idea builder", type: "maker" }] },
      { text: "Pick a quiet power.", answers: [{ text: "Staying peaceful", type: "calm" }, { text: "Thinking deeply", type: "midnight" }, { text: "Solving riddles", type: "puzzle" }, { text: "Understanding people", type: "vibe" }] },
      { text: "Pick a bonus sleepover item.", answers: [{ text: "Mini projector", type: "movie" }, { text: "Friend quiz cards", type: "bestie" }, { text: "Craft box", type: "maker" }, { text: "Future trip journal", type: "tripPlanner" }] },
      { text: "Pick a mystery challenge prize.", answers: [{ text: "Clue Master badge", type: "collector" }, { text: "Puzzle Pro badge", type: "puzzle" }, { text: "Case Stylist badge", type: "stylish" }, { text: "Night Mind badge", type: "midnight" }] },
      { text: "Pick a creative clue style.", answers: [{ text: "Build a model", type: "maker" }, { text: "Draw a scene", type: "artist" }, { text: "Write a memory", type: "diary" }, { text: "Plan the order", type: "strategist" }] },
      { text: "Pick your friend-group superpower.", answers: [{ text: "Knowing what friends need", type: "bestie" }, { text: "Keeping the mood kind", type: "vibe" }, { text: "Making everyone calm", type: "calm" }, { text: "Finding the missing detail", type: "detective" }] },
    ],
  },
  guessFavourite: {
    title: "Guess My Favourite",
    eyebrow: "Favourite Game",
    type: "scored",
    roundSize: 10,
    packId: "extra-quiz-theme-pack",
    freeQuestions: [
      { text: "Which treat is the favourite?", answers: ["Sushi", "Ice cream", "Oreos", "Cupcakes"], correct: 0 },
      { text: "Which colour has the mystery vibe?", answers: ["Lavender", "Neon green", "Brown", "Black"], correct: 0 },
      { text: "Which activity sounds coziest?", answers: ["Reading", "Running laps", "Washing dishes", "Loud alarms"], correct: 0 },
      { text: "Which hangout sounds best?", answers: ["Movie night", "Math test", "Cleaning day", "Waiting room"], correct: 0 },
      { text: "Which trip sounds dreamy?", answers: ["Japan", "The mailbox", "A car park", "The dentist"], correct: 0 },
      { text: "Which room background feels softest?", answers: ["Lavender room", "Dark cave", "Busy road", "Loud gym"], correct: 0 },
      { text: "Which accessory feels most mysterious?", answers: ["Silver key", "Traffic cone", "Lunch tray", "Plain sock"], correct: 0 },
      { text: "Which diary colour is prettiest?", answers: ["Dusty pink", "Mud brown", "Neon orange", "Plain grey"], correct: 0 },
      { text: "Which outfit feels comfiest?", answers: ["Cozy hoodie", "Scratchy costume", "Rain poncho indoors", "Heavy armor"], correct: 0 },
      { text: "Which game sounds most fun?", answers: ["This or That", "Staring contest forever", "Waiting quietly", "Doing chores"], correct: 0 },
      { text: "Which theme sounds calm?", answers: ["Moonlight library", "Alarm room", "Thunder dungeon", "Messy garage"], correct: 0 },
      { text: "Which badge would be exciting?", answers: ["Secret Badge", "Blank sticker", "Lost button", "Old receipt"], correct: 0 },
      { text: "Which place is best for a clue?", answers: ["Soft library", "Trash bin", "Traffic jam", "Noisy hallway"], correct: 0 },
      { text: "Which friend plan is sweetest?", answers: ["Picnic", "Ignoring everyone", "Losing the map", "Skipping kindness"], correct: 0 },
      { text: "Which colour sounds dreamy?", answers: ["Pale blue", "Rust", "Sludge", "Warning orange"], correct: 0 },
      { text: "Which emoji avatar sounds cute?", answers: ["Sparkle Moon", "Paper bag", "Broken shoelace", "Dusty box"], correct: 0 },
      { text: "Which clue tool is useful?", answers: ["Notebook", "Banana peel", "Empty cup", "Wrong map"], correct: 0 },
      { text: "Which result style sounds best?", answers: ["Custom Result Card", "Blank page", "Tiny receipt", "No result"], correct: 0 },
      { text: "Which sky sounds peaceful?", answers: ["Cloudy sky", "Smoke cloud", "Storm warning", "Blackout"], correct: 0 },
      { text: "Which snack is a fun guess?", answers: ["Cupcakes", "Plain broccoli water", "Empty plate", "Burnt toast"], correct: 0 },
    ],
    packQuestions: [
      { text: "Which extra theme sounds fun?", answers: ["Secret Garden Theme", "Plain wall", "Empty box", "Broken clock"], correct: 0 },
      { text: "Which premium item sounds best?", answers: ["Premium Diary Cover", "Old wrapper", "Dull rock", "Scratch paper"], correct: 0 },
      { text: "Which game mode sounds exciting?", answers: ["Hard Mode", "No choices mode", "Blank quiz", "Quiet screen"], correct: 0 },
      { text: "Family theme: Which family game night sounds fun?", answers: ["Board games", "Arguing", "No turns", "Silent room"], correct: 0 },
      { text: "Sibling theme: Which shared plan is kindest?", answers: ["Take turns", "Grab first", "Hide pieces", "Ignore rules"], correct: 0 },
      { text: "Classmate theme: What helps a classmate feel included?", answers: ["Invite them kindly", "Whisper about them", "Take their seat", "Make faces"], correct: 0 },
      { text: "Mystery theme: Which clue would help most?", answers: ["Clear note", "Random smudge", "Empty box", "Torn wrapper"], correct: 0 },
      { text: "Diary style: Which page would be sweetest?", answers: ["Memory page", "Blank warning", "Lost list", "Messy scribble"], correct: 0 },
      { text: "Family theme: Which snack table feels friendly?", answers: ["Shared treats", "Hidden snacks", "No plates", "Locked cupboard"], correct: 0 },
      { text: "Sibling theme: Which clue team works best?", answers: ["Teamwork", "Blaming", "Shouting", "Quitting"], correct: 0 },
      { text: "Classmate theme: Which project choice is best?", answers: ["Plan together", "Do nothing", "Hide the glue", "Rush badly"], correct: 0 },
      { text: "Mystery theme: Which case title sounds coolest?", answers: ["The Silver Key", "The Boring Wall", "The Empty Bin", "The Missing Sock Pile"], correct: 0 },
      { text: "Diary style: Which sticker would match a happy day?", answers: ["Tiny star", "Spilled ink", "Cracked tile", "Plain tape"], correct: 0 },
      { text: "Family theme: Which kindness clue matters most?", answers: ["Helping out", "Ignoring chores", "Taking credit", "Leaving mess"], correct: 0 },
      { text: "Sibling theme: Which answer is most fair?", answers: ["Share turns", "Always first", "Never listen", "Hide the game"], correct: 0 },
      { text: "Classmate theme: Which clue shows teamwork?", answers: ["Everyone gets a role", "One person does all", "No one listens", "Lost plan"], correct: 0 },
      { text: "Mystery theme: Which room should the case start in?", answers: ["Soft library", "Loud hallway", "Dark basement", "Broken shed"], correct: 0 },
      { text: "Diary style: Which diary cover sounds calm?", answers: ["Pearl lavender", "Muddy brown", "Warning stripe", "Plain cardboard"], correct: 0 },
      { text: "Family theme: Which trip clue sounds safe and fun?", answers: ["Museum day", "Running away", "Secret address", "No plan"], correct: 0 },
      { text: "Sibling theme: Which surprise is thoughtful?", answers: ["A kind note", "A prank that hurts", "A hidden toy", "A fake clue"], correct: 0 },
      { text: "Classmate theme: Which recess idea is best?", answers: ["Fair game", "Leaving people out", "Changing rules unfairly", "Taking the ball"], correct: 0 },
      { text: "Mystery theme: Which clue tool is most useful?", answers: ["Checklist", "Crumbled paper", "Broken pen", "No clue"], correct: 0 },
      { text: "Diary style: Which result page sounds pretty?", answers: ["Soft ribbon card", "Grey square", "Blank page", "Tiny error"], correct: 0 },
    ],
  },
};

const starterCustomQuiz = [
  {
    text: "What is my third favourite colour?",
    answers: ["Purple", "Pink", "Blue", "Green"],
    correct: 2,
  },
  {
    text: "What is my dream trip?",
    answers: ["Disneyland", "First class trip to Japan", "First class trip to China", "Skip school for a week"],
    correct: 1,
  },
  {
    text: "About how many people are in my family?",
    answers: ["4", "8", "9", "21"],
    correct: 1,
  },
  {
    text: "What is one of my favourite treats?",
    answers: ["Meat", "Ice cream", "Sushi", "Oreos"],
    correct: 2,
  },
  {
    text: "What is my hobby?",
    answers: ["Eating", "Reading", "Talking", "Sleeping for as long as I like"],
    correct: 1,
  },
  {
    text: "What do I like to do when I play with a friend?",
    answers: ["Watch a movie", "Eat", "Go to a park", "Have a picnic"],
    correct: 0,
  },
  {
    text: "What is Diva's last name?",
    answers: ["Chen", "Ma", "Diva", "Da Burritoooooo"],
    correct: 3,
  },
  {
    text: "What do I do in my free time?",
    answers: ["Read", "Draw", "Play with Diva", "Day-dream"],
    correct: 1,
  },
  {
    text: "Who is my second best friend?",
    answers: ["Katie", "Georgina", "Tiana", "Freya (from art)"],
    correct: 3,
  },
  {
    text: "What is my favourite crafting game?",
    answers: ["Minecraft", "DIY making craft", "Origami", "Other"],
    correct: 0,
  },
];

let questions = [];
let currentQuestion = 0;
let correctAnswers = 0;
let latestResult = null;
let activeQuizSource = "custom";
let activeQuizMode = "scored";
let activeQuizId = "";
let activeOnlineQuizId = "";
let onlineLeaderboardEntries = [];
let sharedQuizMode = "manual";
let currentSharedQuiz = null;
let editingQuizId = "";
let activePlayer = null;
let guestMode = false;
let selectedAvatar = {};
let activeMiniGame = null;
let miniGameQuestionIndex = 0;
let miniGameCorrectAnswers = 0;
let miniGameResultScores = {};
let miniGameAwarded = false;
let miniGameRoundQuestions = [];
let sharedLinkQuestions = [];
let selectedChatFriendCode = "";
let activeOnlineChatMessages = [];
let chatLoadedFromSupabase = false;
let selectedFriendActionCode = "";
let activeBoxOfLiesRound = null;
let activeTradingFriendCode = "";
let activeTradingDraft = { offered: {}, requested: {} };
let pendingGameInviteId = "";
let onlineAccountSyncInProgress = false;
let usernamePinSession = null;
let usernameAccountMode = "login";
let presenceUpdateTimer = null;

const playerGate = document.querySelector("#player-gate");
const createPlayerChoice = document.querySelector("#create-player-choice");
const usernameLoginChoice = document.querySelector("#username-login-choice");
const onlineAuthChoice = document.querySelector("#online-auth-choice");
const loginPlayerChoice = document.querySelector("#login-player-choice");
const guestPlayerChoice = document.querySelector("#guest-player-choice");
const createPlayerCard = document.querySelector("#create-player-card");
const loginPlayerCard = document.querySelector("#login-player-card");
const usernameLoginCard = document.querySelector("#username-login-card");
const onlineAuthCard = document.querySelector("#online-auth-card");
const createPlayerForm = document.querySelector("#create-player-form");
const loginPlayerForm = document.querySelector("#login-player-form");
const usernameLoginForm = document.querySelector("#username-login-form");
const usernameCreateForm = document.querySelector("#username-create-form");
const accountLoginTab = document.querySelector("#account-login-tab");
const accountCreateTab = document.querySelector("#account-create-tab");
const usernameOpenCreateButton = document.querySelector("#username-open-create");
const usernameBackLoginButton = document.querySelector("#username-back-login");
const authSignupForm = document.querySelector("#auth-signup-form");
const authLoginForm = document.querySelector("#auth-login-form");
const profileHomeButtons = document.querySelectorAll(".profile-home-button");
const profileBar = document.querySelector("#profile-bar");
const heroLoginButton = document.querySelector("#hero-login-button");
const heroGuestButton = document.querySelector("#hero-guest-button");
const profileAvatar = document.querySelector("#profile-avatar");
const profileName = document.querySelector("#profile-name");
const profileFriendCode = document.querySelector("#profile-friend-code");
const starsTotal = document.querySelector("#stars-total");
const openShopButton = document.querySelector("#open-shop");
const openStarLeaderboardButton = document.querySelector("#open-star-leaderboard");
const openFriendsButton = document.querySelector("#open-friends");
const openChatButton = document.querySelector("#open-chat");
const editAvatarButton = document.querySelector("#edit-avatar");
const authLogoutButton = document.querySelector("#auth-logout");
const switchPlayerButton = document.querySelector("#switch-player");
const createPlayerMessage = document.querySelector("#create-player-message");
const createPlayerTitle = document.querySelector("#create-player-title");
const loginPlayerMessage = document.querySelector("#login-player-message");
const authMessage = document.querySelector("#auth-message");
const newPlayerNickname = document.querySelector("#new-player-nickname");
const avatarNameInput = document.querySelector("#avatar-name");
const loginPlayerNickname = document.querySelector("#login-player-nickname");
const usernameLoginName = document.querySelector("#username-login-name");
const usernameLoginPin = document.querySelector("#username-login-pin");
const usernameCreateName = document.querySelector("#username-create-name");
const usernameCreatePin = document.querySelector("#username-create-pin");
const usernameCreateConfirmPin = document.querySelector("#username-create-confirm-pin");
const usernameCreateAccountButton = document.querySelector("#username-create-account");
const usernameLoginAccountButton = document.querySelector("#username-login-account");
const usernameLoginMessage = document.querySelector("#username-login-message");
const usernameCreateMessage = document.querySelector("#username-create-message");
const usernameAvatarPreview = document.querySelector("#username-avatar-preview");
const usernameAvatarOptionPanels = document.querySelector("#username-avatar-option-panels");
const authSignupEmail = document.querySelector("#auth-signup-email");
const authSignupPassword = document.querySelector("#auth-signup-password");
const authSignupNickname = document.querySelector("#auth-signup-nickname");
const authLoginEmail = document.querySelector("#auth-login-email");
const authLoginPassword = document.querySelector("#auth-login-password");
const avatarPreview = document.querySelector("#avatar-preview");
const avatarOptionPanels = document.querySelector("#avatar-option-panels");
const gameMenuCard = document.querySelector("#game-menu-card");
const gamesCard = document.querySelector("#games-card");
const playBestieGameButton = document.querySelector("#play-bestie-game");
const playWouldYouRatherGameButton = document.querySelector("#play-would-you-rather-game");
const playThisOrThatGameButton = document.querySelector("#play-this-or-that-game");
const playMysteryGameButton = document.querySelector("#play-mystery-game");
const playFavouriteGameButton = document.querySelector("#play-favourite-game");
const playBoxOfLiesGameButton = document.querySelector("#play-box-of-lies-game");
const playTradingGameButton = document.querySelector("#play-trading-game");
const featureBestieQuizButton = document.querySelector("#feature-bestie-quiz");
const featureGamesButton = document.querySelector("#feature-games");
const featureMyQuizzesButton = document.querySelector("#feature-my-quizzes");
const featureFriendLinksButton = document.querySelector("#feature-friend-links");
const featureFriendsButton = document.querySelector("#feature-friends");
const featureChatButton = document.querySelector("#feature-chat");
const featureShopButton = document.querySelector("#feature-shop");
const featureDiaryButton = document.querySelector("#feature-diary");
const featureThemesButton = document.querySelector("#feature-themes");
const featureStarLeaderboardButton = document.querySelector("#feature-star-leaderboard");
const packStatusBadges = document.querySelectorAll(".pack-status");
const startCard = document.querySelector("#start-card");
const makeOwnQuizButton = document.querySelector("#make-own-quiz");
const createAvatarHomeButton = document.querySelector("#create-avatar-home");
const playSafeQuizzesButton = document.querySelector("#play-safe-quizzes");
const playSharedQuizButton = document.querySelector("#play-shared-quiz");
const safeQuizCard = document.querySelector("#safe-quiz-card");
const safeQuizList = document.querySelector("#safe-quiz-list");
const myQuizzesCard = document.querySelector("#my-quizzes-card");
const createNewQuizButton = document.querySelector("#create-new-quiz");
const myQuizzesMessage = document.querySelector("#my-quizzes-message");
const myQuizzesList = document.querySelector("#my-quizzes-list");
const sharedQuizCard = document.querySelector("#shared-quiz-card");
const sharedQuizCode = document.querySelector("#shared-quiz-code");
const sharedQuizMessage = document.querySelector("#shared-quiz-message");
const loadSharedQuizButton = document.querySelector("#load-shared-quiz");
const manualSharedQuizPanel = document.querySelector("#manual-shared-quiz-panel");
const sharedLinkPanel = document.querySelector("#shared-link-panel");
const startSharedLinkQuizButton = document.querySelector("#start-shared-link-quiz");
const creatorCard = document.querySelector("#creator-card");
const quizBuilderForm = document.querySelector("#quiz-builder-form");
const quizTitleInput = document.querySelector("#quiz-title-input");
const quizThemeInput = document.querySelector("#quiz-theme-input");
const questionTotalInput = document.querySelector("#question-total");
const creatorFields = document.querySelector("#creator-fields");
const creatorMessage = document.querySelector("#creator-message");
const playSavedQuizButton = document.querySelector("#play-saved-quiz");
const createFriendLinkButton = document.querySelector("#create-friend-link");
const friendLinkOutputWrap = document.querySelector("#friend-link-output-wrap");
const friendLinkOutput = document.querySelector("#friend-link-output");
const copyFriendLinkButton = document.querySelector("#copy-friend-link");
const friendLinkMessage = document.querySelector("#friend-link-message");
const homeButtons = document.querySelectorAll(".home-button");
const quizCard = document.querySelector("#quiz-card");
const resultCard = document.querySelector("#result-card");
const questionCount = document.querySelector("#question-count");
const scoreCount = document.querySelector("#score-count");
const questionText = document.querySelector("#question-text");
const answerList = document.querySelector("#answer-list");
const resultScore = document.querySelector("#result-score");
const resultMessage = document.querySelector("#result-message");
const leaderboardForm = document.querySelector("#leaderboard-form");
const nicknameInput = document.querySelector("#nickname");
const leaderboardNicknameMessage = document.querySelector("#leaderboard-nickname-message");
const playAgainButton = document.querySelector("#play-again");
const restartQuizButton = document.querySelector("#restart-quiz");
const editCurrentQuizButton = document.querySelector("#edit-current-quiz");
const editQuizButton = document.querySelector("#edit-quiz");
const leaderboardSection = document.querySelector("#leaderboard-section");
const leaderboardList = document.querySelector("#leaderboard-list");
const starLeaderboardCard = document.querySelector("#star-leaderboard-card");
const starLeaderboardList = document.querySelector("#star-leaderboard-list");
const resetEverythingButton = document.querySelector("#reset-everything");
const shopCard = document.querySelector("#shop-card");
const shopStars = document.querySelector("#shop-stars");
const shopMessage = document.querySelector("#shop-message");
const shopTabs = document.querySelector("#shop-tabs");
const shopList = document.querySelector("#shop-list");
const friendsCard = document.querySelector("#friends-card");
const myFriendCode = document.querySelector("#my-friend-code");
const copyFriendCodeButton = document.querySelector("#copy-friend-code");
const friendCodeInput = document.querySelector("#friend-code-input");
const addFriendButton = document.querySelector("#add-friend-button");
const friendsMessage = document.querySelector("#friends-message");
const friendsList = document.querySelector("#friends-list");
const friendActionPanel = document.querySelector("#friend-action-panel");
const friendActionTitle = document.querySelector("#friend-action-title");
const friendQuizSelect = document.querySelector("#friend-quiz-select");
const sendFriendChallengeButton = document.querySelector("#send-friend-challenge");
const friendChallengeOutputWrap = document.querySelector("#friend-challenge-output-wrap");
const friendChallengeOutput = document.querySelector("#friend-challenge-output");
const copyFriendChallengeButton = document.querySelector("#copy-friend-challenge");
const friendPresetMessageList = document.querySelector("#friend-preset-message-list");
const friendStickerList = document.querySelector("#friend-sticker-list");
const friendActionMessage = document.querySelector("#friend-action-message");
const friendActivityList = document.querySelector("#friend-activity-list");
const chatCard = document.querySelector("#chat-card");
const chatFriendList = document.querySelector("#chat-friend-list");
const chatSelectedFriend = document.querySelector("#chat-selected-friend");
const chatSendQuizButton = document.querySelector("#chat-send-quiz");
const chatBlockFriendButton = document.querySelector("#chat-block-friend");
const chatRemoveFriendButton = document.querySelector("#chat-remove-friend");
const chatQuizPanel = document.querySelector("#chat-quiz-panel");
const chatQuizSelect = document.querySelector("#chat-quiz-select");
const chatSendQuizConfirmButton = document.querySelector("#chat-send-quiz-confirm");
const chatQuizMessage = document.querySelector("#chat-quiz-message");
const chatHistory = document.querySelector("#chat-history");
const quickMessageList = document.querySelector("#quick-message-list");
const stickerReactionList = document.querySelector("#sticker-reaction-list");
const gameInviteList = document.querySelector("#game-invite-list");
const chatMessageInput = document.querySelector("#chat-message-input");
const sendChatMessageButton = document.querySelector("#send-chat-message");
const clearChatButton = document.querySelector("#clear-chat");
const chatMessage = document.querySelector("#chat-message");
const diaryCard = document.querySelector("#diary-card");
const diaryNote = document.querySelector("#diary-note");
const diaryMoodPanel = document.querySelector("#diary-mood-panel");
const diaryStickerPanel = document.querySelector("#diary-sticker-panel");
const diaryMessage = document.querySelector("#diary-message");
const diaryHistory = document.querySelector("#diary-history");
const saveDiaryNoteButton = document.querySelector("#save-diary-note");
const backToShopButton = document.querySelector("#back-to-shop");
const gamesButtons = document.querySelectorAll(".games-button");
const miniGameCard = document.querySelector("#mini-game-card");
const miniGameEyebrow = document.querySelector("#mini-game-eyebrow");
const miniGameTitle = document.querySelector("#mini-game-title");
const miniGameProgress = document.querySelector("#mini-game-progress");
const miniGameQuestion = document.querySelector("#mini-game-question");
const miniGameChoices = document.querySelector("#mini-game-choices");
const miniGameResult = document.querySelector("#mini-game-result");
const miniGameResultTitle = document.querySelector("#mini-game-result-title");
const miniGameResultMessage = document.querySelector("#mini-game-result-message");
const miniGameStars = document.querySelector("#mini-game-stars");
const miniGameLeaderboardTitle = document.querySelector("#mini-game-leaderboard-title");
const miniGameLeaderboardList = document.querySelector("#mini-game-leaderboard-list");
const miniGameAgainButton = document.querySelector("#mini-game-again");
const boxOfLiesCard = document.querySelector("#box-of-lies-card");
const boxOfLiesContent = document.querySelector("#box-of-lies-content");
const boxOfLiesMessage = document.querySelector("#box-of-lies-message");
const tradingGameCard = document.querySelector("#trading-game-card");
const tradingGameContent = document.querySelector("#trading-game-content");
const tradingGameMessage = document.querySelector("#trading-game-message");

function clampQuestionCount(value) {
  const questionCountValue = Number.parseInt(value, 10);

  if (Number.isNaN(questionCountValue)) {
    return minQuestions;
  }

  return Math.min(Math.max(questionCountValue, minQuestions), maxQuestions);
}

function getSavedQuiz() {
  const savedQuiz = localStorage.getItem(quizKey);

  if (!savedQuiz) {
    return [];
  }

  try {
    const parsedQuiz = JSON.parse(savedQuiz);
    return normalizeQuizQuestions(parsedQuiz);
  } catch {
    return [];
  }
}

function saveQuiz(quizQuestions) {
  localStorage.setItem(quizKey, JSON.stringify(quizQuestions));
}

function normalizeSavedQuizRecord(quiz, fallbackTitle = "Untitled Quiz") {
  const questions = normalizeQuizQuestions(quiz?.questions || quiz);
  const now = new Date().toISOString();

  return {
    id: quiz?.id || `quiz-${crypto.randomUUID()}`,
    onlineQuizId: quiz?.onlineQuizId || quiz?.quizId || "",
    title: String(quiz?.title || fallbackTitle).trim() || fallbackTitle,
    theme: String(quiz?.theme || "Best Friend").trim(),
    createdAt: quiz?.createdAt || now,
    updatedAt: quiz?.updatedAt || quiz?.createdAt || now,
    questions,
  };
}

function getSavedQuizzesRaw() {
  const savedQuizzes = localStorage.getItem(savedQuizzesKey);

  if (!savedQuizzes) {
    return [];
  }

  try {
    const parsedQuizzes = JSON.parse(savedQuizzes);
    return Array.isArray(parsedQuizzes) ? parsedQuizzes : [];
  } catch {
    return [];
  }
}

function saveSavedQuizzes(quizzes) {
  localStorage.setItem(savedQuizzesKey, JSON.stringify(quizzes));

  if (onlineAccountStorage?.isLoggedIn && !onlineAccountSyncInProgress) {
    onlineAccountStorage.saveQuizzes(quizzes).catch((error) => {
      console.error("Supabase saved quizzes sync error:", error);
    });
  }

  if (usernamePinSession && activePlayer && !onlineAccountSyncInProgress) {
    syncActiveProfileOnline();
  }
}

function migrateOldQuizToSavedQuizzes() {
  const savedQuizzes = getSavedQuizzesRaw()
    .map((quiz, index) => normalizeSavedQuizRecord(quiz, index === 0 ? "My First Quiz" : `Quiz ${index + 1}`))
    .filter((quiz) => quiz.questions.length > 0);

  if (savedQuizzes.length > 0) {
    saveSavedQuizzes(savedQuizzes);
    return savedQuizzes;
  }

  const oldQuiz = getSavedQuiz();

  if (oldQuiz.length > 0) {
    const migratedQuiz = normalizeSavedQuizRecord({
      title: "My First Quiz",
      theme: "Best Friend",
      questions: oldQuiz,
    });
    saveSavedQuizzes([migratedQuiz]);
    return [migratedQuiz];
  }

  return [];
}

function getSavedQuizzes() {
  return migrateOldQuizToSavedQuizzes();
}

function findSavedQuizById(quizId) {
  return getSavedQuizzes().find((quiz) => quiz.id === quizId) || null;
}

function getPlayerProfiles() {
  const savedProfiles = localStorage.getItem(playerProfilesKey);

  if (!savedProfiles) {
    return [];
  }

  try {
    const profiles = JSON.parse(savedProfiles);
    return Array.isArray(profiles) ? profiles : [];
  } catch {
    return [];
  }
}

function savePlayerProfiles(profiles) {
  localStorage.setItem(playerProfilesKey, JSON.stringify(profiles));
}

function normalizeNickname(nickname) {
  return String(nickname || "").trim().toLowerCase();
}

function cleanPlayerNickname(nickname) {
  return String(nickname || "").trim().slice(0, 20);
}

function looksLikeFullName(nickname) {
  return /^[a-z]+(?:\s+[a-z]+)+$/i.test(String(nickname || "").trim());
}

function getUsedNicknames() {
  const savedNicknames = localStorage.getItem(usedNicknamesKey);

  if (!savedNicknames) {
    return [];
  }

  try {
    const nicknames = JSON.parse(savedNicknames);
    return Array.isArray(nicknames) ? nicknames.filter((entry) => entry?.normalizedName) : [];
  } catch {
    return [];
  }
}

function saveUsedNicknames(nicknames) {
  const uniqueNicknames = [];
  const seenNames = new Set();

  nicknames.forEach((entry) => {
    const normalizedName = normalizeNickname(entry.normalizedName || entry.displayName);

    if (!normalizedName || seenNames.has(normalizedName)) {
      return;
    }

    seenNames.add(normalizedName);
    uniqueNicknames.push({
      displayName: String(entry.displayName || normalizedName).trim(),
      normalizedName,
      createdAt: entry.createdAt || new Date().toISOString(),
    });
  });

  localStorage.setItem(usedNicknamesKey, JSON.stringify(uniqueNicknames));
}

function registerUsedNickname(nickname) {
  const displayName = cleanPlayerNickname(nickname);
  const normalizedName = normalizeNickname(displayName);

  if (!normalizedName) {
    return;
  }

  const usedNicknames = getUsedNicknames();
  const existingNickname = usedNicknames.find((entry) => entry.normalizedName === normalizedName);

  if (existingNickname) {
    return;
  }

  saveUsedNicknames([
    ...usedNicknames,
    {
      displayName,
      normalizedName,
      createdAt: new Date().toISOString(),
    },
  ]);
}

function replaceUsedNickname(oldNickname, newNickname) {
  const oldName = normalizeNickname(oldNickname);
  const newDisplayName = cleanPlayerNickname(newNickname);
  const newName = normalizeNickname(newDisplayName);
  const nicknames = getUsedNicknames().filter((entry) => entry.normalizedName !== oldName && entry.normalizedName !== newName);

  if (newName) {
    nicknames.push({
      displayName: newDisplayName,
      normalizedName: newName,
      createdAt: new Date().toISOString(),
    });
  }

  saveUsedNicknames(nicknames);
}

function seedUsedNicknamesFromSavedData() {
  const nicknames = getUsedNicknames();
  const addNickname = (nickname) => {
    const displayName = cleanPlayerNickname(nickname);
    const normalizedName = normalizeNickname(displayName);

    if (!normalizedName || nicknames.some((entry) => entry.normalizedName === normalizedName)) {
      return;
    }

    nicknames.push({
      displayName,
      normalizedName,
      createdAt: new Date().toISOString(),
    });
  };

  getPlayerProfiles().forEach((profile) => addNickname(profile.nickname));
  getLeaderboard().forEach((entry) => addNickname(entry.nickname));
  getStarLeaderboard().forEach((entry) => addNickname(entry.nickname));
  Object.values(getQuizLeaderboards()).forEach((leaderboard) => {
    if (Array.isArray(leaderboard)) {
      leaderboard.forEach((entry) => addNickname(entry.nickname));
    }
  });

  addNickname(localStorage.getItem(guestStarNicknameKey));
  saveUsedNicknames(nicknames);
}

function getNicknameValidationError(nickname, { currentNickname = "" } = {}) {
  const originalNickname = String(nickname || "");
  const displayName = cleanPlayerNickname(originalNickname);
  const normalizedName = normalizeNickname(displayName);
  const currentName = normalizeNickname(currentNickname);

  if (!normalizedName) {
    return "Please enter a nickname.";
  }

  if (originalNickname.trim().length > 20) {
    return "Please choose a nickname under 20 characters.";
  }

  if (looksLikeFullName(displayName)) {
    return "Use a nickname, not your real full name.";
  }

  if (normalizedName !== currentName) {
    const nicknameTaken = getUsedNicknames().some((entry) => entry.normalizedName === normalizedName)
      || getPlayerProfiles().some((profile) => normalizeNickname(profile.nickname) === normalizedName);

    if (nicknameTaken) {
      return "I’m sorry, but someone else has this name. Please choose something else.";
    }
  }

  return "";
}

function validateNickname(nickname, options = {}) {
  const displayName = cleanPlayerNickname(nickname);
  return {
    displayName,
    normalizedName: normalizeNickname(displayName),
    message: getNicknameValidationError(nickname, options),
  };
}

function findProfileByNickname(nickname) {
  const cleanName = normalizeNickname(nickname);
  return getPlayerProfiles().find((profile) => normalizeNickname(profile.nickname) === cleanName) || null;
}

function getLatestAvatarForNickname(nickname, fallbackAvatar = null) {
  const profile = findProfileByNickname(nickname);
  return getUnlockedAvatar(profile?.avatar || fallbackAvatar || createDefaultAvatar());
}

function syncLeaderboardAvatarsForProfile(profile) {
  if (!profile?.nickname) {
    return;
  }

  const profileName = normalizeNickname(profile.nickname);
  const latestAvatar = getUnlockedAvatar(profile.avatar || createDefaultAvatar());
  const syncedQuizLeaderboard = getLeaderboard().map((entry) => (
    normalizeNickname(entry.nickname) === profileName
      ? { ...entry, avatar: latestAvatar }
      : entry
  ));
  const syncedStarLeaderboard = getStarLeaderboard().map((entry) => (
    normalizeNickname(entry.nickname) === profileName
      ? { ...entry, avatar: latestAvatar }
      : entry
  ));
  const syncedQuizLeaderboards = Object.fromEntries(Object.entries(getQuizLeaderboards()).map(([quizId, leaderboard]) => [
    quizId,
    Array.isArray(leaderboard)
      ? leaderboard.map((entry) => (
        normalizeNickname(entry.nickname) === profileName
          ? { ...entry, avatar: latestAvatar }
          : entry
      ))
      : leaderboard,
  ]));

  saveLeaderboard(syncedQuizLeaderboard);
  saveStarLeaderboard(syncedStarLeaderboard);
  saveQuizLeaderboards(syncedQuizLeaderboards);
}

function syncNicknameAcrossSavedData(oldNickname, newNickname, avatar = null) {
  const oldName = normalizeNickname(oldNickname);
  const newDisplayName = cleanPlayerNickname(newNickname);

  if (!oldName || normalizeNickname(newDisplayName) === oldName) {
    return;
  }

  const updateEntry = (entry) => (
    normalizeNickname(entry.nickname) === oldName
      ? { ...entry, nickname: newDisplayName, avatar: avatar || entry.avatar }
      : entry
  );

  saveLeaderboard(getLeaderboard().map(updateEntry));
  saveStarLeaderboard(getStarLeaderboard().map(updateEntry));
  saveQuizLeaderboards(Object.fromEntries(Object.entries(getQuizLeaderboards()).map(([quizId, leaderboard]) => [
    quizId,
    Array.isArray(leaderboard) ? leaderboard.map(updateEntry) : leaderboard,
  ])));

  const chatMessages = getChatMessages().map((message) => ({
    ...message,
    senderNickname: normalizeNickname(message.senderNickname) === oldName ? newDisplayName : message.senderNickname,
    receiverNickname: normalizeNickname(message.receiverNickname) === oldName ? newDisplayName : message.receiverNickname,
  }));
  saveChatMessages(chatMessages);

  if (normalizeNickname(localStorage.getItem(guestStarNicknameKey)) === oldName) {
    localStorage.setItem(guestStarNicknameKey, newDisplayName);
  }

  if (normalizeNickname(localStorage.getItem(currentPlayerKey)) === oldName) {
    localStorage.setItem(currentPlayerKey, newDisplayName);
  }
}

function generateFriendCode(nickname, profiles = getPlayerProfiles()) {
  const words = ["LUNA", "CASE", "MISTY", "MOON", "STAR", "CLUE"];
  const nicknamePrefix = nickname.replace(/[^a-z]/gi, "").slice(0, 4).toUpperCase();
  const codePrefix = nicknamePrefix.length >= 3 ? nicknamePrefix : words[Math.floor(Math.random() * words.length)];
  let code = "";

  do {
    code = `${codePrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
  } while (profiles.some((profile) => profile.friendCode === code));

  return code;
}

function ensureFriendProfile(profile, profiles = getPlayerProfiles()) {
  return {
    ...profile,
    friendCode: profile.friendCode || generateFriendCode(profile.nickname || "CASE", profiles),
    friends: Array.isArray(profile.friends) ? profile.friends : [],
    friendProfiles: profile.friendProfiles && typeof profile.friendProfiles === "object" ? profile.friendProfiles : {},
    blockedFriends: Array.isArray(profile.blockedFriends) ? profile.blockedFriends : [],
  };
}

function syncActiveProfileOnline() {
  if (!activePlayer || onlineAccountSyncInProgress) {
    return;
  }

  if (onlineAccountStorage.isLoggedIn) {
    onlineAccountStorage.saveProfile(activePlayer).catch((error) => {
      console.error("Supabase Auth profile sync error:", error);
    });
  }

  if (onlineFriendCodes.isConfigured) {
    onlineFriendCodes.saveProfile(activePlayer).catch((error) => {
      console.error("Supabase profile sync error:", error);
    });
  }

  if (usernamePinSession && onlineUsernameAccounts.isConfigured) {
    onlineAccountSyncInProgress = true;
    onlineUsernameAccounts.saveCurrentProgress()
      .catch((error) => console.error("Supabase username player sync error:", error))
      .finally(() => {
        onlineAccountSyncInProgress = false;
      });
  }
}

function updateOwnPresence() {
  if (!activePlayer || !onlineFriendCodes.isConfigured) {
    return;
  }

  activePlayer.lastSeenAt = Date.now();
  onlineFriendCodes.saveProfile(activePlayer).catch((error) => {
    console.error("Supabase presence update error:", error);
  });
}

function startPresenceUpdates() {
  if (presenceUpdateTimer) {
    clearInterval(presenceUpdateTimer);
  }

  updateOwnPresence();
  presenceUpdateTimer = window.setInterval(updateOwnPresence, presenceUpdateIntervalMs);
}

function stopPresenceUpdates() {
  if (presenceUpdateTimer) {
    clearInterval(presenceUpdateTimer);
    presenceUpdateTimer = null;
  }
}

function isFriendOnline(friendProfile) {
  const lastSeenAt = Number.parseInt(friendProfile?.lastSeenAt || "0", 10) || 0;
  return lastSeenAt > 0 && Date.now() - lastSeenAt <= friendOnlineWindowMs;
}

function makeFriendPresenceBadge(friendProfile) {
  const isOnline = isFriendOnline(friendProfile);
  const badge = document.createElement("p");
  badge.className = isOnline ? "friend-presence online" : "friend-presence offline";
  const dot = document.createElement("span");
  dot.className = "presence-dot";
  dot.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.textContent = isOnline ? "Online" : "Offline";
  badge.append(dot, label);
  return badge;
}

function saveActivePlayerProfile() {
  if (!activePlayer) {
    return;
  }

  const profiles = getPlayerProfiles();
  const profileExists = profiles.some((profile) => normalizeNickname(profile.nickname) === normalizeNickname(activePlayer.nickname));
  const updatedProfiles = profileExists
    ? profiles.map((profile) => (normalizeNickname(profile.nickname) === normalizeNickname(activePlayer.nickname) ? activePlayer : profile))
    : [...profiles, activePlayer];

  savePlayerProfiles(updatedProfiles);
  registerUsedNickname(activePlayer.nickname);
  syncLeaderboardAvatarsForProfile(activePlayer);
  syncActiveProfileOnline();
}

function getGuestRewards() {
  const savedRewards = localStorage.getItem(guestRewardsKey);

  if (!savedRewards) {
    return [];
  }

  try {
    const rewards = JSON.parse(savedRewards);
    return Array.isArray(rewards) ? rewards : [];
  } catch {
    return [];
  }
}

function saveGuestRewards(rewards) {
  localStorage.setItem(guestRewardsKey, JSON.stringify(rewards));
}

function updateActivePlayerProfile(updates) {
  if (!activePlayer) {
    return;
  }

  activePlayer = ensureFriendProfile({
    ...activePlayer,
    ...updates,
  });

  saveActivePlayerProfile();
  updateProfileBar();
  renderLeaderboard();
  renderStarLeaderboard();
}

function getStarBalance() {
  if (activePlayer) {
    return activePlayer.stars || 0;
  }

  return Number.parseInt(localStorage.getItem(guestStarsKey) || "0", 10);
}

function setStarBalance(stars) {
  const safeStars = Math.max(0, stars);

  if (activePlayer) {
    updateActivePlayerProfile({ stars: safeStars });
    updateStarLeaderboard();
    return;
  }

  localStorage.setItem(guestStarsKey, String(safeStars));
  updateProfileBar();
  updateStarLeaderboard();
}

function addStars(amount) {
  setStarBalance(getStarBalance() + amount);
}

function getPurchasedRewards() {
  if (activePlayer) {
    return Array.isArray(activePlayer.purchasedRewards) ? activePlayer.purchasedRewards : [];
  }

  return getGuestRewards();
}

function savePurchasedRewards(rewards) {
  if (activePlayer) {
    updateActivePlayerProfile({
      purchasedRewards: rewards,
      diaryAccess: rewards.includes("daily-diary"),
    });

    if (onlineAccountStorage.isLoggedIn && !onlineAccountSyncInProgress) {
      onlineAccountStorage.savePurchases(rewards).catch((error) => {
        console.error("Supabase purchases sync error:", error);
      });
    }
    return;
  }

  saveGuestRewards(rewards);
}

function hasPurchased(itemId) {
  return getPurchasedRewards().includes(itemId);
}

function isThemeReward(item) {
  return Boolean(themeRewards[item.id]);
}

function isGamePack(item) {
  return item.category === "Games";
}

function isDiaryReward(item) {
  return item.category === "Diary";
}

function getPurchasedDiaryRewardLabel(item) {
  if (activeDiaryRewardIds.has(item.id)) {
    return "Purchased - Active in Diary";
  }

  if (comingSoonDiaryRewardIds.has(item.id)) {
    return "Purchased - Coming soon";
  }

  return "Purchased";
}

function getPurchasedGamePackLabel(item) {
  if (activeGamePackIds.has(item.id)) {
    return "Purchased - Active in Games";
  }

  if (comingSoonGamePackIds.has(item.id)) {
    return "Purchased - Coming soon";
  }

  return "Purchased";
}

function getGamePackMenuText(packId) {
  if (hasPurchased(packId) && activeGamePackIds.has(packId)) {
    if (packId === "extra-quiz-theme-pack") {
      return "Extra Quiz Theme Pack: Active";
    }

    const packName = shopItems.find((item) => item.id === packId)?.name || "Extra Pack";
    return `${packName}: Active`;
  }

  return "Extra pack locked - buy it in the shop";
}

function updateGamePackStatuses() {
  packStatusBadges.forEach((badge) => {
    const packId = badge.dataset.packId;
    const isActive = hasPurchased(packId) && activeGamePackIds.has(packId);
    badge.textContent = getGamePackMenuText(packId);
    badge.classList.toggle("active", isActive);
  });
}

function getActiveTheme() {
  return localStorage.getItem(activeThemeKey) || "default";
}

function saveActiveTheme(themeId) {
  localStorage.setItem(activeThemeKey, themeId);

  if (activePlayer && onlineAccountStorage.isLoggedIn && !onlineAccountSyncInProgress) {
    onlineAccountStorage.saveProfile({ ...activePlayer, activeTheme: themeId }).catch((error) => {
      console.error("Supabase theme sync error:", error);
    });
  }
}

function getActiveThemeName() {
  const activeTheme = getActiveTheme();
  return activeTheme === "default" ? "Default Theme" : themeRewards[activeTheme]?.name || "Default Theme";
}

function setActiveTheme(themeId) {
  if (themeId !== "default" && !hasPurchased(themeId)) {
    shopMessage.textContent = "Buy this theme before applying it.";
    return;
  }

  saveActiveTheme(themeId);
  applyPurchasedEffects();
  renderShop();
  shopMessage.textContent = `${getActiveThemeName()} is active.`;
}

function getDiaryNotes() {
  if (activePlayer) {
    return activePlayer.diaryNotes || {};
  }

  const savedNotes = localStorage.getItem(guestDiaryKey);

  if (!savedNotes) {
    return {};
  }

  try {
    return JSON.parse(savedNotes) || {};
  } catch {
    return {};
  }
}

function saveDiaryNotes(notes) {
  if (activePlayer) {
    updateActivePlayerProfile({ diaryNotes: notes });
    return;
  }

  localStorage.setItem(guestDiaryKey, JSON.stringify(notes));
}

function normalizeDiaryEntries(entries) {
  return Array.isArray(entries)
    ? entries
        .filter((entry) => entry && typeof entry === "object" && String(entry.text || "").trim())
        .map((entry) => ({
          id: entry.id || crypto.randomUUID(),
          date: entry.date || new Date().toISOString().slice(0, 10),
          time: entry.time || "",
          text: String(entry.text || "").trim(),
          mood: entry.mood || "",
          sticker: entry.sticker || "",
          createdAt: entry.createdAt || Date.now(),
        }))
    : [];
}

function getDiaryEntries() {
  const savedEntries = localStorage.getItem(diaryEntriesKey);
  let entries = [];

  if (savedEntries) {
    try {
      entries = normalizeDiaryEntries(JSON.parse(savedEntries));
    } catch {
      entries = [];
    }
  }

  const oldNotes = getDiaryNotes();
  const migratedEntries = Object.entries(oldNotes)
    .filter(([, text]) => typeof text === "string" && text.trim())
    .filter(([date]) => !entries.some((entry) => entry.date === date && entry.text === oldNotes[date].trim()))
    .map(([date, text]) => ({
      id: crypto.randomUUID(),
      date,
      time: "",
      text: text.trim(),
      mood: "",
      sticker: "",
      createdAt: new Date(`${date}T00:00:00`).getTime() || Date.now(),
    }));

  const diaryEntries = [...entries, ...migratedEntries].sort((firstEntry, secondEntry) => secondEntry.createdAt - firstEntry.createdAt);

  if (migratedEntries.length > 0) {
    saveDiaryEntries(diaryEntries);
  }

  return diaryEntries;
}

function saveDiaryEntries(entries) {
  const safeEntries = normalizeDiaryEntries(entries);
  localStorage.setItem(diaryEntriesKey, JSON.stringify(safeEntries));

  if (onlineAccountStorage.isLoggedIn && !onlineAccountSyncInProgress) {
    onlineAccountStorage.saveDiaryEntries(safeEntries).catch((error) => {
      console.error("Supabase diary sync error:", error);
    });
  }
}

function applyPurchasedEffects() {
  const activeTheme = getActiveTheme();
  const canUseActiveTheme = activeTheme === "default" || hasPurchased(activeTheme);

  Object.values(themeRewards).forEach((theme) => {
    document.body.classList.remove(theme.className);
  });

  document.body.classList.toggle("secret-notebook-theme", false);

  if (!canUseActiveTheme) {
    saveActiveTheme("default");
  }

  if (canUseActiveTheme && themeRewards[activeTheme]) {
    document.body.classList.add(themeRewards[activeTheme].className);
  }

  resultCard.classList.toggle("profile-frame-reward", hasPurchased("profile-frame"));
}

function createDefaultAvatar() {
  return {
    ...Object.fromEntries(Object.entries(avatarOptions).map(([key, values]) => [key, values[0]])),
    emojiAvatar: defaultEmojiAvatar,
  };
}

function getSelectedAvatar() {
  return {
    ...createDefaultAvatar(),
    ...selectedAvatar,
    emojiAvatar: selectedAvatar.emojiAvatar || defaultEmojiAvatar,
    avatarName: avatarNameInput.value.trim(),
  };
}

function isShopBackground(background) {
  return shopBackgroundRewards.some((reward) => reward.option === background);
}

function canUseBackground(background) {
  const reward = shopBackgroundRewards.find((item) => item.option === background);
  return !reward || hasPurchased(reward.itemId);
}

function getAvatarOptionValues(key) {
  if (key !== "background") {
    return avatarOptions[key];
  }

  return [...avatarOptions.background, ...shopBackgroundRewards.map((reward) => reward.option)];
}

function getUnlockedAvatar(avatar) {
  const safeAvatar = {
    ...createDefaultAvatar(),
    ...(avatar || {}),
  };

  if (!canUseBackground(safeAvatar.background)) {
    safeAvatar.background = avatarOptions.background[0];
  }

  return safeAvatar;
}

function getAvatarClass(avatar) {
  const background = avatar?.background || "Lavender room";
  const backgroundColour = avatar?.backgroundColour || "Cream";
  return `avatar-bg-${slugify(background)} avatar-tint-${slugify(backgroundColour)}`;
}

function slugify(value) {
  return String(value || "").toLowerCase().replaceAll(" ", "-").replaceAll("/", "-");
}

function getAvatarColour(group, value, fallback) {
  return avatarColourValues[group]?.[value] || fallback;
}

function getAvatarBackgroundTheme(background) {
  return avatarBackgroundThemes[background] || avatarBackgroundThemes["Lavender room"];
}

function getMangaBackgroundDecor(background) {
  const decorations = {
    "Lavender room": '<path class="manga-bg-line" d="M42 70 H178 M54 98 H166" /><circle class="manga-bg-dot" cx="62" cy="54" r="4" /><circle class="manga-bg-dot" cx="158" cy="91" r="3" />',
    "Secret diary desk": '<rect class="manga-bg-shape" x="42" y="196" width="136" height="18" rx="8" /><path class="manga-bg-line" d="M64 190 h38 M118 190 h30" /><rect class="manga-bg-shape" x="145" y="176" width="18" height="20" rx="3" />',
    "Moonlight window": '<rect class="manga-bg-shape" x="142" y="45" width="34" height="46" rx="8" /><path class="manga-bg-line" d="M159 45 V91 M142 68 H176" /><path class="manga-bg-line" d="M70 54 C60 65 63 80 77 86" />',
    "Soft library": '<rect class="manga-bg-shape" x="39" y="50" width="32" height="82" rx="7" /><path class="manga-bg-line" d="M48 62 v58 M58 62 v58 M39 88 h32" /><rect class="manga-bg-shape" x="151" y="54" width="25" height="70" rx="6" />',
    "Cloudy sky": '<path class="manga-bg-shape" d="M42 82 C50 68 68 72 70 84 C82 80 92 88 88 100 H42 Z" /><path class="manga-bg-shape" d="M139 63 C147 51 164 55 166 67 C178 64 187 72 184 83 H139 Z" />',
    "Cafe corner": '<path class="manga-bg-line" d="M42 72 C70 54 98 54 126 72" /><rect class="manga-bg-shape" x="149" y="178" width="20" height="26" rx="6" /><path class="manga-bg-line" d="M151 178 C151 168 167 168 167 178" />',
    "Study desk": '<rect class="manga-bg-shape" x="38" y="198" width="144" height="16" rx="8" /><path class="manga-bg-line" d="M57 188 h42 M116 188 h48" /><path class="manga-bg-line" d="M62 214 v17 M158 214 v17" />',
    "Premium Study Desk Background": '<rect class="manga-bg-shape" x="35" y="195" width="150" height="20" rx="9" /><path class="manga-bg-line" d="M58 184 h45 M115 184 h44 M72 174 h30" /><circle class="manga-bg-dot" cx="167" cy="184" r="5" />',
    "Clue Board Background": '<rect class="manga-bg-shape" x="38" y="49" width="48" height="43" rx="7" /><path class="manga-bg-line" d="M48 61 h18 M48 73 h28 M64 49 l22 43" /><circle class="manga-bg-dot" cx="171" cy="72" r="5" />',
    "Mystery Room Theme": '<path class="manga-bg-line" d="M46 67 H174 M58 95 H162 M70 123 H150" /><circle class="manga-bg-dot" cx="54" cy="67" r="4" /><circle class="manga-bg-dot" cx="166" cy="95" r="3" />',
  };

  return decorations[background] || decorations["Lavender room"];
}

function makeAvatarPart(className) {
  const part = document.createElement("span");
  part.className = className;
  return part;
}

function getMangaFacePath(faceShape) {
  const facePaths = {
    Round: "M74 76 C75 52 91 37 110 37 C129 37 145 52 146 76 C148 104 133 132 110 137 C87 132 72 104 74 76 Z",
    Oval: "M76 72 C78 49 92 35 110 35 C128 35 142 49 144 72 C147 102 133 134 110 140 C87 134 73 102 76 72 Z",
    Heart: "M74 75 C75 51 91 38 110 38 C129 38 145 51 146 75 C148 103 131 130 110 141 C89 130 72 103 74 75 Z",
    "Soft square": "M76 71 C79 51 93 39 110 39 C127 39 141 51 144 71 C146 101 135 131 110 138 C85 131 74 101 76 71 Z",
  };

  return facePaths[faceShape] || facePaths.Oval;
}

function getMangaHairBack(hairstyle) {
  const hairBacks = {
    "Long waves": '<path class="manga-hair-fill manga-hair-outline" d="M58 93 C55 49 76 22 110 21 C144 22 165 49 162 93 C159 129 149 171 132 196 C136 166 137 135 132 108 C124 116 96 116 88 108 C83 135 84 166 88 196 C71 171 61 129 58 93 Z" />',
    "Short bob": '<path class="manga-hair-fill manga-hair-outline" d="M61 91 C59 50 79 25 110 25 C141 25 161 50 159 91 C157 125 142 147 110 151 C78 147 63 125 61 91 Z" />',
    Ponytail: '<path class="manga-hair-fill manga-hair-outline" d="M63 91 C60 50 79 24 110 24 C141 24 160 50 157 91 C153 121 139 140 110 144 C81 140 67 121 63 91 Z" /><path class="manga-hair-fill manga-hair-outline" d="M151 80 C184 90 188 132 160 154 C165 131 160 105 145 92 Z" />',
    Braids: '<path class="manga-hair-fill manga-hair-outline" d="M64 89 C61 50 80 25 110 25 C140 25 159 50 156 89 C153 116 139 138 110 143 C81 138 67 116 64 89 Z" /><path class="manga-hair-fill manga-hair-outline" d="M62 100 C45 118 44 155 58 181 C73 159 76 125 68 101 Z" /><path class="manga-hair-fill manga-hair-outline" d="M158 100 C175 118 176 155 162 181 C147 159 144 125 152 101 Z" />',
    "Curly hair": '<path class="manga-hair-fill manga-hair-outline" d="M58 91 C53 51 78 23 110 23 C142 23 167 51 162 91 C160 124 141 149 110 150 C79 149 60 124 58 91 Z" /><circle class="manga-hair-fill manga-hair-outline" cx="68" cy="72" r="15" /><circle class="manga-hair-fill manga-hair-outline" cx="87" cy="43" r="14" /><circle class="manga-hair-fill manga-hair-outline" cx="133" cy="43" r="14" /><circle class="manga-hair-fill manga-hair-outline" cx="152" cy="72" r="15" />',
    "Straight hair": '<path class="manga-hair-fill manga-hair-outline" d="M60 94 C58 50 78 22 110 22 C142 22 162 50 160 94 C158 133 148 176 130 198 C132 165 131 132 126 103 C119 110 101 110 94 103 C89 132 88 165 90 198 C72 176 62 133 60 94 Z" />',
    "Messy bun": '<path class="manga-hair-fill manga-hair-outline" d="M64 92 C61 51 80 26 110 26 C140 26 159 51 156 92 C153 120 139 139 110 144 C81 139 67 120 64 92 Z" /><circle class="manga-hair-fill manga-hair-outline" cx="148" cy="38" r="17" />',
    "Layered hair": '<path class="manga-hair-fill manga-hair-outline" d="M59 93 C57 51 78 24 110 24 C142 24 163 51 161 93 C158 130 145 165 126 185 C129 158 130 132 126 106 C119 114 101 114 94 106 C90 132 91 158 94 185 C75 165 62 130 59 93 Z" />',
  };

  return hairBacks[hairstyle] || hairBacks["Layered hair"];
}

function getMangaHairFront(hairstyle) {
  const longSideLength = ["Long waves", "Straight hair", "Layered hair"].includes(hairstyle) ? 46 : 26;
  const bobLift = hairstyle === "Short bob" ? 10 : 0;
  const curlExtra = hairstyle === "Curly hair"
    ? '<path class="manga-hair-fill manga-hair-line" d="M83 57 C75 61 77 74 88 72" /><path class="manga-hair-fill manga-hair-line" d="M137 57 C145 61 143 74 132 72" />'
    : "";

  return `
    <path class="manga-hair-fill manga-hair-line" d="M67 ${88 - bobLift} C73 55 91 36 110 34 C129 36 147 55 153 ${88 - bobLift}" />
    <path class="manga-hair-fill manga-hair-line" d="M76 78 C84 52 99 39 111 37 C108 58 98 75 82 92 Z" />
    <path class="manga-hair-fill manga-hair-line" d="M99 42 C109 51 112 67 106 89 C121 75 128 55 124 38 Z" />
    <path class="manga-hair-fill manga-hair-line" d="M126 40 C139 50 146 65 146 88 C132 78 124 62 126 40 Z" />
    <path class="manga-hair-fill manga-hair-line" d="M72 86 C61 111 64 ${118 + longSideLength} 83 ${132 + longSideLength} C78 113 81 96 91 82 Z" />
    <path class="manga-hair-fill manga-hair-line" d="M148 86 C159 111 156 ${118 + longSideLength} 137 ${132 + longSideLength} C142 113 139 96 129 82 Z" />
    ${curlExtra}
  `;
}

function getMangaEyes(eyeShape) {
  const irisLeft = '<ellipse cx="94" cy="84" rx="4.2" ry="5.5" fill="var(--eye)" /><circle cx="95.5" cy="82" r="1.4" fill="#fff" />';
  const irisRight = '<ellipse cx="126" cy="84" rx="4.2" ry="5.5" fill="var(--eye)" /><circle cx="127.5" cy="82" r="1.4" fill="#fff" />';
  const eyePaths = {
    "Soft eyes": [`M83 83 C89 78 99 78 104 83 C99 88 89 88 83 83 Z`, `M117 83 C123 78 133 78 137 83 C132 88 123 88 117 83 Z`, irisLeft, irisRight],
    "Big eyes": [`M82 83 C88 76 101 76 106 83 C101 91 88 91 82 83 Z`, `M114 83 C120 76 134 76 139 83 C134 91 120 91 114 83 Z`, irisLeft, irisRight],
    "Sleepy eyes": [`M83 84 C91 81 98 81 105 84`, `M115 84 C123 81 132 81 139 84`, "", ""],
    Wink: [`M83 83 C89 78 99 78 104 83 C99 88 89 88 83 83 Z`, `M116 84 C124 82 132 82 139 84`, irisLeft, ""],
    "Smiley eyes": [`M83 85 C91 79 99 79 105 85`, `M115 85 C123 79 132 79 139 85`, "", ""],
    "Sharp eyes": [`M82 84 C92 77 101 79 107 83 C98 86 90 87 82 84 Z`, `M113 83 C121 79 131 77 140 84 C132 87 122 86 113 83 Z`, irisLeft, irisRight],
    "Mysterious eyes": [`M82 84 C91 79 100 79 107 83 C98 86 90 87 82 84 Z`, `M113 83 C121 79 131 79 140 84 C132 87 122 86 113 83 Z`, irisLeft, irisRight],
    "Round eyes": [`M84 83 C90 77 100 77 105 83 C100 90 90 90 84 83 Z`, `M115 83 C121 77 133 77 138 83 C133 90 121 90 115 83 Z`, irisLeft, irisRight],
    "Soft almond eyes": [`M82 83 C90 78 99 78 106 83 C98 87 90 87 82 83 Z`, `M114 83 C122 78 132 78 140 83 C132 87 122 87 114 83 Z`, irisLeft, irisRight],
    "Upturned almond eyes": [`M82 84 C91 78 100 78 107 82 C98 87 90 87 82 84 Z`, `M113 82 C122 78 132 78 141 84 C132 87 122 87 113 82 Z`, irisLeft, irisRight],
    "Soft monolid eyes": [`M83 84 C91 80 99 80 106 84`, `M114 84 C122 80 132 80 140 84`, "", ""],
  };
  const [left, right, leftIris, rightIris] = eyePaths[eyeShape] || eyePaths["Soft eyes"];
  const fill = ["Sleepy eyes", "Smiley eyes", "Soft monolid eyes"].includes(eyeShape) ? "none" : "#fff";

  return `
    <path class="manga-eye" d="${left}" fill="${fill}" />
    <path class="manga-eye" d="${right}" fill="${fill}" />
    ${leftIris}
    ${rightIris}
  `;
}

function getMangaAccessory(accessory) {
  const accessories = {
    None: "",
    "Silver key": '<path class="manga-accessory" d="M119 149 l8 13 M126 162 l5 -2 M126 162 l2 5" /><circle class="manga-accessory" cx="117" cy="146" r="4" fill="none" />',
    Notebook: '<rect class="manga-accessory-fill manga-accessory" x="136" y="159" width="18" height="24" rx="3" /><path class="manga-accessory" d="M141 164 h9 M141 170 h8" />',
    Headphones: '<path class="manga-accessory" d="M72 87 C75 52 145 52 148 87" /><rect class="manga-accessory-fill manga-accessory" x="66" y="86" width="9" height="22" rx="4" /><rect class="manga-accessory-fill manga-accessory" x="145" y="86" width="9" height="22" rx="4" />',
    Ribbon: '<path class="manga-accessory-fill manga-accessory" d="M143 55 l15 -7 l-3 16 Z" /><path class="manga-accessory-fill manga-accessory" d="M143 55 l15 8 l-3 -16 Z" />',
    "Star clip": '<path class="manga-accessory-fill manga-accessory" d="M149 57 l3 6 l7 1 l-5 5 l1 7 l-6 -3 l-6 3 l1 -7 l-5 -5 l7 -1 Z" />',
    "Moon necklace": '<path class="manga-accessory" d="M101 146 C107 154 115 154 121 146" /><path class="manga-accessory-fill manga-accessory" d="M113 156 C108 153 108 145 114 142 C112 147 115 151 120 152 C118 156 116 157 113 156 Z" />',
    Glasses: '<circle class="manga-accessory" cx="94" cy="84" r="10" fill="none" /><circle class="manga-accessory" cx="126" cy="84" r="10" fill="none" /><path class="manga-accessory" d="M104 84 H116" />',
    "Tiny bag": '<rect class="manga-accessory-fill manga-accessory" x="140" y="166" width="18" height="18" rx="4" /><path class="manga-accessory" d="M143 166 C144 158 154 158 155 166" />',
  };

  return accessories[accessory] || "";
}

function createMangaAvatarSvg(avatar) {
  return `
    <svg class="manga-avatar-svg" viewBox="0 0 220 260" role="img" aria-label="Manga style avatar portrait" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="avatar-card-glow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="rgba(255,255,255,0.9)" />
          <stop offset="0.55" stop-color="var(--avatar-bg)" />
          <stop offset="1" stop-color="rgba(217,236,255,0.9)" />
        </linearGradient>
      </defs>
      <rect class="manga-card-bg" x="10" y="10" width="200" height="240" rx="30" />
      <g class="manga-background-decor">${getMangaBackgroundDecor(avatar.background)}</g>
      <path class="manga-card-line" d="M42 53 H178 M55 205 H165" />
      <circle class="manga-card-spark" cx="56" cy="78" r="3" />
      <circle class="manga-card-spark" cx="169" cy="68" r="2.5" />
      <path class="manga-shoulders" d="M50 225 C61 181 82 147 110 147 C138 147 159 181 170 225 Z" />
      <rect class="manga-neck" x="100" y="130" width="20" height="26" rx="9" />
      <path class="manga-collar" d="M76 150 C89 143 100 146 110 156 C120 146 131 143 144 150 C138 166 125 175 110 176 C95 175 82 166 76 150 Z" />
      <path class="manga-outfit-line" d="M87 160 L110 192 L133 160" />
      <path class="manga-bow" d="M107 162 C98 154 89 154 83 165 C92 169 101 169 107 162 Z M113 162 C122 154 131 154 137 165 C128 169 119 169 113 162 Z M106 162 H114 V173 H106 Z" />
      <g class="manga-hair-back-layer">${getMangaHairBack(avatar.hairstyle)}</g>
      <path class="manga-face" d="${getMangaFacePath(avatar.faceShape)}" />
      <path class="manga-blush" d="M84 101 C91 97 98 98 103 102" />
      <path class="manga-blush" d="M117 102 C123 98 131 97 137 101" />
      ${getMangaEyes(avatar.eyeShape)}
      <path class="manga-nose" d="M111 91 C108 101 108 106 112 109" />
      <path class="manga-mouth" d="M101 120 C107 124 114 124 120 120" />
      <g class="manga-hair-front-layer">${getMangaHairFront(avatar.hairstyle)}</g>
      <g class="manga-accessory-layer">${getMangaAccessory(avatar.accessory)}</g>
    </svg>
  `;
}

function renderAvatar(target, avatar) {
  const safeAvatar = getUnlockedAvatar(avatar);
  const sizeClass = ["avatar-preview", "username-avatar-preview"].includes(target.id) ? "avatar-preview" : "mini-avatar";
  const emoji = safeAvatar.emojiAvatar || defaultEmojiAvatar;

  target.className = `${sizeClass} emoji-avatar-card`;
  target.removeAttribute("style");
  target.innerHTML = "";

  const emojiFace = document.createElement("div");
  emojiFace.className = "emoji-avatar-face";
  emojiFace.textContent = emoji;
  target.append(emojiFace);

  if (sizeClass === "avatar-preview") {
    const name = document.createElement("p");
    name.className = "avatar-preview-name";
    name.textContent = safeAvatar.avatarName || "Emoji avatar";
    const detail = document.createElement("p");
    detail.className = "avatar-preview-detail";
    detail.textContent = "Pick one emoji that feels like you.";
    target.append(name, detail);
  }
}

function renderMangaAvatar(target, avatar) {
  const safeAvatar = getUnlockedAvatar(avatar);
  const sizeClass = ["avatar-preview", "username-avatar-preview"].includes(target.id) ? "avatar-preview" : "mini-avatar";
  target.className = `${sizeClass} illustrated-avatar manga-avatar-card ${getAvatarClass(safeAvatar)} height-${slugify(safeAvatar.height)} face-${slugify(safeAvatar.faceShape)} hair-${slugify(safeAvatar.hairstyle)} eyes-${slugify(safeAvatar.eyeShape)}`;
  target.innerHTML = "";
  target.style.setProperty("--skin", getAvatarColour("skinTone", safeAvatar.skinTone, "#f1c7ad"));
  target.style.setProperty("--eye", getAvatarColour("eyeColour", safeAvatar.eyeColour, "#7a5236"));
  target.style.setProperty("--hair", getAvatarColour("hairColour", safeAvatar.hairColour, "#432a1f"));
  target.style.setProperty("--outfit", getAvatarColour("outfitColour", safeAvatar.outfitColour, "#e7dcff"));
  target.style.setProperty("--accessory", getAvatarColour("accessoryColour", safeAvatar.accessoryColour, "#cfd5df"));
  target.style.setProperty("--diary", getAvatarColour("diaryColour", safeAvatar.diaryColour, "#e7dcff"));
  const backgroundTheme = getAvatarBackgroundTheme(safeAvatar.background);
  target.style.setProperty("--avatar-bg", backgroundTheme.base);
  target.style.setProperty("--avatar-bg-tint", getAvatarColour("backgroundColour", safeAvatar.backgroundColour, backgroundTheme.tint));
  target.style.setProperty("--avatar-bg-accent", backgroundTheme.accent);
  target.style.setProperty("--avatar-bg-line", backgroundTheme.line);

  const portrait = document.createElement("span");
  portrait.className = "manga-portrait";
  portrait.innerHTML = createMangaAvatarSvg(safeAvatar);
  const detail = document.createElement("span");
  detail.className = "avatar-preview-detail";
  detail.textContent = `${safeAvatar.faceShape}, ${safeAvatar.eyeShape}, ${safeAvatar.hairColour} ${safeAvatar.hairstyle}, ${safeAvatar.outfitColour} ${safeAvatar.outfit}`;

  target.append(portrait);

  if (sizeClass === "avatar-preview") {
    const name = document.createElement("span");
    name.className = "avatar-preview-name";
    name.textContent = safeAvatar.avatarName || safeAvatar.style || "Mystery avatar";
    target.append(name, detail);
  }

  target.title = `${safeAvatar.style}, ${safeAvatar.skinTone} skin tone, ${safeAvatar.eyeShape}, ${safeAvatar.eyeColour} eyes, ${safeAvatar.height}, ${safeAvatar.hairColour} ${safeAvatar.hairstyle}, ${safeAvatar.outfitColour} ${safeAvatar.outfit}, ${safeAvatar.accessoryColour} ${safeAvatar.accessory}`;
}

function updateAvatarPreview() {
  renderAvatar(avatarPreview, getSelectedAvatar());
  renderAvatarOptions();
}

function renderEmojiAvatarOptionPanels(container, selectedEmoji, onSelect) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  Object.entries(emojiAvatarCategories).forEach(([category, emojis]) => {
    const group = document.createElement("section");
    group.className = "avatar-option-group emoji-picker-group";

    const title = document.createElement("h3");
    title.textContent = category;

    const buttons = document.createElement("div");
    buttons.className = "emoji-avatar-grid";

    emojis.forEach((emoji) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = (selectedEmoji || defaultEmojiAvatar) === emoji ? "emoji-avatar-option selected" : "emoji-avatar-option";
      button.textContent = emoji;
      button.setAttribute("aria-label", `Choose ${emoji}`);
      button.addEventListener("click", () => {
        onSelect(emoji);
      });
      buttons.append(button);
    });

    group.append(title, buttons);
    container.append(group);
  });
}

function renderAvatarOptions() {
  renderEmojiAvatarOptionPanels(avatarOptionPanels, selectedAvatar.emojiAvatar || defaultEmojiAvatar, (emoji) => {
    selectedAvatar.emojiAvatar = emoji;
    updateAvatarPreview();
  });
}

function updateUsernameAvatarPreview() {
  if (!usernameAvatarPreview) {
    return;
  }

  renderAvatar(usernameAvatarPreview, {
    ...createDefaultAvatar(),
    ...selectedAvatar,
    emojiAvatar: selectedAvatar.emojiAvatar || defaultEmojiAvatar,
  });
  renderEmojiAvatarOptionPanels(usernameAvatarOptionPanels, selectedAvatar.emojiAvatar || defaultEmojiAvatar, (emoji) => {
    selectedAvatar.emojiAvatar = emoji;
    updateUsernameAvatarPreview();
  });
}

function setUsernameAccountMode(mode) {
  usernameAccountMode = mode === "create" ? "create" : "login";
  const isCreateMode = usernameAccountMode === "create";

  usernameLoginForm.classList.toggle("hidden", isCreateMode);
  usernameCreateForm.classList.toggle("hidden", !isCreateMode);
  accountLoginTab.classList.toggle("active", !isCreateMode);
  accountCreateTab.classList.toggle("active", isCreateMode);
  accountLoginTab.setAttribute("aria-selected", String(!isCreateMode));
  accountCreateTab.setAttribute("aria-selected", String(isCreateMode));
  usernameLoginMessage.textContent = "";
  usernameCreateMessage.textContent = "";

  if (isCreateMode) {
    selectedAvatar = {
      ...createDefaultAvatar(),
      ...selectedAvatar,
      emojiAvatar: selectedAvatar.emojiAvatar || defaultEmojiAvatar,
    };
    updateUsernameAvatarPreview();
  }
}

function updateProfileBar() {
  if (!activePlayer && !guestMode) {
    profileBar.classList.add("hidden");
    return;
  }

  profileBar.classList.remove("hidden");
  starsTotal.textContent = `⭐ Stars: ${getStarBalance()}`;
  editAvatarButton.textContent = "Edit Avatar";

  if (guestMode) {
    renderAvatar(profileAvatar, null);
    profileName.textContent = "Guest player";
    profileFriendCode.textContent = "";
    openShopButton.hidden = false;
    openStarLeaderboardButton.hidden = false;
    openFriendsButton.hidden = true;
    openChatButton.hidden = true;
    editAvatarButton.hidden = true;
    authLogoutButton.classList.toggle("hidden", !onlineAccountStorage.isLoggedIn);
    switchPlayerButton.hidden = false;
    return;
  }

  if (activePlayer) {
    renderAvatar(profileAvatar, activePlayer.avatar);
    profileName.textContent = activePlayer.nickname;
    profileFriendCode.textContent = activePlayer.friendCode ? `Friend Code: ${activePlayer.friendCode}` : "";
    openShopButton.hidden = false;
    openStarLeaderboardButton.hidden = false;
    openFriendsButton.hidden = false;
    openChatButton.hidden = false;
    editAvatarButton.hidden = false;
    authLogoutButton.classList.toggle("hidden", !onlineAccountStorage.isLoggedIn);
    switchPlayerButton.hidden = false;
    return;
  }

  profileBar.classList.add("hidden");
}

function loadCurrentPlayer() {
  const currentNickname = localStorage.getItem(currentPlayerKey);

  if (!currentNickname) {
    return null;
  }

  return getPlayerProfiles().find((profile) => profile.nickname === currentNickname) || null;
}

function setActivePlayer(profile) {
  activePlayer = ensureFriendProfile({
    stars: 0,
    purchasedRewards: [],
    diaryAccess: false,
    diaryNotes: {},
    settings: {},
    ...profile,
  });
  guestMode = false;
  localStorage.setItem(currentPlayerKey, profile.nickname);
  saveActivePlayerProfile();
  updateProfileBar();
  applyPurchasedEffects();
  startPresenceUpdates();

  if (pendingGameInviteId) {
    const inviteId = pendingGameInviteId;
    pendingGameInviteId = "";
    window.setTimeout(() => {
      openGameInviteFromLink(inviteId).catch((error) => console.error("Pending game invite open error:", error));
    }, 0);
  }
}

function useGuestMode() {
  stopPresenceUpdates();
  activePlayer = null;
  guestMode = true;
  localStorage.removeItem(currentPlayerKey);
  updateProfileBar();
  applyPurchasedEffects();
  showStart();
}

function createBlankQuestion() {
  return {
    text: "",
    answers: ["", "", "", ""],
    correct: 0,
  };
}

function makeQuestionCard(question, index) {
  const questionCard = document.createElement("fieldset");
  questionCard.className = "creator-question-card";

  const legend = document.createElement("legend");
  legend.textContent = `Clue ${index + 1}`;

  const questionLabel = document.createElement("label");
  questionLabel.setAttribute("for", `question-${index}`);
  questionLabel.textContent = "Question text";

  const questionInput = document.createElement("input");
  questionInput.id = `question-${index}`;
  questionInput.name = `question-${index}`;
  questionInput.type = "text";
  questionInput.value = question.text;
  questionInput.placeholder = "What is my favourite treat?";

  const answerGrid = document.createElement("div");
  answerGrid.className = "creator-answer-grid";

  question.answers.forEach((answer, answerIndex) => {
    const answerWrap = document.createElement("div");
    answerWrap.className = "creator-answer";

    const answerLabel = document.createElement("label");
    answerLabel.setAttribute("for", `question-${index}-answer-${answerIndex}`);
    answerLabel.textContent = `Answer ${answerIndex + 1}`;

    const answerInput = document.createElement("input");
    answerInput.id = `question-${index}-answer-${answerIndex}`;
    answerInput.name = `question-${index}-answer-${answerIndex}`;
    answerInput.type = "text";
    answerInput.value = answer;
    answerInput.placeholder = `Choice ${answerIndex + 1}`;

    answerWrap.append(answerLabel, answerInput);
    answerGrid.append(answerWrap);
  });

  const correctLabel = document.createElement("label");
  correctLabel.setAttribute("for", `question-${index}-correct`);
  correctLabel.textContent = "Correct answer";

  const correctSelect = document.createElement("select");
  correctSelect.id = `question-${index}-correct`;
  correctSelect.name = `question-${index}-correct`;

  question.answers.forEach((_, answerIndex) => {
    const option = document.createElement("option");
    option.value = answerIndex;
    option.textContent = `Answer ${answerIndex + 1}`;
    option.selected = question.correct === answerIndex;
    correctSelect.append(option);
  });

  questionCard.append(legend, questionLabel, questionInput, answerGrid, correctLabel, correctSelect);
  return questionCard;
}

function readCreatorQuestions() {
  const cards = creatorFields.querySelectorAll(".creator-question-card");

  return Array.from(cards).map((card, index) => {
    const answerInputs = card.querySelectorAll(".creator-answer input");

    return {
      text: card.querySelector(`#question-${index}`).value.trim(),
      answers: Array.from(answerInputs).map((input) => input.value.trim()),
      correct: Number.parseInt(card.querySelector(`#question-${index}-correct`).value, 10),
    };
  });
}

function renderCreatorFields(count, quizQuestions = readCreatorQuestions()) {
  const safeCount = clampQuestionCount(count);
  questionTotalInput.value = safeCount;
  creatorFields.innerHTML = "";

  for (let index = 0; index < safeCount; index += 1) {
    const question = quizQuestions[index] || createBlankQuestion();
    creatorFields.append(makeQuestionCard(question, index));
  }
}

function normalizeQuizQuestions(quizQuestions, mode = "scored") {
  if (!Array.isArray(quizQuestions)) {
    return [];
  }

  return quizQuestions
    .map((question) => {
      const questionText = question.text ?? question.question ?? "";
      const answers = Array.isArray(question.answers) ? question.answers.map((answer) => String(answer).trim()) : [];
      const correctAnswerIndex = answers.findIndex((answer) => answer === question.correctAnswer);
      const correct = Number.parseInt(question.correct ?? question.correctIndex ?? correctAnswerIndex, 10);

      return {
        text: String(questionText).trim(),
        answers: answers.slice(0, 4),
        correct: Number.isInteger(correct) ? correct : 0,
      };
    })
    .filter((question) => {
      const hasQuestionAndAnswers = question.text && question.answers.length === 4 && question.answers.every(Boolean);

      if (mode === "opinion") {
        return hasQuestionAndAnswers;
      }

      return hasQuestionAndAnswers && question.correct >= 0 && question.correct <= 3;
    });
}

function getMissingCreatorFields(quizQuestions) {
  const missingFields = [];

  quizQuestions.forEach((question, index) => {
    if (!question.text) {
      missingFields.push(`Clue ${index + 1} needs question text.`);
    }

    question.answers.forEach((answer, answerIndex) => {
      if (!answer) {
        missingFields.push(`Clue ${index + 1}, answer ${answerIndex + 1} needs words.`);
      }
    });
  });

  return missingFields;
}

function hideMainSections() {
  playerGate.classList.add("hidden");
  createPlayerCard.classList.add("hidden");
  loginPlayerCard.classList.add("hidden");
  usernameLoginCard.classList.add("hidden");
  onlineAuthCard.classList.add("hidden");
  gameMenuCard.classList.add("hidden");
  gamesCard.classList.add("hidden");
  startCard.classList.add("hidden");
  safeQuizCard.classList.add("hidden");
  myQuizzesCard.classList.add("hidden");
  sharedQuizCard.classList.add("hidden");
  creatorCard.classList.add("hidden");
  quizCard.classList.add("hidden");
  resultCard.classList.add("hidden");
  leaderboardSection.classList.add("hidden");
  starLeaderboardCard.classList.add("hidden");
  miniGameCard.classList.add("hidden");
  boxOfLiesCard.classList.add("hidden");
  tradingGameCard.classList.add("hidden");
  shopCard.classList.add("hidden");
  friendsCard.classList.add("hidden");
  chatCard.classList.add("hidden");
  diaryCard.classList.add("hidden");
}

function showPlayerGate() {
  hideMainSections();
  updateProfileBar();
  playerGate.classList.remove("hidden");
}

function showCreatePlayer() {
  if (!activePlayer) {
    showUsernameLogin();
    return;
  }

  hideMainSections();
  createPlayerMessage.textContent = "";
  createPlayerTitle.textContent = "Edit your emoji avatar";
  const avatar = getUnlockedAvatar(activePlayer?.avatar || createDefaultAvatar());
  selectedAvatar = {
    ...createDefaultAvatar(),
    ...avatar,
  };
  newPlayerNickname.value = activePlayer?.nickname || "";
  newPlayerNickname.readOnly = Boolean(usernamePinSession);
  avatarNameInput.value = avatar.avatarName || "";
  createPlayerCard.classList.remove("hidden");
  updateAvatarPreview();
}

function showLoginPlayer() {
  hideMainSections();
  loginPlayerMessage.textContent = "";
  loginPlayerCard.classList.remove("hidden");
}

function showUsernameLogin() {
  hideMainSections();
  usernameLoginMessage.textContent = "";
  usernameCreateMessage.textContent = "";
  selectedAvatar = createDefaultAvatar();
  setUsernameAccountMode("login");
  usernameLoginCard.classList.remove("hidden");
}

function showOnlineAuth() {
  hideMainSections();
  authMessage.textContent = onlineAccountStorage.isLoggedIn
    ? "You are already logged in online. Use Log Out if you want a different account."
    : "";
  onlineAuthCard.classList.remove("hidden");
}

function showStart() {
  if (!activePlayer && !guestMode) {
    showPlayerGate();
    return;
  }

  activeQuizId = "";
  activeOnlineQuizId = "";
  onlineLeaderboardEntries = [];
  sharedQuizMode = "manual";
  currentSharedQuiz = null;
  hideMainSections();
  updateProfileBar();
  applyPurchasedEffects();
  updateGamePackStatuses();
  gameMenuCard.classList.remove("hidden");
}

function showGames() {
  if (!activePlayer && !guestMode) {
    showPlayerGate();
    return;
  }

  hideMainSections();
  updateProfileBar();
  applyPurchasedEffects();
  updateGamePackStatuses();
  gamesCard.classList.remove("hidden");
}

function showBestieQuizHome() {
  if (!activePlayer && !guestMode) {
    showPlayerGate();
    return;
  }

  hideMainSections();
  updateProfileBar();
  applyPurchasedEffects();
  startCard.classList.remove("hidden");
}

function showShop() {
  if (!activePlayer && !guestMode) {
    showPlayerGate();
    return;
  }

  hideMainSections();
  shopMessage.textContent = "";
  renderShop();
  shopCard.classList.remove("hidden");
}

function showThemes() {
  activeShopCategory = "Themes";
  showShop();
}

function showStarLeaderboard() {
  if (!activePlayer && !guestMode) {
    showPlayerGate();
    return;
  }

  hideMainSections();
  updateStarLeaderboard({ askGuestNickname: false });
  renderStarLeaderboard();
  starLeaderboardCard.classList.remove("hidden");
}

async function showFriends() {
  if (!activePlayer) {
    showPlayerGate();
    return;
  }

  hideMainSections();
  updateProfileBar();
  friendsMessage.textContent = "";
  friendCodeInput.value = "";
  selectedFriendActionCode = "";
  friendActionPanel.classList.add("hidden");
  await syncOnlineFriendsToLocal();
  await syncFriendGameStateFromOnline();
  renderFriends();
  renderFriendActivity();
  friendsCard.classList.remove("hidden");
}

function showChat(friendCode = "") {
  if (!activePlayer) {
    showPlayerGate();
    return;
  }

  const requestedFriendCode = typeof friendCode === "string" ? friendCode : "";
  hideMainSections();
  updateProfileBar();
  selectedChatFriendCode = normalizeFriendCode(requestedFriendCode);
  activeOnlineChatMessages = [];
  chatLoadedFromSupabase = false;
  chatMessage.textContent = "";
  chatQuizMessage.textContent = "";
  chatMessageInput.value = "";
  chatQuizPanel.classList.add("hidden");
  renderQuickChatControls();
  renderChatFriends();
  updateChatControls();
  chatCard.classList.remove("hidden");
}

function openChatWithFriend(friendCode) {
  showChat(friendCode);
}

function showDiary() {
  if (!hasPurchased("daily-diary")) {
    showShop();
    shopMessage.textContent = "Unlock Daily Diary in the shop first.";
    return;
  }

  hideMainSections();
  renderDiaryUnlockPanels();
  renderDiaryHistory();
  diaryNote.value = "";
  diaryMessage.textContent = "";
  diaryCard.classList.remove("hidden");
}

function showCreator() {
  hideMainSections();
  creatorMessage.textContent = "";
  friendLinkMessage.textContent = "";
  creatorCard.classList.remove("hidden");
}

function showNewQuizCreator() {
  editingQuizId = "";
  activeQuizId = "";
  quizTitleInput.value = "";
  quizThemeInput.value = "Best Friend";
  renderCreatorFields(minQuestions, []);
  showCreator();
}

function showQuizEditor(quizId) {
  const quiz = findSavedQuizById(quizId);

  if (!quiz) {
    showMyQuizzes();
    myQuizzesMessage.textContent = "That quiz could not be found.";
    return;
  }

  editingQuizId = quiz.id;
  activeQuizId = quiz.id;
  quizTitleInput.value = quiz.title;
  quizThemeInput.value = quiz.theme || "";
  renderCreatorFields(quiz.questions.length || minQuestions, quiz.questions);
  showCreator();
}

function showSavedQuizEditor() {
  if (activeQuizId) {
    showQuizEditor(activeQuizId);
    return;
  }

  showMyQuizzes();
}

function showSafeQuizzes() {
  hideMainSections();
  safeQuizCard.classList.remove("hidden");
}

function showMyQuizzes() {
  if (!activePlayer && !guestMode) {
    showPlayerGate();
    return;
  }

  hideMainSections();
  updateProfileBar();
  renderMyQuizzes();
  myQuizzesCard.classList.remove("hidden");
}

function showSharedQuiz() {
  hideMainSections();
  sharedQuizMode = "manual";
  currentSharedQuiz = null;
  sharedLinkQuestions = [];
  sharedQuizMessage.textContent = "";
  activeOnlineQuizId = "";
  onlineLeaderboardEntries = [];
  manualSharedQuizPanel.classList.remove("hidden");
  sharedLinkPanel.classList.add("hidden");
  startSharedLinkQuizButton.classList.add("hidden");
  sharedQuizCard.classList.remove("hidden");
}

function showQuiz() {
  hideMainSections();
  editCurrentQuizButton.classList.toggle("hidden", ["shared", "online"].includes(activeQuizSource));
  quizCard.classList.remove("hidden");
}

function shuffleArray(items) {
  const shuffledItems = items.slice();

  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffledItems[index], shuffledItems[randomIndex]] = [shuffledItems[randomIndex], shuffledItems[index]];
  }

  return shuffledItems;
}

function getMiniGameQuestionPool(game) {
  const freeQuestions = Array.isArray(game.freeQuestions) ? game.freeQuestions : [];
  const packQuestions = game.packId && hasPurchased(game.packId) && Array.isArray(game.packQuestions) ? game.packQuestions : [];
  return [...freeQuestions, ...packQuestions];
}

function createMiniGameRound(game) {
  const questionPool = getMiniGameQuestionPool(game);
  const roundSize = Math.min(game.roundSize || questionPool.length, questionPool.length);
  return shuffleArray(questionPool).slice(0, roundSize);
}

function startMiniGame(gameId) {
  const game = builtInGames[gameId];

  if (!game) {
    showStart();
    return;
  }

  activeQuizId = "";
  activeOnlineQuizId = "";
  onlineLeaderboardEntries = [];
  sharedQuizMode = "manual";
  currentSharedQuiz = null;
  activeMiniGame = gameId;
  miniGameQuestionIndex = 0;
  miniGameCorrectAnswers = 0;
  miniGameResultScores = {};
  miniGameAwarded = false;
  miniGameRoundQuestions = createMiniGameRound(game);
  hideMainSections();
  miniGameCard.classList.remove("hidden");
  renderMiniGameQuestion();
}

function renderMiniGameQuestion() {
  const game = builtInGames[activeMiniGame];
  const question = miniGameRoundQuestions[miniGameQuestionIndex];

  if (!game || !question) {
    finishMiniGame();
    return;
  }

  miniGameEyebrow.textContent = game.eyebrow;
  miniGameTitle.textContent = game.title;
  miniGameProgress.textContent = `Question ${miniGameQuestionIndex + 1} of ${miniGameRoundQuestions.length}`;
  miniGameQuestion.textContent = question.text;
  miniGameChoices.innerHTML = "";
  miniGameResult.classList.add("hidden");
  miniGameQuestion.classList.remove("hidden");
  miniGameProgress.classList.remove("hidden");

  question.answers.forEach((answer, answerIndex) => {
    const button = document.createElement("button");
    button.className = "answer-button";
    button.type = "button";
    button.textContent = typeof answer === "string" ? answer : answer.text;
    button.addEventListener("click", () => chooseMiniGameAnswer(answer, answerIndex));
    miniGameChoices.append(button);
  });
}

function chooseMiniGameAnswer(answer, answerIndex) {
  const game = builtInGames[activeMiniGame];
  const question = miniGameRoundQuestions[miniGameQuestionIndex];

  if (game.type === "scored" && answerIndex === question.correct) {
    miniGameCorrectAnswers += 1;
  }

  if (game.type === "personality") {
    const answerTypes = Array.isArray(answer.types) ? answer.types : [answer.type];
    answerTypes.filter(Boolean).forEach((type) => {
      miniGameResultScores[type] = (miniGameResultScores[type] || 0) + 1;
    });
  }

  miniGameQuestionIndex += 1;

  if (miniGameQuestionIndex >= miniGameRoundQuestions.length) {
    finishMiniGame();
    return;
  }

  renderMiniGameQuestion();
}

function getTopPersonalityType(game) {
  const resultKeys = Object.keys(game.resultTypes);
  const highestScore = Math.max(...resultKeys.map((type) => miniGameResultScores[type] || 0));
  const tiedTypes = resultKeys.filter((type) => (miniGameResultScores[type] || 0) === highestScore);
  const chosenType = tiedTypes[Math.floor(Math.random() * tiedTypes.length)];

  return game.resultTypes[chosenType];
}

function finishMiniGame() {
  const game = builtInGames[activeMiniGame];

  if (!game) {
    showStart();
    return;
  }

  let earnedStars = game.stars || 0;
  let resultTitle = game.resultTitle || "Game complete!";
  let resultMessage = game.resultMessage || "You finished the round.";

  if (game.type === "vibe") {
    const vibes = ["Cozy Mystery Vibe", "Soft Star Vibe", "Creative Bestie Vibe"];
    resultTitle = vibes[miniGameQuestionIndex % vibes.length];
    resultMessage = "Your quick choices made a sweet little vibe result.";
  }

  if (game.type === "personality") {
    const personalityResult = getTopPersonalityType(game);
    resultTitle = personalityResult.title;
    resultMessage = `${personalityResult.description} Traits: ${personalityResult.traits.join(", ")}. Badge: ${personalityResult.badge}.`;
  }

  if (game.type === "scored") {
    earnedStars = miniGameCorrectAnswers;
    resultTitle = `${miniGameCorrectAnswers}/${miniGameRoundQuestions.length} correct`;
    resultMessage = miniGameCorrectAnswers >= 4 ? "Great favourite guessing!" : "Nice try! Every guess is part of the case.";
  }

  if (!miniGameAwarded && earnedStars > 0) {
    addStars(earnedStars);
    miniGameAwarded = true;
  }

  const nickname = getCurrentLeaderboardNickname();
  const gameEntry = {
    id: crypto.randomUUID(),
    nickname,
    avatar: activePlayer ? activePlayer.avatar : null,
    resultTitle,
    starsEarned: earnedStars,
    createdAt: Date.now(),
  };
  saveGameLeaderboardEntry(activeMiniGame, gameEntry);

  miniGameProgress.classList.add("hidden");
  miniGameQuestion.classList.add("hidden");
  miniGameChoices.innerHTML = "";
  miniGameResultTitle.textContent = resultTitle;
  miniGameResultMessage.textContent = resultMessage;
  miniGameStars.textContent = `You earned ${earnedStars} stars!`;
  renderGameLeaderboard(activeMiniGame);
  miniGameResult.classList.remove("hidden");
  updateProfileBar();
  renderStarLeaderboard();
}

function startQuiz(quizQuestions = getSavedQuizzes()[0]?.questions || getSavedQuiz(), source = "custom", mode = "scored", quizId = "") {
  const normalizedQuestions = normalizeQuizQuestions(quizQuestions, mode);

  if (normalizedQuestions.length === 0) {
    showCreator();
    creatorMessage.textContent = "Save a quiz first, then you can play it.";
    return;
  }

  questions = normalizedQuestions;
  activeQuizSource = source;
  activeQuizMode = mode;
  activeQuizId = source === "custom" ? quizId : "";
  activeOnlineQuizId = source === "online" ? quizId : "";
  currentQuestion = 0;
  correctAnswers = 0;
  latestResult = null;
  nicknameInput.value = "";
  showQuiz();
  showQuestion();
}

function showQuestion() {
  const question = questions[currentQuestion];

  questionCount.textContent = activeQuizMode === "opinion" ? `Choice ${currentQuestion + 1} of ${questions.length}` : `Question ${currentQuestion + 1} of ${questions.length}`;
  scoreCount.textContent = activeQuizMode === "opinion" ? `Picked ${currentQuestion}/${questions.length}` : `Score ${correctAnswers}/${questions.length}`;
  questionText.textContent = question.text;
  answerList.innerHTML = "";

  question.answers.forEach((answer, index) => {
    const button = document.createElement("button");
    button.className = "answer-button";
    button.type = "button";
    button.textContent = answer;
    button.addEventListener("click", () => chooseAnswer(index));
    answerList.append(button);
  });
}

function chooseAnswer(answerIndex) {
  if (activeQuizMode !== "opinion" && answerIndex === questions[currentQuestion].correct) {
    correctAnswers += 1;
  }

  currentQuestion += 1;

  if (currentQuestion >= questions.length) {
    showResult();
    return;
  }

  showQuestion();
}

function getResultMessage(scorePercentage) {
  if (scorePercentage === 100) {
    return "Perfect score!";
  }

  if (scorePercentage >= 80) {
    return "Great job!";
  }

  if (scorePercentage >= 60) {
    return "Good!";
  }

  if (scorePercentage >= 40) {
    return "Not bad!";
  }

  return "Nice try!";
}

function showResult() {
  const totalQuestions = questions.length;
  const scorePercentage = activeQuizMode === "opinion" ? 100 : Math.round((correctAnswers / totalQuestions) * 100);
  const message = activeQuizMode === "opinion" ? "Done!" : getResultMessage(scorePercentage);
  const earnedStars = activeQuizMode === "opinion" ? 0 : correctAnswers;

  if (earnedStars > 0) {
    addStars(earnedStars);
  }

  latestResult = {
    scorePercentage,
    correctAnswers: activeQuizMode === "opinion" ? totalQuestions : correctAnswers,
    totalQuestions,
    message,
    earnedStars,
  };

  resultScore.textContent = activeQuizMode === "opinion" ? `${totalQuestions}/${totalQuestions} choices made` : `${scorePercentage}% • ${correctAnswers}/${totalQuestions}`;
  document.querySelector("#stars-earned").textContent = `You earned ${earnedStars} stars!`;
  resultMessage.textContent = message;
  nicknameInput.value = activePlayer ? activePlayer.nickname : "";
  nicknameInput.disabled = Boolean(activePlayer);
  editQuizButton.classList.toggle("hidden", ["shared", "online"].includes(activeQuizSource));
  quizCard.classList.add("hidden");
  resultCard.classList.remove("hidden");
  renderLeaderboard();

  if (!activePlayer) {
    nicknameInput.focus();
  }
}

function getLeaderboard() {
  const savedLeaderboard = localStorage.getItem(leaderboardKey);

  if (!savedLeaderboard) {
    return [];
  }

  try {
    const leaderboard = JSON.parse(savedLeaderboard);
    return Array.isArray(leaderboard) ? leaderboard : [];
  } catch {
    return [];
  }
}

function saveLeaderboard(leaderboard) {
  localStorage.setItem(leaderboardKey, JSON.stringify(leaderboard));
}

function getQuizLeaderboards() {
  const savedLeaderboards = localStorage.getItem(quizLeaderboardsKey);

  if (!savedLeaderboards) {
    return {};
  }

  try {
    const leaderboards = JSON.parse(savedLeaderboards);
    return leaderboards && typeof leaderboards === "object" && !Array.isArray(leaderboards) ? leaderboards : {};
  } catch {
    return {};
  }
}

function saveQuizLeaderboards(leaderboards) {
  localStorage.setItem(quizLeaderboardsKey, JSON.stringify(leaderboards));
}

function getQuizLeaderboard(quizId) {
  const leaderboards = getQuizLeaderboards();
  return Array.isArray(leaderboards[quizId]) ? leaderboards[quizId] : [];
}

function saveQuizLeaderboard(quizId, leaderboard) {
  const leaderboards = getQuizLeaderboards();
  leaderboards[quizId] = leaderboard;
  saveQuizLeaderboards(leaderboards);
}

function getStarTitle(stars) {
  if (stars >= 200) {
    return "Ultimate Star Collector";
  }

  if (stars >= 100) {
    return "Star Legend";
  }

  if (stars >= 50) {
    return "Mystery Pro";
  }

  if (stars >= 20) {
    return "Rising Star";
  }

  return "New Player";
}

function getStarLeaderboard() {
  const savedLeaderboard = localStorage.getItem(starLeaderboardKey);

  if (!savedLeaderboard) {
    return [];
  }

  try {
    const leaderboard = JSON.parse(savedLeaderboard);
    return Array.isArray(leaderboard) ? leaderboard : [];
  } catch {
    return [];
  }
}

function saveStarLeaderboard(leaderboard) {
  localStorage.setItem(starLeaderboardKey, JSON.stringify(leaderboard));
}

function sortStarLeaderboard(leaderboard) {
  return leaderboard
    .slice()
    .sort((firstPlayer, secondPlayer) => {
      if (secondPlayer.stars !== firstPlayer.stars) {
        return secondPlayer.stars - firstPlayer.stars;
      }

      return new Date(secondPlayer.updatedAt).getTime() - new Date(firstPlayer.updatedAt).getTime();
    })
    .slice(0, maxLeaderboardEntries);
}

function getGuestStarNickname(askGuestNickname = true) {
  const savedNickname = localStorage.getItem(guestStarNicknameKey);

  if (savedNickname) {
    return savedNickname;
  }

  if (!askGuestNickname) {
    return "";
  }

  const nickname = prompt("Use a nickname, not your real full name.");
  const nicknameCheck = validateNickname(nickname || "");

  if (nicknameCheck.message) {
    alert(nicknameCheck.message);
    return "";
  }

  registerUsedNickname(nicknameCheck.displayName);
  localStorage.setItem(guestStarNicknameKey, nicknameCheck.displayName);
  return nicknameCheck.displayName;
}

function updateStarLeaderboard({ askGuestNickname = true } = {}) {
  const stars = getStarBalance();
  const nickname = activePlayer ? activePlayer.nickname : getGuestStarNickname(askGuestNickname);

  if (!nickname) {
    return;
  }

  const avatar = activePlayer ? activePlayer.avatar : null;
  const existingLeaderboard = getStarLeaderboard();
  const existingEntry = existingLeaderboard.find((entry) => normalizeNickname(entry.nickname) === normalizeNickname(nickname));
  const updatedEntry = {
    ...existingEntry,
    nickname,
    avatar,
    stars,
    title: getStarTitle(stars),
    updatedAt: new Date().toISOString(),
  };
  const updatedLeaderboard = existingEntry
    ? existingLeaderboard.map((entry) => (normalizeNickname(entry.nickname) === normalizeNickname(nickname) ? updatedEntry : entry))
    : [...existingLeaderboard, updatedEntry];

  registerUsedNickname(nickname);
  saveStarLeaderboard(sortStarLeaderboard(updatedLeaderboard));
}

function renderStarLeaderboard() {
  const leaderboard = sortStarLeaderboard(getStarLeaderboard());

  if (leaderboard.length === 0) {
    starLeaderboardList.innerHTML = '<p class="empty-leaderboard">No star rankings yet. Earn stars from games and quizzes to join the board.</p>';
    return;
  }

  starLeaderboardList.innerHTML = "";

  leaderboard.forEach((entry, index) => {
    const row = document.createElement("article");
    row.className = "leaderboard-entry star-entry";

    const rankBadge = document.createElement("div");
    rankBadge.className = "rank-badge";
    rankBadge.textContent = index + 1;

    const playerDetails = document.createElement("div");
    const playerLine = document.createElement("div");
    playerLine.className = "player-line";
    const playerAvatar = document.createElement("div");
    renderAvatar(playerAvatar, getLatestAvatarForNickname(entry.nickname, entry.avatar));
    const playerName = document.createElement("p");
    playerName.className = "player-name";
    playerName.textContent = entry.nickname;
    playerLine.append(playerAvatar, playerName);

    const playerMessage = document.createElement("p");
    playerMessage.className = "player-message";
    const updatedTime = entry.updatedAt ? new Date(entry.updatedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";
    playerMessage.textContent = updatedTime ? `${entry.title} • Updated ${updatedTime}` : entry.title;
    playerDetails.append(playerLine, playerMessage);

    const playerScore = document.createElement("div");
    playerScore.className = "player-score";
    const score = document.createElement("span");
    score.textContent = entry.stars;
    playerScore.append(score, "stars");

    row.append(rankBadge, playerDetails, playerScore);
    starLeaderboardList.append(row);
  });
}

function sortLeaderboard(leaderboard) {
  return leaderboard
    .slice()
    .sort((firstPlayer, secondPlayer) => {
      if (secondPlayer.scorePercentage !== firstPlayer.scorePercentage) {
        return secondPlayer.scorePercentage - firstPlayer.scorePercentage;
      }

      return firstPlayer.createdAt - secondPlayer.createdAt;
    })
    .slice(0, maxLeaderboardEntries);
}

function getGameLeaderboards() {
  const savedLeaderboards = localStorage.getItem(gameLeaderboardsKey);

  if (!savedLeaderboards) {
    return {};
  }

  try {
    const leaderboards = JSON.parse(savedLeaderboards);
    return leaderboards && typeof leaderboards === "object" && !Array.isArray(leaderboards) ? leaderboards : {};
  } catch {
    return {};
  }
}

function saveGameLeaderboards(leaderboards) {
  localStorage.setItem(gameLeaderboardsKey, JSON.stringify(leaderboards));
}

function getGameLeaderboard(gameId) {
  const leaderboards = getGameLeaderboards();
  return Array.isArray(leaderboards[gameId]) ? leaderboards[gameId] : [];
}

function sortGameLeaderboard(leaderboard) {
  return leaderboard
    .slice()
    .sort((firstEntry, secondEntry) => {
      if (secondEntry.starsEarned !== firstEntry.starsEarned) {
        return secondEntry.starsEarned - firstEntry.starsEarned;
      }

      return secondEntry.createdAt - firstEntry.createdAt;
    })
    .slice(0, maxLeaderboardEntries);
}

function saveGameLeaderboardEntry(gameId, entry) {
  const leaderboards = getGameLeaderboards();
  leaderboards[gameId] = sortGameLeaderboard([...(leaderboards[gameId] || []), entry]);
  saveGameLeaderboards(leaderboards);
}

function getCurrentLeaderboardNickname() {
  if (activePlayer) {
    return activePlayer.nickname;
  }

  return getGuestStarNickname(true) || "Mystery Player";
}

function renderGameLeaderboard(gameId) {
  const game = builtInGames[gameId];
  const leaderboard = sortGameLeaderboard(getGameLeaderboard(gameId));
  miniGameLeaderboardTitle.textContent = `${game?.title || "Game"} Leaderboard`;

  if (leaderboard.length === 0) {
    miniGameLeaderboardList.innerHTML = '<p class="empty-leaderboard">No game scores yet. Play a round to appear here.</p>';
    return;
  }

  miniGameLeaderboardList.innerHTML = "";
  leaderboard.forEach((entry, index) => {
    const row = document.createElement("article");
    row.className = "leaderboard-entry";

    const rankBadge = document.createElement("div");
    rankBadge.className = "rank-badge";
    rankBadge.textContent = index + 1;

    const playerDetails = document.createElement("div");
    const playerLine = document.createElement("div");
    playerLine.className = "player-line";
    const playerAvatar = document.createElement("div");
    renderAvatar(playerAvatar, getLatestAvatarForNickname(entry.nickname, entry.avatar));
    const playerName = document.createElement("p");
    playerName.className = "player-name";
    playerName.textContent = entry.nickname;
    playerLine.append(playerAvatar, playerName);

    const playerMessage = document.createElement("p");
    playerMessage.className = "player-message";
    const playedAt = entry.createdAt ? new Date(entry.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";
    playerMessage.textContent = playedAt ? `${entry.resultTitle} • ${playedAt}` : entry.resultTitle;
    playerDetails.append(playerLine, playerMessage);

    const playerScore = document.createElement("div");
    playerScore.className = "player-score";
    const score = document.createElement("span");
    score.textContent = entry.starsEarned;
    playerScore.append(score, "stars");

    row.append(rankBadge, playerDetails, playerScore);
    miniGameLeaderboardList.append(row);
  });
}

function cleanNickname(nickname) {
  return cleanPlayerNickname(nickname);
}

async function addToLeaderboard(event) {
  event.preventDefault();

  if (!latestResult) {
    return;
  }

  const nickname = activePlayer ? activePlayer.nickname : cleanNickname(nicknameInput.value);
  const nicknameCheck = activePlayer
    ? { displayName: activePlayer.nickname, message: "" }
    : validateNickname(nickname);

  if (nicknameCheck.message) {
    leaderboardNicknameMessage.textContent = nicknameCheck.message;
    return;
  }

  const newEntry = {
    id: crypto.randomUUID(),
    nickname: nicknameCheck.displayName,
    avatar: activePlayer ? activePlayer.avatar : null,
    scorePercentage: latestResult.scorePercentage,
    correctAnswers: latestResult.correctAnswers,
    totalQuestions: latestResult.totalQuestions,
    message: latestResult.message,
    quizId: activeQuizId,
    createdAt: Date.now(),
  };

  const leaderboard = sortLeaderboard([...getLeaderboard(), newEntry]);
  saveLeaderboard(leaderboard);
  registerUsedNickname(newEntry.nickname);
  leaderboardNicknameMessage.textContent = "Score saved to the leaderboard.";

  if (activeQuizId) {
    const quizLeaderboard = sortLeaderboard([...getQuizLeaderboard(activeQuizId), newEntry]);
    saveQuizLeaderboard(activeQuizId, quizLeaderboard);
  }

  if (activeOnlineQuizId && onlineQuizSharing.isConfigured) {
    try {
      await onlineQuizSharing.saveScore({
        quizId: activeOnlineQuizId,
        nickname: newEntry.nickname,
        scorePercent: newEntry.scorePercentage,
        correctAnswers: newEntry.correctAnswers,
        totalQuestions: newEntry.totalQuestions,
        resultMessage: newEntry.message,
      });
      onlineLeaderboardEntries = sortLeaderboard(await onlineQuizSharing.loadScores(activeOnlineQuizId));
      leaderboardNicknameMessage.textContent = "Score saved to this online quiz leaderboard.";
    } catch {
      onlineLeaderboardEntries = sortLeaderboard([...onlineLeaderboardEntries, newEntry]);
      leaderboardNicknameMessage.textContent = "Score saved temporarily. Online leaderboard needs the Supabase quiz_scores table to be ready.";
    }
  }

  renderLeaderboard();

  if (!activePlayer) {
    nicknameInput.value = "";
  }
}

function renderLeaderboard() {
  const hasQuizLeaderboard = Boolean(activeOnlineQuizId || activeQuizId);

  if (!hasQuizLeaderboard) {
    leaderboardSection.classList.add("hidden");
    leaderboardList.innerHTML = "";
    return;
  }

  leaderboardSection.classList.remove("hidden");

  const leaderboard = activeOnlineQuizId
    ? sortLeaderboard(onlineLeaderboardEntries)
    : sortLeaderboard(getQuizLeaderboard(activeQuizId));
  const activeQuiz = activeQuizId ? findSavedQuizById(activeQuizId) : null;

  if (leaderboard.length === 0) {
    leaderboardList.innerHTML = `<p class="empty-leaderboard">${activeOnlineQuizId ? "No online scores yet for this shared quiz." : `No scores yet for ${activeQuiz?.title || "this quiz"}.`}</p>`;
    return;
  }

  leaderboardList.innerHTML = "";

  leaderboard.forEach((entry, index) => {
    const row = document.createElement("article");
    row.className = "leaderboard-entry";

    const rankBadge = document.createElement("div");
    rankBadge.className = "rank-badge";
    rankBadge.textContent = index + 1;

    const playerDetails = document.createElement("div");
    const playerLine = document.createElement("div");
    playerLine.className = "player-line";
    const playerAvatar = document.createElement("div");
    renderAvatar(playerAvatar, getLatestAvatarForNickname(entry.nickname, entry.avatar));
    const playerName = document.createElement("p");
    playerName.className = "player-name";
    playerName.textContent = entry.nickname;
    playerLine.append(playerAvatar, playerName);
    const playerMessage = document.createElement("p");
    playerMessage.className = "player-message";
    playerMessage.textContent = entry.message;
    playerDetails.append(playerLine, playerMessage);

    const playerScore = document.createElement("div");
    playerScore.className = "player-score";
    const scorePercentage = document.createElement("span");
    scorePercentage.textContent = `${entry.scorePercentage}%`;
    playerScore.append(scorePercentage, `${entry.correctAnswers}/${entry.totalQuestions}`);

    row.append(rankBadge, playerDetails, playerScore);
    leaderboardList.append(row);
  });
}

function normalizeFriendCode(code) {
  return code.trim().toUpperCase();
}

function findProfileByFriendCode(code) {
  const friendCode = normalizeFriendCode(code);
  const localProfile = getPlayerProfiles().find((profile) => normalizeFriendCode(profile.friendCode || "") === friendCode) || null;

  if (localProfile) {
    return localProfile;
  }

  return activePlayer?.friendProfiles?.[friendCode] || null;
}

function getFriendProfileSnapshot(friendCode) {
  const safeFriendCode = normalizeFriendCode(friendCode);
  return findProfileByFriendCode(safeFriendCode) || {
    userId: "",
    nickname: "Friend",
    friendCode: safeFriendCode,
    stars: 0,
    avatar: createDefaultAvatar(),
  };
}

function buildFriendProfileMap(friendProfiles = {}, profile) {
  const safeProfile = normalizeOnlineFriendProfile(profile);

  if (!safeProfile) {
    return friendProfiles && typeof friendProfiles === "object" ? friendProfiles : {};
  }

  return {
    ...(friendProfiles && typeof friendProfiles === "object" ? friendProfiles : {}),
    [safeProfile.friendCode]: safeProfile,
  };
}

function addFriendToProfile(profile, friendProfile) {
  const safeProfile = ensureFriendProfile(profile);
  const safeFriend = normalizeOnlineFriendProfile(friendProfile);

  if (!safeFriend || safeFriend.friendCode === normalizeFriendCode(safeProfile.friendCode)) {
    return safeProfile;
  }

  const friendSet = new Set((safeProfile.friends || []).map(normalizeFriendCode));
  friendSet.add(safeFriend.friendCode);

  return {
    ...safeProfile,
    friends: [...friendSet],
    friendProfiles: buildFriendProfileMap(safeProfile.friendProfiles, safeFriend),
  };
}

function saveLocalMutualFriend(ownerProfile, friendProfile) {
  const safeOwner = normalizeOnlineFriendProfile(ownerProfile);
  const safeFriend = normalizeOnlineFriendProfile(friendProfile);

  if (!safeOwner || !safeFriend || safeOwner.friendCode === safeFriend.friendCode) {
    return;
  }

  const profiles = getPlayerProfiles();
  const hasLocalFriendProfile = profiles.some((profile) => normalizeFriendCode(profile.friendCode || "") === safeFriend.friendCode);
  const updatedProfiles = profiles.map((profile) => {
    const profileCode = normalizeFriendCode(profile.friendCode || "");

    if (profileCode === safeOwner.friendCode) {
      return addFriendToProfile(profile, safeFriend);
    }

    if (hasLocalFriendProfile && profileCode === safeFriend.friendCode) {
      return addFriendToProfile(profile, safeOwner);
    }

    return profile;
  });

  savePlayerProfiles(updatedProfiles);
}

async function syncOnlineFriendsToLocal() {
  if (!activePlayer || !onlineFriendCodes.isConfigured) {
    return;
  }

  try {
    await onlineFriendCodes.saveProfile(activePlayer);
    const onlineFriends = await onlineFriendCodes.loadFriends(activePlayer.friendCode);

    if (onlineFriends.length === 0) {
      return;
    }

    const currentFriends = Array.isArray(activePlayer.friends) ? activePlayer.friends : [];
    const friendSet = new Set(currentFriends.map(normalizeFriendCode));
    let friendProfiles = activePlayer.friendProfiles || {};

    onlineFriends.forEach((friendProfile) => {
      friendSet.add(friendProfile.friendCode);
      friendProfiles = buildFriendProfileMap(friendProfiles, friendProfile);
    });

    updateActivePlayerProfile({
      friends: [...friendSet],
      friendProfiles,
    });
  } catch (error) {
    console.error("Supabase friends sync error:", error);
    friendsMessage.textContent = "Online friends could not load right now. Showing saved friends for now.";
  }
}

async function syncFriendGameStateFromOnline() {
  if (!activePlayer || (!onlineFriendMessages.isConfigured && !onlineFriendGames.isConfigured)) {
    return;
  }

  if (onlineFriendGames.isConfigured) {
    try {
      const records = await onlineFriendGames.loadGamesForPlayer(activePlayer.friendCode);
      cacheFriendGameStateFromOnlineRecords(records);
    } catch (error) {
      console.error("Supabase friend game record sync error:", error);
    }
  }

  if (!onlineFriendMessages.isConfigured) {
    return;
  }

  const friendCodes = (Array.isArray(activePlayer.friends) ? activePlayer.friends : [])
    .map(normalizeFriendCode)
    .filter((friendCode) => friendCode && !isFriendBlocked(friendCode))
    .slice(0, 30);

  await Promise.all(friendCodes.map(async (friendCode) => {
    try {
      const messages = await onlineFriendMessages.loadMessages(getChatId(friendCode));
      cacheFriendGameStateFromMessages(messages);
    } catch (error) {
      console.error("Friend game sync error:", error);
    }
  }));
}

async function copyFriendCode() {
  if (!activePlayer?.friendCode) {
    return;
  }

  try {
    await navigator.clipboard.writeText(activePlayer.friendCode);
    friendsMessage.textContent = "Friend code copied.";
  } catch {
    friendsMessage.textContent = `Your friend code is ${activePlayer.friendCode}.`;
  }
}

async function addFriendByCode() {
  if (!activePlayer) {
    showPlayerGate();
    return;
  }

  const friendCode = normalizeFriendCode(friendCodeInput.value);

  if (!friendCode) {
    friendsMessage.textContent = "Please enter a friend code.";
    return;
  }

  if (friendCode === normalizeFriendCode(activePlayer.friendCode)) {
    friendsMessage.textContent = "That is your own friend code.";
    return;
  }

  const friends = (Array.isArray(activePlayer.friends) ? activePlayer.friends : []).map(normalizeFriendCode);

  if (friends.includes(friendCode)) {
    friendsMessage.textContent = "That friend is already in your list.";
    return;
  }

  friendsMessage.textContent = "Checking friend code...";

  let friendProfile = null;

  if (onlineFriendCodes.isConfigured) {
    try {
      await onlineFriendCodes.saveProfile(activePlayer);
      friendProfile = await onlineFriendCodes.findProfileByFriendCode(friendCode);

      if (friendProfile) {
        await onlineFriendCodes.saveFriend(activePlayer, friendProfile);
      }
    } catch (error) {
      console.error("Supabase friend code lookup error:", error);
      friendsMessage.textContent = "Online friend lookup could not run right now. Trying your saved friend list next.";
    }
  }

  friendProfile = friendProfile || findProfileByFriendCode(friendCode);

  if (!friendProfile) {
    friendsMessage.textContent = "Friend code not found. Please check and try again.";
    return;
  }

  const safeFriend = normalizeOnlineFriendProfile(friendProfile);

  if (!safeFriend) {
    friendsMessage.textContent = "Friend code not found. Please check and try again.";
    return;
  }

  const friendProfiles = buildFriendProfileMap(activePlayer.friendProfiles, safeFriend);

  updateActivePlayerProfile({
    friends: [...friends, safeFriend.friendCode],
    friendProfiles,
  });
  saveLocalMutualFriend(activePlayer, safeFriend);
  friendCodeInput.value = "";
  friendsMessage.textContent = `${safeFriend.nickname} added to My Friends.`;
  renderFriends();
}

function removeFriend(friendCode) {
  if (!activePlayer) {
    return;
  }

  const shouldRemove = confirm("Remove this friend from your list?");

  if (!shouldRemove) {
    return;
  }

  const friends = (activePlayer.friends || []).filter((savedFriendCode) => savedFriendCode !== friendCode);
  const friendProfiles = { ...(activePlayer.friendProfiles || {}) };
  delete friendProfiles[normalizeFriendCode(friendCode)];
  updateActivePlayerProfile({ friends, friendProfiles });
  if (selectedFriendActionCode === normalizeFriendCode(friendCode)) {
    selectedFriendActionCode = "";
    friendActionPanel.classList.add("hidden");
  }
  friendsMessage.textContent = "Friend removed.";
  renderFriends();
}

function blockFriend(friendCode) {
  if (!activePlayer) {
    return;
  }

  const shouldBlock = confirm("Block this friend from chat?");

  if (!shouldBlock) {
    return;
  }

  const blockedFriends = Array.isArray(activePlayer.blockedFriends) ? activePlayer.blockedFriends : [];
  const friends = (activePlayer.friends || []).filter((savedFriendCode) => savedFriendCode !== friendCode);
  const friendProfiles = { ...(activePlayer.friendProfiles || {}) };
  delete friendProfiles[normalizeFriendCode(friendCode)];
  updateActivePlayerProfile({
    friends,
    friendProfiles,
    blockedFriends: blockedFriends.includes(friendCode) ? blockedFriends : [...blockedFriends, friendCode],
  });
  friendsMessage.textContent = "Friend blocked and removed from your list.";
  selectedChatFriendCode = "";
  if (selectedFriendActionCode === normalizeFriendCode(friendCode)) {
    selectedFriendActionCode = "";
    friendActionPanel.classList.add("hidden");
  }
  renderFriends();
}

function isFriendBlocked(friendCode) {
  return Array.isArray(activePlayer?.blockedFriends) && activePlayer.blockedFriends.includes(friendCode);
}

function getFriendActivity() {
  const savedActivity = localStorage.getItem(friendActivityKey);

  if (!savedActivity) {
    return [];
  }

  try {
    const activity = JSON.parse(savedActivity);
    return Array.isArray(activity) ? activity : [];
  } catch {
    return [];
  }
}

function saveFriendActivity(activity) {
  localStorage.setItem(friendActivityKey, JSON.stringify(activity.slice(0, 40)));
}

function addFriendActivity(entry) {
  const activity = getFriendActivity();
  saveFriendActivity([
    {
      id: crypto.randomUUID(),
      ownerCode: activePlayer?.friendCode || "",
      createdAt: Date.now(),
      ...entry,
    },
    ...activity,
  ]);
  renderFriendActivity();
}

function getFriendRewardLog() {
  const savedLog = localStorage.getItem(friendRewardLogKey);

  if (!savedLog) {
    return {};
  }

  try {
    const log = JSON.parse(savedLog);
    return log && typeof log === "object" ? log : {};
  } catch {
    return {};
  }
}

function saveFriendRewardLog(log) {
  localStorage.setItem(friendRewardLogKey, JSON.stringify(log));
}

function awardFriendActionStars(actionKey, amount) {
  if (!activePlayer) {
    return false;
  }

  const today = new Date().toISOString().slice(0, 10);
  const rewardKey = `${today}:${activePlayer.friendCode}:${actionKey}`;
  const log = getFriendRewardLog();

  if (log[rewardKey]) {
    return false;
  }

  log[rewardKey] = Date.now();
  saveFriendRewardLog(log);
  addStars(amount);
  return true;
}

function getFriendActivityText(entry) {
  if (entry.type === "challenge") {
    return `You challenged ${entry.friendNickname} to “${entry.quizTitle}.”`;
  }

  if (entry.type === "message") {
    return `You sent ${entry.friendNickname}: ${entry.text}`;
  }

  if (entry.type === "sticker") {
    return `You sent ${entry.friendNickname} a sticker: ${entry.text}`;
  }

  if (entry.type === "box_invite_sent") {
    return `You invited ${entry.friendNickname} to play Box of Lies.`;
  }

  if (entry.type === "box_invite_accepted") {
    return `You accepted ${entry.friendNickname}'s Box of Lies invite.`;
  }

  if (entry.type === "box_invite_declined") {
    return `You declined ${entry.friendNickname}'s Box of Lies invite.`;
  }

  if (entry.type === "box_invite_cancelled") {
    return `You cancelled the Box of Lies invite for ${entry.friendNickname}.`;
  }

  if (entry.type === "box_sent" || entry.type === "box_message_sent") {
    return `You sent ${entry.friendNickname} a Box of Lies challenge.`;
  }

  if (entry.type === "box_correct") {
    return `You guessed ${entry.friendNickname}'s Box of Lies correctly.`;
  }

  if (entry.type === "box_played") {
    return `You played ${entry.friendNickname}'s Box of Lies game.`;
  }

  if (entry.type === "trade_offer_sent") {
    return `You sent ${entry.friendNickname} a trade offer.`;
  }

  if (entry.type === "trade_completed") {
    return `You completed a trade with ${entry.friendNickname}.`;
  }

  if (entry.type === "trade_declined") {
    return `You declined ${entry.friendNickname}'s trade.`;
  }

  return entry.text || "Friend activity saved.";
}

function renderFriendActivity() {
  if (!friendActivityList) {
    return;
  }

  const ownerCode = activePlayer?.friendCode || "";
  const activity = getFriendActivity()
    .filter((entry) => !ownerCode || !entry.ownerCode || entry.ownerCode === ownerCode)
    .slice(0, 10);

  friendActivityList.innerHTML = "";

  if (activity.length === 0) {
    friendActivityList.innerHTML = '<p class="empty-leaderboard">No friend activity yet. Send a quiz challenge or a safe reaction.</p>';
    return;
  }

  activity.forEach((entry) => {
    const item = document.createElement("article");
    item.className = "friend-activity-item";

    const text = document.createElement("p");
    text.textContent = getFriendActivityText(entry);

    const time = document.createElement("span");
    const createdAt = new Date(entry.createdAt);
    time.textContent = `${createdAt.toLocaleDateString()} ${createdAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;

    item.append(text, time);
    friendActivityList.append(item);
  });
}

async function saveFriendMessage(friendCode, messageText, messageType = "typed", sticker = "", extraData = {}) {
  const friendProfile = getFriendProfileSnapshot(friendCode);
  const safeFriendCode = normalizeFriendCode(friendProfile.friendCode);

  if (!activePlayer || !isApprovedFriendCode(safeFriendCode)) {
    throw new Error("Only added friends can message each other.");
  }

  const message = {
    id: crypto.randomUUID(),
    chatId: getChatId(safeFriendCode),
    senderUserId: activePlayer.userId || onlineAccountStorage.userId,
    receiverUserId: friendProfile.userId || "",
    senderCode: normalizeFriendCode(activePlayer.friendCode),
    receiverCode: safeFriendCode,
    senderNickname: activePlayer.nickname,
    receiverNickname: friendProfile.nickname,
    text: messageText,
    type: messageType,
    sticker,
    quizInvite: extraData.quizInvite || {},
    gameData: extraData.gameData || {},
    createdAt: Date.now(),
  };

  if (onlineFriendMessages.isConfigured) {
    try {
      const savedMessage = await onlineFriendMessages.saveMessage(message);
      if (savedMessage.chatId === getChatId(selectedChatFriendCode)) {
        activeOnlineChatMessages = [...activeOnlineChatMessages, savedMessage]
          .filter((chatMessageEntry, index, messages) => messages.findIndex((entry) => entry.id === chatMessageEntry.id) === index)
          .sort((firstMessage, secondMessage) => firstMessage.createdAt - secondMessage.createdAt);
        chatLoadedFromSupabase = true;
      }
      cacheFriendGameStateFromMessages([savedMessage]);
      saveLocalChatMessage(savedMessage);
      return { message: savedMessage, online: true };
    } catch (error) {
      console.error("Supabase friend chat send error:", error);
    }
  }

  saveLocalChatMessage(message);
  if (message.chatId === getChatId(selectedChatFriendCode)) {
    activeOnlineChatMessages = [];
    chatLoadedFromSupabase = false;
  }
  return { message, online: false };
}

async function saveSafeFriendMessage(friendCode, messageText, messageType = "quick", sticker = "") {
  const result = await saveFriendMessage(friendCode, messageText, messageType, sticker);
  const friendProfile = getFriendProfileSnapshot(friendCode);
  addFriendActivity({
    type: messageType === "sticker" ? "sticker" : "message",
    friendCode: friendProfile.friendCode,
    friendNickname: friendProfile.nickname,
    text: messageText,
    sticker,
  });
  return result;
}

function renderQuizPicker(selectElement, sendButton) {
  const quizzes = getSavedQuizzes();
  selectElement.innerHTML = "";

  if (quizzes.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No saved quizzes yet";
    selectElement.append(option);
    sendButton.disabled = true;
    return false;
  }

  quizzes.forEach((quiz) => {
    const option = document.createElement("option");
    option.value = quiz.id;
    option.textContent = `${quiz.title} (${quiz.questions.length} clues)`;
    selectElement.append(option);
  });

  sendButton.disabled = false;
  return true;
}

function renderFriendQuizSelect() {
  return renderQuizPicker(friendQuizSelect, sendFriendChallengeButton);
}

function renderChatQuizSelect() {
  return renderQuizPicker(chatQuizSelect, chatSendQuizConfirmButton);
}

function renderFriendActionButtons() {
  friendPresetMessageList.innerHTML = "";
  friendStickerList.innerHTML = "";

  quickChatMessages.forEach((messageText) => {
    const button = document.createElement("button");
    button.className = "secondary-button quick-chat-button";
    button.type = "button";
    button.textContent = messageText;
    button.addEventListener("click", () => sendPresetMessageToSelectedFriend(messageText));
    friendPresetMessageList.append(button);
  });

  stickerReactions.forEach((sticker) => {
    const button = document.createElement("button");
    button.className = "secondary-button quick-chat-button";
    button.type = "button";
    button.textContent = sticker.text;
    button.addEventListener("click", () => sendStickerToSelectedFriend(sticker));
    friendStickerList.append(button);
  });
}

function openFriendActionPanel(friendCode) {
  const friendProfile = getFriendProfileSnapshot(friendCode);
  selectedFriendActionCode = friendProfile.friendCode;
  friendActionTitle.textContent = `Send a quiz to ${friendProfile.nickname}`;
  friendActionMessage.textContent = "";
  friendChallengeOutput.value = "";
  friendChallengeOutputWrap.classList.add("hidden");
  const hasQuizzes = renderFriendQuizSelect();
  if (!hasQuizzes) {
    friendActionMessage.textContent = "You do not have any quizzes yet. Create a quiz first.";
  }
  friendActionPanel.classList.remove("hidden");
}

async function copyFriendChallengeLink() {
  if (!friendChallengeOutput.value) {
    friendActionMessage.textContent = "Create a challenge link first.";
    return;
  }

  try {
    await navigator.clipboard.writeText(friendChallengeOutput.value);
    friendActionMessage.textContent = "Challenge link copied.";
  } catch {
    friendChallengeOutput.select();
    document.execCommand("copy");
    friendActionMessage.textContent = "Challenge link copied.";
  }
}

async function sendQuizInviteToFriend(friendCode, quiz) {
  const friendProfile = getFriendProfileSnapshot(friendCode);

  if (!quiz) {
    throw new Error("No quiz selected.");
  }

  if (!onlineQuizSharing.isConfigured) {
    throw new Error(getOnlineSharingSetupMessage());
  }

  const link = await createOnlineFriendLink(quiz);
  const challengeUrl = new URL(link);
  const challengeId = crypto.randomUUID();
  challengeUrl.searchParams.set("challenge", challengeId);
  challengeUrl.searchParams.set("from", activePlayer.friendCode);
  const quizLink = challengeUrl.toString();
  const quizInvite = {
    quizId: challengeUrl.searchParams.get("quiz") || "",
    quizTitle: quiz.title,
    quizLink,
    questionCount: quiz.questions.length,
  };
  const messageText = `Quiz invite: ${quiz.title}`.slice(0, 150);
  const result = await saveFriendMessage(friendProfile.friendCode, messageText, "quiz_invite", "", { quizInvite });
  const earnedStar = awardFriendActionStars(`challenge:${friendProfile.friendCode}:${quiz.id}`, 1);

  addFriendActivity({
    id: challengeId,
    type: "challenge",
    friendCode: friendProfile.friendCode,
    friendNickname: friendProfile.nickname,
    quizId: quiz.id,
    quizTitle: quiz.title,
    link: quizLink,
  });

  return {
    ...quizInvite,
    online: result.online,
    earnedStar,
  };
}

async function createFriendChallenge() {
  if (!selectedFriendActionCode) {
    friendActionMessage.textContent = "Choose a friend first.";
    return;
  }

  const quiz = findSavedQuizById(friendQuizSelect.value);
  const friendProfile = getFriendProfileSnapshot(selectedFriendActionCode);

  if (!quiz) {
    friendActionMessage.textContent = "You do not have any quizzes yet. Create a quiz first.";
    return;
  }

  try {
    friendActionMessage.textContent = `Sending quiz to ${friendProfile.nickname}...`;
    const invite = await sendQuizInviteToFriend(selectedFriendActionCode, quiz);
    friendChallengeOutput.value = invite.quizLink;
    friendChallengeOutputWrap.classList.remove("hidden");
    friendActionMessage.textContent = `Quiz sent to ${friendProfile.nickname}!`;
  } catch (error) {
    if (String(error?.message || "").includes("Short friend links need")) {
      friendChallengeOutputWrap.classList.add("hidden");
      friendActionMessage.textContent = getOnlineSharingSetupMessage();
    } else {
      showOnlineSharingRequestError(friendActionMessage, error, friendChallengeOutputWrap);
    }
  }
}

async function sendPresetMessageToSelectedFriend(messageText) {
  if (!selectedFriendActionCode) {
    friendActionMessage.textContent = "Choose a friend first.";
    return;
  }

  try {
    const result = await saveSafeFriendMessage(selectedFriendActionCode, messageText, "quick");
    friendActionMessage.textContent = result.online
      ? "Preset message sent online and saved in Friend Chat."
      : "Preset message saved temporarily because online chat could not connect.";
  } catch (error) {
    console.error("Friend preset message error:", error);
    friendActionMessage.textContent = "Choose an added friend first.";
  }
}

async function sendStickerToSelectedFriend(sticker) {
  if (!selectedFriendActionCode) {
    friendActionMessage.textContent = "Choose a friend first.";
    return;
  }

  try {
    const result = await saveSafeFriendMessage(selectedFriendActionCode, sticker.text, "sticker", sticker.label);
    const earnedStar = awardFriendActionStars(`sticker:${selectedFriendActionCode}:${sticker.label}`, 1);
    const savedWhere = result.online ? "sent online" : "saved temporarily";
    friendActionMessage.textContent = earnedStar
      ? `Sticker reaction ${savedWhere}. You earned 1 star for a safe reaction today.`
      : `Sticker reaction ${savedWhere}. You already earned today's star for this sticker.`;
  } catch (error) {
    console.error("Friend sticker message error:", error);
    friendActionMessage.textContent = "Choose an added friend first.";
  }
}

function getChatMessages() {
  const savedMessages = localStorage.getItem(friendChatKey);

  if (!savedMessages) {
    return [];
  }

  try {
    const messages = JSON.parse(savedMessages);
    return Array.isArray(messages) ? messages : [];
  } catch {
    return [];
  }
}

function saveChatMessages(messages) {
  localStorage.setItem(friendChatKey, JSON.stringify(messages));
}

function getChatId(friendCode) {
  if (!activePlayer?.friendCode || !friendCode) {
    return "";
  }

  return [normalizeFriendCode(activePlayer.friendCode), normalizeFriendCode(friendCode)].sort().join("__");
}

function getLocalActiveChatMessages() {
  const chatId = getChatId(selectedChatFriendCode);
  return getChatMessages()
    .filter((message) => message.chatId === chatId)
    .sort((firstMessage, secondMessage) => firstMessage.createdAt - secondMessage.createdAt);
}

function getActiveChatMessages() {
  return chatLoadedFromSupabase
    ? activeOnlineChatMessages
    : getLocalActiveChatMessages();
}

function isApprovedFriendCode(friendCode) {
  const safeFriendCode = normalizeFriendCode(friendCode);
  return Boolean(
    safeFriendCode
    && !isFriendBlocked(safeFriendCode)
    && Array.isArray(activePlayer?.friends)
    && activePlayer.friends.map(normalizeFriendCode).includes(safeFriendCode)
  );
}

function saveLocalChatMessage(message) {
  const safeMessage = normalizeOnlineMessage(message);

  if (!safeMessage) {
    return;
  }

  const messages = getChatMessages();
  const updatedMessages = [
    ...messages.filter((savedMessage) => savedMessage.id !== safeMessage.id),
    safeMessage,
  ].sort((firstMessage, secondMessage) => firstMessage.createdAt - secondMessage.createdAt);
  saveChatMessages(updatedMessages);
  cacheFriendGameStateFromMessages([safeMessage]);
}

async function loadActiveChatMessages() {
  const chatId = getChatId(selectedChatFriendCode);

  if (!chatId) {
    activeOnlineChatMessages = [];
    chatLoadedFromSupabase = false;
    renderChatHistory();
    return;
  }

  if (!onlineFriendMessages.isConfigured) {
    activeOnlineChatMessages = [];
    chatLoadedFromSupabase = false;
    renderChatHistory();
    return;
  }

  chatHistory.innerHTML = '<p class="empty-leaderboard">Loading safe messages...</p>';

  try {
    const messages = await onlineFriendMessages.loadMessages(chatId);

    if (chatId !== getChatId(selectedChatFriendCode)) {
      return;
    }

    activeOnlineChatMessages = messages;
    chatLoadedFromSupabase = true;
    cacheFriendGameStateFromMessages(messages);
    renderChatHistory();
  } catch (error) {
    console.error("Supabase friend chat load error:", error);
    activeOnlineChatMessages = [];
    chatLoadedFromSupabase = false;
    chatMessage.textContent = "Online chat could not load right now. Showing saved messages from this app.";
    renderChatHistory();
  }
}

function hasUnsafeChatContent(messageText) {
  const lowerMessage = messageText.toLowerCase();
  const hasLink = /https?:\/\/|www\.|\.com|\.net|\.org|\.io|\.gg|\.co\b/.test(lowerMessage);
  const hasEmail = /[^\s@]+@[^\s@]+\.[^\s@]+/.test(lowerMessage);
  const hasPhone = /(?:\d[\s().-]?){7,}/.test(lowerMessage);
  const hasBlockedWord = blockedChatWords.some((word) => lowerMessage.includes(word));
  return hasLink || hasEmail || hasPhone || hasBlockedWord;
}

function validateChatMessage(messageText) {
  const safeMessage = messageText.trim();

  if (!safeMessage) {
    return { ok: false, message: "Please write a message first." };
  }

  if (safeMessage.length > 150 || hasUnsafeChatContent(safeMessage)) {
    return { ok: false, message: "Please keep messages safe and friendly." };
  }

  return { ok: true, text: safeMessage };
}

function renderQuickChatControls() {
  quickMessageList.innerHTML = "";
  stickerReactionList.innerHTML = "";
  gameInviteList.innerHTML = "";

  quickChatMessages.forEach((messageText) => {
    const button = document.createElement("button");
    button.className = "secondary-button quick-chat-button";
    button.type = "button";
    button.textContent = messageText;
    button.addEventListener("click", () => sendChatMessage(messageText, "quick"));
    quickMessageList.append(button);
  });

  stickerReactions.forEach((sticker) => {
    const button = document.createElement("button");
    button.className = "secondary-button quick-chat-button";
    button.type = "button";
    button.textContent = sticker.text;
    button.addEventListener("click", () => sendChatMessage(sticker.text, "sticker", sticker.label));
    stickerReactionList.append(button);
  });

  safeGameInvites.forEach((messageText) => {
    const button = document.createElement("button");
    button.className = "secondary-button quick-chat-button";
    button.type = "button";
    button.textContent = messageText;
    button.addEventListener("click", () => sendChatMessage(messageText, "game_invite"));
    gameInviteList.append(button);
  });
}

function renderChatFriends() {
  chatFriendList.innerHTML = "";

  if (!activePlayer) {
    return;
  }

  const friendCodes = Array.isArray(activePlayer.friends) ? activePlayer.friends : [];
  const availableFriends = friendCodes.filter((friendCode) => !isFriendBlocked(friendCode));

  if (availableFriends.length === 0) {
    chatFriendList.innerHTML = '<p class="empty-leaderboard">No friends available to chat. Add a friend code first.</p>';
    return;
  }

  availableFriends.forEach((friendCode) => {
    const friendProfile = getFriendProfileSnapshot(friendCode);
    const row = document.createElement("article");
    row.className = normalizeFriendCode(selectedChatFriendCode) === normalizeFriendCode(friendCode) ? "friend-entry selected-friend" : "friend-entry";

    const avatar = document.createElement("div");
    renderAvatar(avatar, friendProfile?.avatar || null);

    const details = document.createElement("div");
    details.className = "friend-details";
    const name = document.createElement("h3");
    name.textContent = friendProfile.nickname;
    const code = document.createElement("p");
    code.textContent = friendCode;
    details.append(name, code, makeFriendPresenceBadge(friendProfile));

    const chooseButton = document.createElement("button");
    chooseButton.className = "secondary-button";
    chooseButton.type = "button";
    chooseButton.textContent = "Choose Chat";
    chooseButton.addEventListener("click", () => {
      selectedChatFriendCode = normalizeFriendCode(friendCode);
      chatMessage.textContent = "";
      chatQuizMessage.textContent = "";
      chatQuizPanel.classList.add("hidden");
      updateChatControls();
      renderChatFriends();
    });

    row.append(avatar, details, chooseButton);
    chatFriendList.append(row);
  });
}

function getBoxOfLiesRounds() {
  const savedRounds = localStorage.getItem(boxOfLiesRoundsKey);

  if (!savedRounds) {
    return [];
  }

  try {
    const rounds = JSON.parse(savedRounds);
    return Array.isArray(rounds) ? rounds : [];
  } catch {
    return [];
  }
}

function saveBoxOfLiesRounds(rounds) {
  localStorage.setItem(boxOfLiesRoundsKey, JSON.stringify(rounds.slice(0, 60)));
}

function saveBoxOfLiesRound(round) {
  const rounds = getBoxOfLiesRounds();
  saveBoxOfLiesRounds([
    round,
    ...rounds.filter((savedRound) => savedRound.id !== round.id),
  ]);

  if (round?.gameType === "box_of_lies" && round.fromFriendCode && round.toFriendCode) {
    saveSharedFriendGameState(round).catch((error) => {
      console.error("Box of Lies shared save error:", error);
    });
  }
}

function getBoxOfLiesRound(roundId) {
  return getBoxOfLiesRounds().find((round) => round.id === roundId) || null;
}

function getBoxOfLiesRoundTime(round) {
  return Number.parseInt(round?.updatedAt || round?.completedAt || round?.acceptedAt || round?.declinedAt || round?.createdAt || "0", 10) || 0;
}

function mergeBoxOfLiesRounds(rounds = []) {
  const roundsById = new Map(
    getBoxOfLiesRounds()
      .filter((round) => round?.id)
      .map((round) => [round.id, round]),
  );

  rounds
    .filter((round) => round?.gameType === "box_of_lies" && round.id)
    .forEach((round) => {
      const currentRound = roundsById.get(round.id);

      if (!currentRound || getBoxOfLiesRoundTime(round) >= getBoxOfLiesRoundTime(currentRound)) {
        roundsById.set(round.id, round);
      }
    });

  saveBoxOfLiesRounds([...roundsById.values()].sort((firstRound, secondRound) => getBoxOfLiesRoundTime(secondRound) - getBoxOfLiesRoundTime(firstRound)));
}

function cacheBoxOfLiesRoundsFromMessages(messages = []) {
  const rounds = messages
    .map((message) => message?.gameData?.boxOfLies || null)
    .filter((round) => round?.gameType === "box_of_lies" && round.id);

  if (rounds.length > 0) {
    mergeBoxOfLiesRounds(rounds);
  }
}

function cacheFriendGameStateFromMessages(messages = []) {
  cacheBoxOfLiesRoundsFromMessages(messages);
  cacheTradingTradesFromMessages(messages);
}

function getGameInviteLink(inviteId) {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("gameInvite", inviteId);
  return url.toString();
}

function cacheFriendGameStateFromOnlineRecords(records = []) {
  const boxRounds = records.filter((record) => record?.gameType === "box_of_lies");
  const trades = records.filter((record) => record?.gameType === "trading_game");

  if (boxRounds.length > 0) {
    mergeBoxOfLiesRounds(boxRounds);
  }

  if (trades.length > 0) {
    mergeTradingTrades(trades);
  }
}

async function saveSharedFriendGameState(gameRecord) {
  if (!onlineFriendGames.isConfigured) {
    return false;
  }

  try {
    await onlineFriendGames.saveGame(gameRecord);
    return true;
  } catch (error) {
    console.error("Supabase game save error:", error);
    return false;
  }
}

function getBoxOfLiesDisplayRound(round) {
  if (round?.status === "pending" && Date.now() - (Number.parseInt(round.createdAt || "0", 10) || 0) > boxOfLiesInviteExpiryMs) {
    return {
      ...round,
      status: "expired",
    };
  }

  return round;
}

function getBoxOfLiesRoundMessages(messages = getActiveChatMessages()) {
  return messages
    .map((message) => ({
      message,
      round: message?.gameData?.boxOfLies || null,
    }))
    .filter((entry) => entry.round?.gameType === "box_of_lies" && entry.round.id);
}

function getLatestBoxOfLiesRound(roundId, messages = getActiveChatMessages()) {
  const candidates = [
    getBoxOfLiesRound(roundId),
    ...getBoxOfLiesRoundMessages(messages)
      .filter((entry) => entry.round.id === roundId)
      .map((entry) => entry.round),
  ].filter(Boolean);

  const latestRound = candidates.sort((firstRound, secondRound) => getBoxOfLiesRoundTime(secondRound) - getBoxOfLiesRoundTime(firstRound))[0] || null;
  return getBoxOfLiesDisplayRound(latestRound);
}

function getLatestBoxOfLiesMessageIds(messages = getActiveChatMessages()) {
  const latestByRound = new Map();

  getBoxOfLiesRoundMessages(messages).forEach((entry) => {
    const current = latestByRound.get(entry.round.id);
    if (!current || getBoxOfLiesRoundTime(entry.round) >= getBoxOfLiesRoundTime(current.round)) {
      latestByRound.set(entry.round.id, entry);
    }
  });

  return new Set([...latestByRound.values()].map((entry) => entry.message.id));
}

function isActiveBoxOfLiesStatus(status) {
  return ["pending", "accepted", "in_progress"].includes(status);
}

function getBoxOfLiesPairCodes(round) {
  return [round?.fromFriendCode || "", round?.toFriendCode || ""].map(normalizeFriendCode).filter(Boolean);
}

function isBoxOfLiesRoundForFriendPair(round, friendCode) {
  const ownerCode = normalizeFriendCode(activePlayer?.friendCode || "");
  const friendPairCode = normalizeFriendCode(friendCode);
  const pairCodes = getBoxOfLiesPairCodes(round);
  return Boolean(ownerCode && friendPairCode && pairCodes.includes(ownerCode) && pairCodes.includes(friendPairCode));
}

function isBoxOfLiesInviter(round) {
  return normalizeFriendCode(activePlayer?.friendCode || "") === normalizeFriendCode(round?.fromFriendCode || "");
}

function isBoxOfLiesInvitedFriend(round) {
  return normalizeFriendCode(activePlayer?.friendCode || "") === normalizeFriendCode(round?.toFriendCode || "");
}

function makeBoxOfLiesStatusRound(round, status, extraFields = {}) {
  return {
    ...round,
    ...extraFields,
    status,
    updatedAt: Date.now(),
  };
}

function createBoxOfLiesOptions(secretItem) {
  const lieItems = shuffleArray(boxOfLiesItems.filter((item) => item.text !== secretItem.text)).slice(0, 2);
  return shuffleArray([
    { text: `${secretItem.emoji} ${secretItem.text}`, isTruth: true },
    ...lieItems.map((item) => ({ text: `${item.emoji} ${item.text}`, isTruth: false })),
  ]);
}

function makeBoxOfLiesRound(friendCode) {
  const friendProfile = getFriendProfileSnapshot(friendCode);
  const roundId = crypto.randomUUID();

  return {
    id: roundId,
    gameType: "box_of_lies",
    inviteLink: getGameInviteLink(roundId),
    fromFriendCode: normalizeFriendCode(activePlayer.friendCode),
    fromNickname: activePlayer.nickname,
    toFriendCode: normalizeFriendCode(friendProfile.friendCode),
    toNickname: friendProfile.nickname,
    secretItem: "",
    secretEmoji: "▣",
    messageOptions: [],
    selectedMessage: "",
    selectedMessageIsTruth: false,
    guess: "",
    isCorrect: null,
    winnerCode: "",
    winnerNickname: "",
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    acceptedAt: null,
    declinedAt: null,
    completedAt: null,
  };
}

function renderBoxOfLiesHistory() {
  const ownerCode = normalizeFriendCode(activePlayer?.friendCode || "");
  const rounds = getBoxOfLiesRounds()
    .map(getBoxOfLiesDisplayRound)
    .filter((round) => !ownerCode || round.fromFriendCode === ownerCode || round.toFriendCode === ownerCode)
    .slice(0, 6);

  const history = document.createElement("div");
  history.className = "box-history-panel";
  const title = document.createElement("h3");
  title.textContent = "Box of Lies History";
  history.append(title);

  if (rounds.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-leaderboard";
    empty.textContent = "No Box of Lies rounds yet. Send a safe challenge to start.";
    history.append(empty);
    return history;
  }

  rounds.forEach((round) => {
    const item = document.createElement("article");
    item.className = "friend-activity-item";
    const text = document.createElement("p");
    const friendName = round.fromFriendCode === ownerCode ? round.toNickname : round.fromNickname;
    if (round.status === "completed") {
      text.textContent = `${friendName}: ${round.winnerNickname || (round.isCorrect ? round.toNickname : round.fromNickname)} won. The box had ${round.secretEmoji} ${round.secretItem}.`;
    } else if (round.status === "cancelled") {
      text.textContent = `${friendName}: Box invite cancelled.`;
    } else if (round.status === "declined") {
      text.textContent = `${friendName}: Box invite declined.`;
    } else if (round.status === "expired") {
      text.textContent = `${friendName}: Box invite expired.`;
    } else if (round.status === "accepted") {
      text.textContent = `${friendName}: Box invite accepted.`;
    } else if (round.status === "in_progress") {
      text.textContent = `${friendName}: Box round waiting for a Truth or Lie guess.`;
    } else {
      text.textContent = `${friendName}: Box invite pending.`;
    }
    const time = document.createElement("span");
    const createdAt = new Date(round.completedAt || round.createdAt);
    time.textContent = `${createdAt.toLocaleDateString()} ${createdAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    item.append(text, time);
    history.append(item);
  });

  return history;
}

function getActiveBoxOfLiesRoundForFriendFromCache(friendCode) {
  const safeFriendCode = normalizeFriendCode(friendCode);

  return getBoxOfLiesRounds()
    .map(getBoxOfLiesDisplayRound)
    .filter((round) => isBoxOfLiesRoundForFriendPair(round, safeFriendCode) && isActiveBoxOfLiesStatus(round.status))
    .sort((firstRound, secondRound) => getBoxOfLiesRoundTime(secondRound) - getBoxOfLiesRoundTime(firstRound))[0] || null;
}

function renderBoxOfLiesPendingInvites() {
  const ownerCode = normalizeFriendCode(activePlayer?.friendCode || "");
  const pendingRounds = getBoxOfLiesRounds()
    .map(getBoxOfLiesDisplayRound)
    .filter((round) => isActiveBoxOfLiesStatus(round.status) && getBoxOfLiesPairCodes(round).includes(ownerCode))
    .sort((firstRound, secondRound) => getBoxOfLiesRoundTime(secondRound) - getBoxOfLiesRoundTime(firstRound));
  const panel = document.createElement("div");
  panel.className = "box-history-panel";
  const title = document.createElement("h3");
  title.textContent = "Pending Invites";
  panel.append(title);

  if (pendingRounds.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-leaderboard";
    empty.textContent = "No active Box of Lies invites right now.";
    panel.append(empty);
    return panel;
  }

  pendingRounds.forEach((round) => {
    const friendName = round.fromFriendCode === ownerCode ? round.toNickname : round.fromNickname;
    const item = document.createElement("article");
    item.className = "friend-activity-item";
    const text = document.createElement("p");
    text.textContent = `${friendName}: ${round.status === "pending" ? "Pending" : round.status === "accepted" ? "Accepted" : "In progress"}`;
    const actions = document.createElement("div");
    actions.className = "result-actions";
    const openButton = document.createElement("button");
    openButton.className = "secondary-button";
    openButton.type = "button";
    openButton.textContent = "Open Round";
    openButton.addEventListener("click", () => {
      activeBoxOfLiesRound = round;
      renderBoxOfLiesByStatus(round);
    });
    actions.append(openButton);

    if (round.status === "pending" && isBoxOfLiesInviter(round)) {
      const cancelButton = document.createElement("button");
      cancelButton.className = "secondary-button";
      cancelButton.type = "button";
      cancelButton.textContent = "Cancel Invite";
      cancelButton.addEventListener("click", () => cancelBoxOfLiesInvite(round));
      actions.append(cancelButton);
    }

    item.append(text, actions);
    panel.append(item);
  });

  return panel;
}

function renderBoxOfLiesFriendChooser() {
  boxOfLiesContent.innerHTML = "";

  const intro = document.createElement("div");
  intro.className = "box-of-lies-intro";
  intro.innerHTML = `
    <div class="box-secret-visual" aria-hidden="true">▣</div>
    <div>
      <h3>Choose a friend</h3>
      <p>Send a safe invite first. The game starts only after your friend accepts.</p>
    </div>
  `;
  boxOfLiesContent.append(intro);

  const friendCodes = Array.isArray(activePlayer?.friends) ? activePlayer.friends : [];
  const availableFriends = friendCodes.filter((friendCode) => !isFriendBlocked(friendCode));

  if (availableFriends.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-leaderboard";
    empty.textContent = "Add a friend code first, then you can send Box of Lies challenges.";
    boxOfLiesContent.append(empty, renderBoxOfLiesHistory());
    return;
  }

  const list = document.createElement("div");
  list.className = "friends-list box-friend-list";

  availableFriends.forEach((friendCode) => {
    const friendProfile = getFriendProfileSnapshot(friendCode);
    const row = document.createElement("article");
    row.className = "friend-entry";

    const avatar = document.createElement("div");
    renderAvatar(avatar, friendProfile.avatar || null);

    const details = document.createElement("div");
    details.className = "friend-details";
    const name = document.createElement("h3");
    name.textContent = friendProfile.nickname;
    const code = document.createElement("p");
    code.textContent = friendProfile.friendCode;
    details.append(name, code, makeFriendPresenceBadge(friendProfile));

    const actions = document.createElement("div");
    actions.className = "result-actions";
    const activeRound = getActiveBoxOfLiesRoundForFriendFromCache(friendProfile.friendCode);

    if (activeRound) {
      const statusLabel = document.createElement("button");
      statusLabel.className = "purchased-label";
      statusLabel.type = "button";
      statusLabel.textContent = activeRound.status === "pending" ? "Pending" : activeRound.status === "accepted" ? "Accepted" : "In Progress";
      statusLabel.disabled = true;
      const openButton = document.createElement("button");
      openButton.className = "secondary-button";
      openButton.type = "button";
      openButton.textContent = "Open Round";
      openButton.addEventListener("click", () => {
        activeBoxOfLiesRound = activeRound;
        renderBoxOfLiesByStatus(activeRound);
      });
      actions.append(statusLabel, openButton);

      if (activeRound.status === "pending" && isBoxOfLiesInviter(activeRound)) {
        const cancelButton = document.createElement("button");
        cancelButton.className = "secondary-button";
        cancelButton.type = "button";
        cancelButton.textContent = "Cancel Invite";
        cancelButton.addEventListener("click", () => cancelBoxOfLiesInvite(activeRound));
        actions.append(cancelButton);
      }
    } else {
      const startButton = document.createElement("button");
      startButton.className = "save-quiz-button";
      startButton.type = "button";
      startButton.textContent = "Invite";
      startButton.addEventListener("click", () => startBoxOfLiesForFriend(friendProfile.friendCode));
      actions.append(startButton);
    }

    row.append(avatar, details, actions);
    list.append(row);
  });

  boxOfLiesContent.append(list, renderBoxOfLiesPendingInvites(), renderBoxOfLiesHistory());
}

function showBoxOfLies(friendCode = "") {
  if (!activePlayer) {
    showPlayerGate();
    return;
  }

  hideMainSections();
  updateProfileBar();
  activeBoxOfLiesRound = null;
  boxOfLiesMessage.textContent = "";
  boxOfLiesCard.classList.remove("hidden");

  if (friendCode && isApprovedFriendCode(friendCode)) {
    startBoxOfLiesForFriend(friendCode);
    return;
  }

  renderBoxOfLiesFriendChooser();
  syncFriendGameStateFromOnline().then(() => {
    if (!boxOfLiesCard.classList.contains("hidden") && !activeBoxOfLiesRound) {
      renderBoxOfLiesFriendChooser();
    }
  }).catch((error) => console.error("Box of Lies refresh sync error:", error));
}

async function findActiveBoxOfLiesRoundForFriend(friendCode) {
  const safeFriendCode = normalizeFriendCode(friendCode);
  let messages = getChatMessages().filter((message) => message.chatId === getChatId(safeFriendCode));

  if (onlineFriendGames.isConfigured) {
    try {
      const records = await onlineFriendGames.loadGamesForPlayer(activePlayer.friendCode);
      cacheFriendGameStateFromOnlineRecords(records);
    } catch (error) {
      console.error("Box of Lies active game lookup error:", error);
    }
  }

  if (onlineFriendMessages.isConfigured) {
    try {
      messages = await onlineFriendMessages.loadMessages(getChatId(safeFriendCode));
    } catch (error) {
      console.error("Box of Lies active invite lookup error:", error);
    }
  }

  cacheFriendGameStateFromMessages(messages);
  const localRounds = getBoxOfLiesRounds();

  return [
    ...localRounds,
    ...getBoxOfLiesRoundMessages(messages).map((entry) => entry.round),
  ]
    .map(getBoxOfLiesDisplayRound)
    .filter((round) => isBoxOfLiesRoundForFriendPair(round, safeFriendCode) && isActiveBoxOfLiesStatus(round.status))
    .sort((firstRound, secondRound) => getBoxOfLiesRoundTime(secondRound) - getBoxOfLiesRoundTime(firstRound))[0] || null;
}

async function startBoxOfLiesForFriend(friendCode) {
  const safeFriendCode = normalizeFriendCode(friendCode);

  if (!isApprovedFriendCode(safeFriendCode)) {
    boxOfLiesMessage.textContent = "Choose an added friend first.";
    renderBoxOfLiesFriendChooser();
    return;
  }

  boxOfLiesMessage.textContent = "Checking Box of Lies invites...";
  const activeRound = await findActiveBoxOfLiesRoundForFriend(safeFriendCode);

  if (activeRound) {
    activeBoxOfLiesRound = activeRound;
    boxOfLiesMessage.textContent = "There is already an active Box of Lies invite with this friend.";
    renderBoxOfLiesByStatus(activeRound);
    return;
  }

  activeBoxOfLiesRound = makeBoxOfLiesRound(safeFriendCode);
  renderBoxOfLiesInvitePreview(activeBoxOfLiesRound);
}

function renderBoxOfLiesByStatus(round) {
  const latestRound = getLatestBoxOfLiesRound(round.id) || round;

  if (latestRound.status === "pending") {
    if (isBoxOfLiesInvitedFriend(latestRound)) {
      renderBoxOfLiesInviteReview(latestRound);
    } else {
      renderBoxOfLiesSent(latestRound);
    }
    return;
  }

  if (latestRound.status === "declined") {
    renderBoxOfLiesDeclined(latestRound);
    return;
  }

  if (latestRound.status === "cancelled") {
    renderBoxOfLiesCancelled(latestRound);
    return;
  }

  if (latestRound.status === "expired") {
    renderBoxOfLiesExpired(latestRound);
    return;
  }

  if (latestRound.status === "accepted") {
    renderBoxOfLiesRules(latestRound);
    return;
  }

  if (latestRound.status === "in_progress") {
    if (isBoxOfLiesInvitedFriend(latestRound)) {
      renderBoxOfLiesGuess(latestRound);
    } else {
      renderBoxOfLiesWaitingForGuess(latestRound);
    }
    return;
  }

  renderBoxOfLiesResult(latestRound);
}

function renderBoxOfLiesInvitePreview(round) {
  const friendProfile = getFriendProfileSnapshot(round.toFriendCode);
  boxOfLiesContent.innerHTML = "";
  boxOfLiesMessage.textContent = isFriendOnline(friendProfile)
    ? `${friendProfile.nickname} looks online.`
    : "Your friend is offline. They can play when they come back.";

  const preview = document.createElement("div");
  preview.className = "box-secret-panel";
  const icon = document.createElement("div");
  icon.className = "box-secret-visual";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "💌";
  const details = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Box of Lies Invite";
  const title = document.createElement("h3");
  title.textContent = `Invite ${friendProfile.nickname}?`;
  const body = document.createElement("p");
  body.textContent = "The round will stay pending until your friend accepts.";
  details.append(eyebrow, title, body, makeFriendPresenceBadge(friendProfile));
  preview.append(icon, details);

  const actions = document.createElement("div");
  actions.className = "result-actions";
  const sendButton = document.createElement("button");
  sendButton.className = "save-quiz-button";
  sendButton.type = "button";
  sendButton.textContent = "Invite to Box of Lies";
  sendButton.addEventListener("click", () => sendBoxOfLiesInvite(round));
  const backButton = document.createElement("button");
  backButton.className = "secondary-button";
  backButton.type = "button";
  backButton.textContent = "Choose Another Friend";
  backButton.addEventListener("click", renderBoxOfLiesFriendChooser);
  actions.append(sendButton, backButton);

  boxOfLiesContent.append(preview, actions, renderBoxOfLiesHistory());
}

async function saveBoxOfLiesRoundMessage(round, receiverCode, messageText) {
  const onlineGameSaved = await saveSharedFriendGameState(round);
  const result = await saveFriendMessage(
    receiverCode,
    messageText.slice(0, 150),
    "box_of_lies_invite",
    "",
    { gameData: { boxOfLies: round, gameInviteId: round.id, gameInviteLink: round.inviteLink || getGameInviteLink(round.id) } },
  );
  saveBoxOfLiesRound(round);
  return { ...result, onlineGameSaved };
}

async function sendBoxOfLiesInvite(round) {
  const pendingRound = makeBoxOfLiesStatusRound(round, "pending");
  activeBoxOfLiesRound = pendingRound;
  boxOfLiesMessage.textContent = `Sending Box of Lies invite to ${pendingRound.toNickname}...`;

  try {
    const result = await saveBoxOfLiesRoundMessage(
      pendingRound,
      pendingRound.toFriendCode,
      `${pendingRound.fromNickname} invited you to play Box of Lies!`,
    );
    const earnedStar = awardFriendActionStars(`box-invite:${pendingRound.toFriendCode}`, 1);

    addFriendActivity({
      type: "box_invite_sent",
      friendCode: pendingRound.toFriendCode,
      friendNickname: pendingRound.toNickname,
      text: `You invited ${pendingRound.toNickname} to play Box of Lies.`,
    });

    boxOfLiesMessage.textContent = result.online
      ? `Invite sent! You can invite another friend or keep playing.${earnedStar ? " You earned 1 star." : ""}`
      : `Invite saved here. You can invite another friend or keep playing.${earnedStar ? " You earned 1 star." : ""}`;
    renderBoxOfLiesSent(pendingRound);
  } catch (error) {
    console.error("Box of Lies invite error:", error);
    boxOfLiesMessage.textContent = "Box of Lies invite could not be sent yet. Please try again.";
  }
}

function prepareBoxOfLiesGameplay(round) {
  if (round.secretItem && Array.isArray(round.messageOptions) && round.messageOptions.length === 3) {
    return round;
  }

  const secretItem = shuffleArray(boxOfLiesItems)[0];
  return {
    ...round,
    secretItem: secretItem.text,
    secretEmoji: secretItem.emoji,
    messageOptions: createBoxOfLiesOptions(secretItem),
    updatedAt: Date.now(),
  };
}

function renderBoxOfLiesStoryteller(round) {
  const preparedRound = prepareBoxOfLiesGameplay(round);
  activeBoxOfLiesRound = preparedRound;
  saveBoxOfLiesRound(preparedRound);
  round = preparedRound;
  boxOfLiesContent.innerHTML = "";
  boxOfLiesMessage.textContent = "";

  const secret = document.createElement("div");
  secret.className = "box-secret-panel";
  const secretIcon = document.createElement("div");
  secretIcon.className = "box-secret-visual";
  secretIcon.setAttribute("aria-hidden", "true");
  secretIcon.textContent = round.secretEmoji;
  const secretDetails = document.createElement("div");
  const secretEyebrow = document.createElement("p");
  secretEyebrow.className = "eyebrow";
  secretEyebrow.textContent = "Secret box item";
  const secretTitle = document.createElement("h3");
  secretTitle.textContent = round.secretItem;
  const secretText = document.createElement("p");
  secretText.textContent = `Pick one preset message to send to ${round.toNickname}. They will guess Truth or Lie.`;
  secretDetails.append(secretEyebrow, secretTitle, secretText);
  secret.append(secretIcon, secretDetails);

  const options = document.createElement("div");
  options.className = "box-message-options";

  round.messageOptions.forEach((option) => {
    const button = document.createElement("button");
    button.className = option.isTruth ? "choice-card box-option truth-option" : "choice-card box-option";
    button.type = "button";
    const title = document.createElement("span");
    title.className = "choice-title";
    title.textContent = option.isTruth ? "Truth message" : "Lie message";
    const description = document.createElement("span");
    description.className = "choice-description";
    description.textContent = option.text;
    button.append(title, description);
    button.addEventListener("click", () => sendBoxOfLiesChallenge(round, option));
    options.append(button);
  });

  const backButton = document.createElement("button");
  backButton.className = "secondary-button";
  backButton.type = "button";
  backButton.textContent = "Choose Another Friend";
  backButton.addEventListener("click", renderBoxOfLiesFriendChooser);

  boxOfLiesContent.append(secret, options, backButton);
}

async function sendBoxOfLiesChallenge(round, option) {
  const updatedRound = {
    ...round,
    selectedMessage: option.text,
    selectedMessageIsTruth: Boolean(option.isTruth),
    status: "in_progress",
    updatedAt: Date.now(),
  };

  activeBoxOfLiesRound = updatedRound;
  saveBoxOfLiesRound(updatedRound);
  boxOfLiesMessage.textContent = `Sending box message to ${updatedRound.toNickname}...`;

  try {
    const result = await saveBoxOfLiesRoundMessage(
      updatedRound,
      updatedRound.toFriendCode,
      `Box of Lies message: ${updatedRound.selectedMessage}`,
    );

    addFriendActivity({
      type: "box_message_sent",
      friendCode: updatedRound.toFriendCode,
      friendNickname: updatedRound.toNickname,
      text: `You sent ${updatedRound.toNickname} a Box of Lies message.`,
    });

    boxOfLiesMessage.textContent = result.online
      ? `Box message sent to ${updatedRound.toNickname}!`
      : `Box message saved here for ${updatedRound.toNickname}.`;
    renderBoxOfLiesSent(updatedRound);
  } catch (error) {
    console.error("Box of Lies send error:", error);
    boxOfLiesMessage.textContent = "Box message could not be sent yet. Please try again.";
  }
}

function renderBoxOfLiesSent(round) {
  boxOfLiesContent.innerHTML = "";

  const sent = document.createElement("div");
  sent.className = "box-secret-panel";
  const sentIcon = document.createElement("div");
  sentIcon.className = "box-secret-visual";
  sentIcon.setAttribute("aria-hidden", "true");
  sentIcon.textContent = "💌";
  const sentDetails = document.createElement("div");
  const sentEyebrow = document.createElement("p");
  sentEyebrow.className = "eyebrow";
  sentEyebrow.textContent = round.status === "pending" ? "Invite Sent" : "Box Message Sent";
  const sentTitle = document.createElement("h3");
  sentTitle.textContent = round.status === "pending"
    ? `${round.toNickname} can accept or decline in Friend Chat.`
    : `${round.toNickname} can guess Truth or Lie in Friend Chat.`;
  const sentText = document.createElement("p");
  sentText.textContent = round.selectedMessage
    ? `Message sent: “${round.selectedMessage}”`
    : "The game will not start until your friend accepts.";
  sentDetails.append(sentEyebrow, sentTitle, sentText);
  sent.append(sentIcon, sentDetails);

  const actions = document.createElement("div");
  actions.className = "result-actions";
  const anotherButton = document.createElement("button");
  anotherButton.className = "save-quiz-button";
  anotherButton.type = "button";
  anotherButton.textContent = "Back to Friends";
  anotherButton.addEventListener("click", renderBoxOfLiesFriendChooser);
  const chatButton = document.createElement("button");
  chatButton.className = "secondary-button";
  chatButton.type = "button";
  chatButton.textContent = "Open Chat";
  chatButton.addEventListener("click", () => showChat(round.toFriendCode));
  const copyLinkButton = document.createElement("button");
  copyLinkButton.className = "secondary-button";
  copyLinkButton.type = "button";
  copyLinkButton.textContent = "Copy Game Link";
  copyLinkButton.addEventListener("click", async () => {
    const link = round.inviteLink || getGameInviteLink(round.id);

    try {
      await navigator.clipboard.writeText(link);
      boxOfLiesMessage.textContent = "Box of Lies game link copied.";
    } catch {
      boxOfLiesMessage.textContent = `Box of Lies game link: ${link}`;
    }
  });
  actions.append(anotherButton, chatButton, copyLinkButton);

  if (round.status === "pending" && isBoxOfLiesInviter(round)) {
    const cancelButton = document.createElement("button");
    cancelButton.className = "secondary-button";
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel Invite";
    cancelButton.addEventListener("click", () => cancelBoxOfLiesInvite(round));
    actions.append(cancelButton);
  }

  boxOfLiesContent.append(sent, actions, renderBoxOfLiesHistory());
}

function getBoxOfLiesRoundFromMessage(message) {
  const messageRound = message?.gameData?.boxOfLies || null;
  const round = getLatestBoxOfLiesRound(messageRound?.id || message?.gameData?.boxOfLiesRoundId || "") || messageRound;

  if (!round || round.gameType !== "box_of_lies") {
    return null;
  }

  return round;
}

async function openBoxOfLiesInvite(message) {
  let round = getBoxOfLiesRoundFromMessage(message);
  const inviteId = round?.id || message?.gameData?.gameInviteId || "";

  if (inviteId && onlineFriendGames.isConfigured) {
    try {
      const onlineRound = await onlineFriendGames.loadGame(inviteId);
      if (onlineRound?.gameType === "box_of_lies") {
        mergeBoxOfLiesRounds([onlineRound]);
        round = onlineRound;
      }
    } catch (error) {
      console.error("Box of Lies online invite load error:", error);
    }
  }

  if (!round) {
    chatMessage.textContent = "This Box of Lies challenge could not be opened. Please ask your friend to send it again.";
    return;
  }

  hideMainSections();
  updateProfileBar();
  boxOfLiesCard.classList.remove("hidden");
  boxOfLiesMessage.textContent = "";
  renderBoxOfLiesByStatus(round);
}

function renderBoxOfLiesInviteReview(round) {
  boxOfLiesContent.innerHTML = "";

  const invite = document.createElement("div");
  invite.className = "box-secret-panel";
  const icon = document.createElement("div");
  icon.className = "box-secret-visual";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "💌";
  const details = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Incoming Invite";
  const title = document.createElement("h3");
  title.textContent = `${round.fromNickname} invited you to play Box of Lies!`;
  const body = document.createElement("p");
  body.textContent = "Accept to see the rules. The secret item stays hidden until after your guess.";
  details.append(eyebrow, title, body);
  invite.append(icon, details);

  const actions = document.createElement("div");
  actions.className = "result-actions";
  const acceptButton = document.createElement("button");
  acceptButton.className = "save-quiz-button";
  acceptButton.type = "button";
  acceptButton.textContent = "Accept";
  acceptButton.addEventListener("click", () => acceptBoxOfLiesInvite(round));
  const declineButton = document.createElement("button");
  declineButton.className = "secondary-button";
  declineButton.type = "button";
  declineButton.textContent = "Decline";
  declineButton.addEventListener("click", () => declineBoxOfLiesInvite(round));
  actions.append(acceptButton, declineButton);

  boxOfLiesContent.append(invite, actions);
}

async function cancelBoxOfLiesInvite(round) {
  if (!isBoxOfLiesInviter(round) || round.status !== "pending") {
    boxOfLiesMessage.textContent = "Only a pending invite you sent can be cancelled.";
    return;
  }

  const shouldCancel = confirm("Cancel this Box of Lies invite?");

  if (!shouldCancel) {
    return;
  }

  const cancelledRound = makeBoxOfLiesStatusRound(round, "cancelled", { cancelledAt: Date.now() });
  activeBoxOfLiesRound = null;
  boxOfLiesMessage.textContent = "Cancelling invite...";

  try {
    await saveBoxOfLiesRoundMessage(
      cancelledRound,
      cancelledRound.toFriendCode,
      `${activePlayer.nickname} cancelled the Box of Lies invite.`,
    );
    addFriendActivity({
      type: "box_invite_cancelled",
      friendCode: cancelledRound.toFriendCode,
      friendNickname: cancelledRound.toNickname,
      text: `You cancelled the Box of Lies invite for ${cancelledRound.toNickname}.`,
    });
    boxOfLiesMessage.textContent = "Invite cancelled. You can invite this friend again.";
    renderBoxOfLiesFriendChooser();
  } catch (error) {
    console.error("Box of Lies cancel error:", error);
    boxOfLiesMessage.textContent = "Could not cancel this invite yet. Please try again.";
  }
}

async function acceptBoxOfLiesInvite(round) {
  const acceptedRound = makeBoxOfLiesStatusRound(round, "accepted", { acceptedAt: Date.now() });
  activeBoxOfLiesRound = acceptedRound;
  boxOfLiesMessage.textContent = "Accepting Box of Lies invite...";

  try {
    await saveBoxOfLiesRoundMessage(
      acceptedRound,
      acceptedRound.fromFriendCode,
      `${activePlayer.nickname} accepted your Box of Lies invite!`,
    );
    addFriendActivity({
      type: "box_invite_accepted",
      friendCode: acceptedRound.fromFriendCode,
      friendNickname: acceptedRound.fromNickname,
      text: `You accepted ${acceptedRound.fromNickname}'s Box of Lies invite.`,
    });
    boxOfLiesMessage.textContent = "Invite accepted. Read the rules before the round starts.";
    hideMainSections();
    updateProfileBar();
    boxOfLiesCard.classList.remove("hidden");
    renderBoxOfLiesRules(acceptedRound);
  } catch (error) {
    console.error("Box of Lies accept error:", error);
    boxOfLiesMessage.textContent = "Could not accept this invite yet. Please try again.";
  }
}

async function declineBoxOfLiesInvite(round) {
  const declinedRound = makeBoxOfLiesStatusRound(round, "declined", { declinedAt: Date.now() });
  activeBoxOfLiesRound = declinedRound;
  boxOfLiesMessage.textContent = "Declining Box of Lies invite...";

  try {
    await saveBoxOfLiesRoundMessage(
      declinedRound,
      declinedRound.fromFriendCode,
      `${activePlayer.nickname} declined your Box of Lies invite.`,
    );
    addFriendActivity({
      type: "box_invite_declined",
      friendCode: declinedRound.fromFriendCode,
      friendNickname: declinedRound.fromNickname,
      text: `You declined ${declinedRound.fromNickname}'s Box of Lies invite.`,
    });
    boxOfLiesMessage.textContent = "Invite declined.";
    hideMainSections();
    updateProfileBar();
    boxOfLiesCard.classList.remove("hidden");
    renderBoxOfLiesDeclined(declinedRound);
  } catch (error) {
    console.error("Box of Lies decline error:", error);
    boxOfLiesMessage.textContent = "Could not decline this invite yet. Please try again.";
  }
}

function renderBoxOfLiesDeclined(round) {
  boxOfLiesContent.innerHTML = "";
  const declined = document.createElement("div");
  declined.className = "box-secret-panel";
  const icon = document.createElement("div");
  icon.className = "box-secret-visual";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "✕";
  const details = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Invite Declined";
  const title = document.createElement("h3");
  title.textContent = isBoxOfLiesInviter(round)
    ? `${round.toNickname} declined the Box of Lies invite.`
    : "You declined this Box of Lies invite.";
  const body = document.createElement("p");
  body.textContent = "No problem. You can send or accept another safe game later.";
  details.append(eyebrow, title, body);
  declined.append(icon, details);
  boxOfLiesContent.append(declined, renderBoxOfLiesHistory());
}

function renderBoxOfLiesCancelled(round) {
  boxOfLiesContent.innerHTML = "";
  const cancelled = document.createElement("div");
  cancelled.className = "box-secret-panel";
  const icon = document.createElement("div");
  icon.className = "box-secret-visual";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "✕";
  const details = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Invite Cancelled";
  const title = document.createElement("h3");
  title.textContent = isBoxOfLiesInviter(round)
    ? `You cancelled the invite for ${round.toNickname}.`
    : `${round.fromNickname} cancelled this Box of Lies invite.`;
  const body = document.createElement("p");
  body.textContent = "This invite will not block a new Box of Lies round.";
  details.append(eyebrow, title, body);
  cancelled.append(icon, details);

  const actions = document.createElement("div");
  actions.className = "result-actions";
  const friendsButton = document.createElement("button");
  friendsButton.className = "save-quiz-button";
  friendsButton.type = "button";
  friendsButton.textContent = "Back to Friends";
  friendsButton.addEventListener("click", renderBoxOfLiesFriendChooser);
  actions.append(friendsButton);

  boxOfLiesContent.append(cancelled, actions, renderBoxOfLiesHistory());
}

function renderBoxOfLiesExpired(round) {
  boxOfLiesContent.innerHTML = "";
  const expired = document.createElement("div");
  expired.className = "box-secret-panel";
  const icon = document.createElement("div");
  icon.className = "box-secret-visual";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "⌛";
  const details = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Invite Expired";
  const title = document.createElement("h3");
  title.textContent = "This Box of Lies invite is too old.";
  const body = document.createElement("p");
  body.textContent = "Send a new invite if you still want to play.";
  details.append(eyebrow, title, body);
  expired.append(icon, details);
  boxOfLiesContent.append(expired, renderBoxOfLiesHistory());
}

function renderBoxOfLiesRules(round) {
  boxOfLiesContent.innerHTML = "";

  const rules = document.createElement("div");
  rules.className = "box-rules-panel";
  const title = document.createElement("h3");
  title.textContent = "Box of Lies Rules";
  const list = document.createElement("ol");
  [
    "One player gets a secret item hidden inside a mystery box.",
    "That player chooses a message about the item.",
    "The message might be true, or it might be a lie.",
    "The other player must guess: Truth or Lie.",
    "After the guess, the box opens and reveals the real item.",
    "If the guesser is correct, they win the round.",
    "If the guesser is wrong, the storyteller wins the round.",
    "No typing is needed. Everything uses safe preset choices.",
  ].forEach((ruleText) => {
    const item = document.createElement("li");
    item.textContent = ruleText;
    list.append(item);
  });
  const note = document.createElement("p");
  note.className = "safety-note";
  note.textContent = "Box of Lies uses preset messages only. No voice, video, or open chat.";
  rules.append(title, list, note);

  const actions = document.createElement("div");
  actions.className = "result-actions";
  const gotItButton = document.createElement("button");
  gotItButton.className = isBoxOfLiesInviter(round) ? "secondary-button" : "save-quiz-button";
  gotItButton.type = "button";
  gotItButton.textContent = "Got it";
  gotItButton.addEventListener("click", () => {
    if (!isBoxOfLiesInviter(round)) {
      renderBoxOfLiesWaitingForStoryteller(round);
      return;
    }

    boxOfLiesMessage.textContent = "Great. Press Start Game when you are ready.";
  });
  actions.append(gotItButton);

  if (isBoxOfLiesInviter(round)) {
    const startButton = document.createElement("button");
    startButton.className = "save-quiz-button";
    startButton.type = "button";
    startButton.textContent = "Start Game";
    startButton.addEventListener("click", () => {
      renderBoxOfLiesStoryteller(round);
    });
    actions.append(startButton);
  }

  boxOfLiesContent.append(rules, actions);
}

function renderBoxOfLiesWaitingForStoryteller(round) {
  boxOfLiesContent.innerHTML = "";

  const waiting = document.createElement("div");
  waiting.className = "box-secret-panel";
  const icon = document.createElement("div");
  icon.className = "box-secret-visual";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "💌";
  const details = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Waiting for Storyteller";
  const title = document.createElement("h3");
  title.textContent = `${round.fromNickname} will choose the box message.`;
  const message = document.createElement("p");
  message.textContent = "You accepted the invite. The secret item stays hidden until after your guess.";
  details.append(eyebrow, title, message);
  waiting.append(icon, details);

  const actions = document.createElement("div");
  actions.className = "result-actions";
  const chatButton = document.createElement("button");
  chatButton.className = "save-quiz-button";
  chatButton.type = "button";
  chatButton.textContent = "Back to Chat";
  chatButton.addEventListener("click", () => showChat(round.fromFriendCode));
  actions.append(chatButton);

  boxOfLiesContent.append(waiting, actions);
}

function renderBoxOfLiesWaitingForGuess(round) {
  boxOfLiesContent.innerHTML = "";

  const waiting = document.createElement("div");
  waiting.className = "box-secret-panel";
  const icon = document.createElement("div");
  icon.className = "box-secret-visual";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "▣";
  const details = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Message Sent";
  const title = document.createElement("h3");
  title.textContent = `${round.toNickname} is guessing Truth or Lie.`;
  const message = document.createElement("p");
  message.textContent = "The box will reveal after your friend guesses.";
  details.append(eyebrow, title, message);
  waiting.append(icon, details);

  const actions = document.createElement("div");
  actions.className = "result-actions";
  const chatButton = document.createElement("button");
  chatButton.className = "save-quiz-button";
  chatButton.type = "button";
  chatButton.textContent = "Back to Chat";
  chatButton.addEventListener("click", () => showChat(round.toFriendCode));
  actions.append(chatButton);

  boxOfLiesContent.append(waiting, actions);
}

function renderBoxOfLiesGuess(round) {
  boxOfLiesContent.innerHTML = "";

  const prompt = document.createElement("div");
  prompt.className = "box-secret-panel";
  const promptIcon = document.createElement("div");
  promptIcon.className = "box-secret-visual";
  promptIcon.setAttribute("aria-hidden", "true");
  promptIcon.textContent = "▣";
  const promptDetails = document.createElement("div");
  const promptEyebrow = document.createElement("p");
  promptEyebrow.className = "eyebrow";
  promptEyebrow.textContent = "Box of Lies";
  const promptTitle = document.createElement("h3");
  promptTitle.textContent = `${round.fromNickname} sent you a box message.`;
  const promptText = document.createElement("p");
  promptText.textContent = `“${round.selectedMessage}”`;
  promptDetails.append(promptEyebrow, promptTitle, promptText);
  prompt.append(promptIcon, promptDetails);

  const choices = document.createElement("div");
  choices.className = "box-guess-actions";
  ["Truth", "Lie"].forEach((guess) => {
    const button = document.createElement("button");
    button.className = guess === "Truth" ? "save-quiz-button" : "secondary-button";
    button.type = "button";
    button.textContent = guess;
    button.addEventListener("click", () => guessBoxOfLies(round, guess.toLowerCase()));
    choices.append(button);
  });

  boxOfLiesContent.append(prompt, choices);
}

async function guessBoxOfLies(round, guess) {
  const correctGuess = round.selectedMessageIsTruth ? "truth" : "lie";
  const isCorrect = guess === correctGuess;
  const completedRound = {
    ...round,
    guess,
    isCorrect,
    winnerCode: isCorrect ? round.toFriendCode : round.fromFriendCode,
    winnerNickname: isCorrect ? round.toNickname : round.fromNickname,
    status: "completed",
    updatedAt: Date.now(),
    completedAt: Date.now(),
  };

  activeBoxOfLiesRound = completedRound;
  saveBoxOfLiesRound(completedRound);
  const completionStar = awardFriendActionStars(`box-complete:${completedRound.id}`, 2);

  addFriendActivity({
    type: completedRound.isCorrect ? "box_correct" : "box_played",
    friendCode: completedRound.fromFriendCode,
    friendNickname: completedRound.fromNickname,
    text: completedRound.isCorrect
      ? `${completedRound.fromNickname} guessed your Box of Lies correctly.`
      : `${completedRound.fromNickname} played your Box of Lies game.`,
  });

  try {
    await saveBoxOfLiesRoundMessage(
      completedRound,
      completedRound.fromFriendCode,
      `${activePlayer.nickname} guessed ${guess} in Box of Lies.`,
    );
  } catch (error) {
    console.error("Box of Lies result sync error:", error);
  }

  const earned = (completionStar ? 2 : 0);
  boxOfLiesMessage.textContent = earned > 0 ? `You earned ${earned} stars for completing the round!` : "";
  renderBoxOfLiesResult(completedRound);
}

function renderBoxOfLiesResult(round) {
  saveBoxOfLiesRound(round);
  boxOfLiesContent.innerHTML = "";
  const title = round.isCorrect
    ? (round.selectedMessageIsTruth ? "Truth detective!" : "You caught the lie!")
    : (round.selectedMessageIsTruth ? "You called truth a lie!" : "You believed the story!");
  const winnerStars = normalizeFriendCode(activePlayer?.friendCode || "") === normalizeFriendCode(round.winnerCode || "")
    ? awardFriendActionStars(`box-winner:${round.id}`, 2)
    : false;
  const resultText = `${round.winnerNickname || (round.isCorrect ? round.toNickname : round.fromNickname)} won this round.`;

  if (winnerStars) {
    boxOfLiesMessage.textContent = boxOfLiesMessage.textContent
      ? `${boxOfLiesMessage.textContent} You also earned 2 winner stars.`
      : "You earned 2 winner stars!";
  }

  const result = document.createElement("div");
  result.className = "box-secret-panel";
  const resultIcon = document.createElement("div");
  resultIcon.className = "box-secret-visual";
  resultIcon.setAttribute("aria-hidden", "true");
  resultIcon.textContent = round.secretEmoji;
  const resultDetails = document.createElement("div");
  const resultEyebrow = document.createElement("p");
  resultEyebrow.className = "eyebrow";
  resultEyebrow.textContent = "Reveal";
  const resultTitle = document.createElement("h3");
  resultTitle.textContent = title;
  const itemText = document.createElement("p");
  itemText.textContent = `The secret item was ${round.secretEmoji} ${round.secretItem}.`;
  const outcomeText = document.createElement("p");
  outcomeText.textContent = resultText;
  resultDetails.append(resultEyebrow, resultTitle, itemText, outcomeText);
  result.append(resultIcon, resultDetails);

  const actions = document.createElement("div");
  actions.className = "result-actions";
  const chatButton = document.createElement("button");
  chatButton.className = "save-quiz-button";
  chatButton.type = "button";
  chatButton.textContent = "Back to Chat";
  chatButton.addEventListener("click", () => showChat(round.fromFriendCode === normalizeFriendCode(activePlayer.friendCode) ? round.toFriendCode : round.fromFriendCode));
  const gamesButton = document.createElement("button");
  gamesButton.className = "secondary-button";
  gamesButton.type = "button";
  gamesButton.textContent = "Back to Games";
  gamesButton.addEventListener("click", showGames);
  const copyLinkButton = document.createElement("button");
  copyLinkButton.className = "secondary-button";
  copyLinkButton.type = "button";
  copyLinkButton.textContent = "Copy Game Link";
  copyLinkButton.addEventListener("click", async () => {
    const link = round.inviteLink || getGameInviteLink(round.id);

    try {
      await navigator.clipboard.writeText(link);
      boxOfLiesMessage.textContent = "Box of Lies game link copied.";
    } catch {
      boxOfLiesMessage.textContent = `Box of Lies game link: ${link}`;
    }
  });
  actions.append(chatButton, copyLinkButton, gamesButton);

  boxOfLiesContent.append(result, actions, renderBoxOfLiesHistory());
}

function getTradingItem(itemId) {
  return tradingCollectibles.find((item) => item.itemId === itemId) || {
    itemId,
    emoji: "🎁",
    name: "Mystery Item",
    rarity: "Collectible",
    source: "trade",
  };
}

function makeTradingItemEntry(itemId, quantity = 0) {
  const item = getTradingItem(itemId);
  return {
    itemId: item.itemId,
    emoji: item.emoji,
    name: item.name,
    rarity: item.rarity,
    source: item.source,
    quantity: Math.max(0, Number.parseInt(quantity || "0", 10) || 0),
  };
}

function normalizeTradingItems(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => makeTradingItemEntry(item.itemId, item.quantity))
    .filter((item) => item.quantity > 0);
}

function getTradingInventories() {
  const savedInventory = localStorage.getItem(tradingInventoryKey);

  if (!savedInventory) {
    return {};
  }

  try {
    const inventory = JSON.parse(savedInventory);
    return inventory && typeof inventory === "object" ? inventory : {};
  } catch {
    return {};
  }
}

function saveTradingInventories(inventories) {
  localStorage.setItem(tradingInventoryKey, JSON.stringify(inventories));
}

function getStoredTradingInventory(friendCode) {
  const safeFriendCode = normalizeFriendCode(friendCode);
  const inventories = getTradingInventories();
  const entry = inventories[safeFriendCode];

  if (!entry) {
    return null;
  }

  return normalizeTradingItems(entry.items || entry);
}

function getTradingInventory(friendCode = activePlayer?.friendCode || "") {
  const safeFriendCode = normalizeFriendCode(friendCode);

  if (!safeFriendCode) {
    return [];
  }

  const inventories = getTradingInventories();
  const existingItems = getStoredTradingInventory(safeFriendCode);

  if (existingItems) {
    return existingItems;
  }

  const starterItems = normalizeTradingItems(tradingStarterInventory);
  inventories[safeFriendCode] = {
    items: starterItems,
    updatedAt: Date.now(),
  };
  saveTradingInventories(inventories);
  return starterItems;
}

function saveTradingInventoryForCode(friendCode, items) {
  const safeFriendCode = normalizeFriendCode(friendCode);

  if (!safeFriendCode) {
    return;
  }

  const inventories = getTradingInventories();
  inventories[safeFriendCode] = {
    items: normalizeTradingItems(items),
    updatedAt: Date.now(),
  };
  saveTradingInventories(inventories);

  if (onlineFriendGames.isConfigured) {
    onlineFriendGames.saveInventory(safeFriendCode, inventories[safeFriendCode].items).catch((error) => {
      console.error("Supabase trading inventory save error:", error);
    });
  }
}

async function syncTradingInventoryFromOnline(friendCode = activePlayer?.friendCode || "") {
  const safeFriendCode = normalizeFriendCode(friendCode);

  if (!safeFriendCode || !onlineFriendGames.isConfigured) {
    return getTradingInventory(safeFriendCode);
  }

  try {
    const onlineInventory = await onlineFriendGames.loadInventory(safeFriendCode);

    if (onlineInventory) {
      saveTradingInventoryForCode(safeFriendCode, onlineInventory.items);
      return onlineInventory.items;
    }

    const localInventory = getTradingInventory(safeFriendCode);
    await onlineFriendGames.saveInventory(safeFriendCode, localInventory);
    return localInventory;
  } catch (error) {
    console.error("Supabase trading inventory load error:", error);
    return getTradingInventory(safeFriendCode);
  }
}

async function getSharedTradingInventory(friendCode) {
  const safeFriendCode = normalizeFriendCode(friendCode);

  if (!safeFriendCode) {
    return [];
  }

  if (onlineFriendGames.isConfigured) {
    const onlineInventory = await onlineFriendGames.loadInventory(safeFriendCode).catch((error) => {
      console.error("Supabase trading inventory lookup error:", error);
      return null;
    });

    if (onlineInventory) {
      saveTradingInventoryForCode(safeFriendCode, onlineInventory.items);
      return onlineInventory.items;
    }
  }

  return getTradingInventory(safeFriendCode);
}

function getTradingItemQuantity(items, itemId) {
  return normalizeTradingItems(items).find((item) => item.itemId === itemId)?.quantity || 0;
}

function hasTradingItems(inventory, items) {
  return normalizeTradingItems(items).every((item) => getTradingItemQuantity(inventory, item.itemId) >= item.quantity);
}

function addTradingItems(inventory, items) {
  const quantities = new Map(normalizeTradingItems(inventory).map((item) => [item.itemId, item.quantity]));

  normalizeTradingItems(items).forEach((item) => {
    quantities.set(item.itemId, (quantities.get(item.itemId) || 0) + item.quantity);
  });

  return [...quantities.entries()].map(([itemId, quantity]) => makeTradingItemEntry(itemId, quantity)).filter((item) => item.quantity > 0);
}

function subtractTradingItems(inventory, items) {
  if (!hasTradingItems(inventory, items)) {
    return null;
  }

  const quantities = new Map(normalizeTradingItems(inventory).map((item) => [item.itemId, item.quantity]));

  normalizeTradingItems(items).forEach((item) => {
    quantities.set(item.itemId, (quantities.get(item.itemId) || 0) - item.quantity);
  });

  return [...quantities.entries()].map(([itemId, quantity]) => makeTradingItemEntry(itemId, quantity)).filter((item) => item.quantity > 0);
}

function tradingDraftToItems(selection = {}) {
  return Object.entries(selection)
    .map(([itemId, quantity]) => makeTradingItemEntry(itemId, quantity))
    .filter((item) => item.quantity > 0);
}

function getTradingAppliedTrades() {
  const savedLog = localStorage.getItem(tradingAppliedTradesKey);

  if (!savedLog) {
    return {};
  }

  try {
    const log = JSON.parse(savedLog);
    return log && typeof log === "object" ? log : {};
  } catch {
    return {};
  }
}

function saveTradingAppliedTrades(log) {
  localStorage.setItem(tradingAppliedTradesKey, JSON.stringify(log));
}

function getTradingAppliedKey(trade, friendCode = activePlayer?.friendCode || "") {
  return `${trade?.id || ""}:${normalizeFriendCode(friendCode)}`;
}

function isTradingTradeApplied(trade, friendCode = activePlayer?.friendCode || "") {
  return Boolean(getTradingAppliedTrades()[getTradingAppliedKey(trade, friendCode)]);
}

function markTradingTradeApplied(trade, friendCode = activePlayer?.friendCode || "") {
  const log = getTradingAppliedTrades();
  log[getTradingAppliedKey(trade, friendCode)] = Date.now();
  saveTradingAppliedTrades(log);
}

function getTradingTrades() {
  const savedTrades = localStorage.getItem(tradingTradesKey);

  if (!savedTrades) {
    return [];
  }

  try {
    const trades = JSON.parse(savedTrades);
    return Array.isArray(trades) ? trades : [];
  } catch {
    return [];
  }
}

function getTradingTradeTime(trade) {
  return Number.parseInt(trade?.updatedAt || trade?.completedAt || trade?.respondedAt || trade?.createdAt || "0", 10) || 0;
}

function saveTradingTrades(trades) {
  localStorage.setItem(tradingTradesKey, JSON.stringify(trades.slice(0, 80)));
}

function saveTradingTrade(trade) {
  const trades = getTradingTrades();
  saveTradingTrades([
    trade,
    ...trades.filter((savedTrade) => savedTrade.id !== trade.id),
  ].sort((firstTrade, secondTrade) => getTradingTradeTime(secondTrade) - getTradingTradeTime(firstTrade)));

  if (trade?.gameType === "trading_game" && trade.fromFriendCode && trade.toFriendCode) {
    saveSharedFriendGameState(trade).catch((error) => {
      console.error("Trading shared save error:", error);
    });
  }
}

function mergeTradingTrades(trades = []) {
  const tradesById = new Map(
    getTradingTrades()
      .filter((trade) => trade?.id)
      .map((trade) => [trade.id, trade]),
  );

  trades
    .filter((trade) => trade?.gameType === "trading_game" && trade.id)
    .forEach((trade) => {
      const currentTrade = tradesById.get(trade.id);

      if (!currentTrade || getTradingTradeTime(trade) >= getTradingTradeTime(currentTrade)) {
        tradesById.set(trade.id, trade);
      }
    });

  saveTradingTrades([...tradesById.values()].sort((firstTrade, secondTrade) => getTradingTradeTime(secondTrade) - getTradingTradeTime(firstTrade)));
}

function cacheTradingTradesFromMessages(messages = []) {
  const trades = messages
    .map((message) => message?.gameData?.tradingGame || null)
    .filter((trade) => trade?.gameType === "trading_game" && trade.id);

  if (trades.length > 0) {
    mergeTradingTrades(trades);
  }
}

function getTradingDisplayTrade(trade) {
  if (trade?.status === "pending" && Date.now() - (Number.parseInt(trade.createdAt || "0", 10) || 0) > tradingOfferExpiryMs) {
    return {
      ...trade,
      status: "expired",
    };
  }

  return trade;
}

function getTradingTradeMessages(messages = getActiveChatMessages()) {
  return messages
    .map((message) => ({
      message,
      trade: message?.gameData?.tradingGame || null,
    }))
    .filter((entry) => entry.trade?.gameType === "trading_game" && entry.trade.id);
}

function getLatestTradingTrade(tradeId, messages = getActiveChatMessages()) {
  const candidates = [
    getTradingTrades().find((trade) => trade.id === tradeId),
    ...getTradingTradeMessages(messages)
      .filter((entry) => entry.trade.id === tradeId)
      .map((entry) => entry.trade),
  ].filter(Boolean);

  const latestTrade = candidates.sort((firstTrade, secondTrade) => getTradingTradeTime(secondTrade) - getTradingTradeTime(firstTrade))[0] || null;
  return getTradingDisplayTrade(latestTrade);
}

function getLatestTradingMessageIds(messages = getActiveChatMessages()) {
  const latestByTrade = new Map();

  getTradingTradeMessages(messages).forEach((entry) => {
    const current = latestByTrade.get(entry.trade.id);
    if (!current || getTradingTradeTime(entry.trade) >= getTradingTradeTime(current.trade)) {
      latestByTrade.set(entry.trade.id, entry);
    }
  });

  return new Set([...latestByTrade.values()].map((entry) => entry.message.id));
}

function isTradingSender(trade) {
  return normalizeFriendCode(activePlayer?.friendCode || "") === normalizeFriendCode(trade?.fromFriendCode || "");
}

function isTradingReceiver(trade) {
  return normalizeFriendCode(activePlayer?.friendCode || "") === normalizeFriendCode(trade?.toFriendCode || "");
}

function formatTradingItems(items = []) {
  const safeItems = normalizeTradingItems(items);

  if (safeItems.length === 0) {
    return "No items";
  }

  return safeItems.map((item) => `${item.emoji} ${item.name} x${item.quantity}`).join(", ");
}

function makeTradingTrade(friendCode, offeredItems, requestedItems) {
  const friendProfile = getFriendProfileSnapshot(friendCode);
  const tradeId = crypto.randomUUID();

  return {
    id: tradeId,
    gameType: "trading_game",
    inviteLink: getGameInviteLink(tradeId),
    fromFriendCode: normalizeFriendCode(activePlayer.friendCode),
    fromNickname: activePlayer.nickname,
    toFriendCode: normalizeFriendCode(friendProfile.friendCode),
    toNickname: friendProfile.nickname,
    offeredItems: normalizeTradingItems(offeredItems),
    requestedItems: normalizeTradingItems(requestedItems),
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    respondedAt: null,
    completedAt: null,
  };
}

function renderTradeItemList(title, items) {
  const wrap = document.createElement("div");
  wrap.className = "trade-summary-list";
  const heading = document.createElement("h4");
  heading.textContent = title;
  const text = document.createElement("p");
  text.textContent = formatTradingItems(items);
  wrap.append(heading, text);
  return wrap;
}

function renderTradingHistory() {
  const ownerCode = normalizeFriendCode(activePlayer?.friendCode || "");
  const trades = getTradingTrades()
    .map(getTradingDisplayTrade)
    .filter((trade) => !ownerCode || trade.fromFriendCode === ownerCode || trade.toFriendCode === ownerCode)
    .slice(0, 6);

  const history = document.createElement("div");
  history.className = "box-history-panel trading-history-panel";
  const title = document.createElement("h3");
  title.textContent = "Trade History";
  history.append(title);

  if (trades.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-leaderboard";
    empty.textContent = "No trades yet. Send a preset collectible trade to start.";
    history.append(empty);
    return history;
  }

  trades.forEach((trade) => {
    const item = document.createElement("article");
    item.className = "friend-activity-item";
    const friendName = trade.fromFriendCode === ownerCode ? trade.toNickname : trade.fromNickname;
    const text = document.createElement("p");

    if (trade.status === "completed") {
      text.textContent = `${friendName}: Trade completed.`;
    } else if (trade.status === "declined") {
      text.textContent = `${friendName}: Trade declined.`;
    } else if (trade.status === "expired") {
      text.textContent = `${friendName}: Trade expired.`;
    } else {
      text.textContent = `${friendName}: Trade offer pending.`;
    }

    const time = document.createElement("span");
    const createdAt = new Date(trade.completedAt || trade.respondedAt || trade.createdAt);
    time.textContent = `${createdAt.toLocaleDateString()} ${createdAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    item.append(text, time);
    history.append(item);
  });

  return history;
}

function renderTradingOffersPanel() {
  const ownerCode = normalizeFriendCode(activePlayer?.friendCode || "");
  const activeTrades = getTradingTrades()
    .map(getTradingDisplayTrade)
    .filter((trade) => trade.status === "pending" && (trade.fromFriendCode === ownerCode || trade.toFriendCode === ownerCode))
    .slice(0, 6);

  const panel = document.createElement("div");
  panel.className = "box-history-panel trading-offers-panel";
  const title = document.createElement("h3");
  title.textContent = "Incoming and Pending Trades";
  panel.append(title);

  if (activeTrades.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-leaderboard";
    empty.textContent = "No pending trade offers.";
    panel.append(empty);
    return panel;
  }

  activeTrades.forEach((trade) => {
    const item = document.createElement("article");
    item.className = "friend-activity-item trade-offer-row";
    const text = document.createElement("p");
    text.textContent = trade.toFriendCode === ownerCode
      ? `${trade.fromNickname} wants to trade: ${formatTradingItems(trade.offeredItems)} for ${formatTradingItems(trade.requestedItems)}.`
      : `Waiting for ${trade.toNickname}: ${formatTradingItems(trade.offeredItems)} for ${formatTradingItems(trade.requestedItems)}.`;
    const actions = document.createElement("div");
    actions.className = "box-card-actions";

    if (trade.toFriendCode === ownerCode) {
      const acceptButton = document.createElement("button");
      acceptButton.className = "save-quiz-button";
      acceptButton.type = "button";
      acceptButton.textContent = "Accept";
      acceptButton.addEventListener("click", () => acceptTradingOffer(trade));
      const declineButton = document.createElement("button");
      declineButton.className = "secondary-button";
      declineButton.type = "button";
      declineButton.textContent = "Decline";
      declineButton.addEventListener("click", () => declineTradingOffer(trade));
      actions.append(acceptButton, declineButton);
    } else {
      const openButton = document.createElement("button");
      openButton.className = "secondary-button";
      openButton.type = "button";
      openButton.textContent = "View";
      openButton.addEventListener("click", () => renderTradingSent(trade));
      actions.append(openButton);
    }

    item.append(text, actions);
    panel.append(item);
  });

  return panel;
}

function renderTradingInventoryPanel(title, inventory = getTradingInventory()) {
  const panel = document.createElement("div");
  panel.className = "trade-inventory-panel";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const grid = document.createElement("div");
  grid.className = "trade-item-grid";

  normalizeTradingItems(inventory).forEach((item) => {
    const card = document.createElement("article");
    card.className = "trade-item-card";
    const icon = document.createElement("span");
    icon.className = "trade-item-icon";
    icon.textContent = item.emoji;
    const name = document.createElement("strong");
    name.textContent = item.name;
    const meta = document.createElement("span");
    meta.textContent = `${item.rarity} • x${item.quantity}`;
    card.append(icon, name, meta);
    grid.append(card);
  });

  panel.append(heading, grid);
  return panel;
}

function renderTradingRules(friendCode = "") {
  tradingGameContent.innerHTML = "";
  tradingGameMessage.textContent = "";

  const rules = document.createElement("div");
  rules.className = "box-rules-panel trading-rules-panel";
  const title = document.createElement("h3");
  title.textContent = "Trading Game Rules";
  const list = document.createElement("ol");
  [
    "Trade cute collectible items with your friends.",
    "Choose what you want to offer.",
    "Choose what you want to ask for.",
    "Your friend can accept or decline.",
    "If they accept, the items swap.",
    "Only trade preset game items.",
    "No real money, no strangers, and no open chat.",
    "Trades should be fair and fun.",
  ].forEach((ruleText) => {
    const item = document.createElement("li");
    item.textContent = ruleText;
    list.append(item);
  });
  rules.append(title, list);

  const actions = document.createElement("div");
  actions.className = "result-actions";
  const gotItButton = document.createElement("button");
  gotItButton.className = "secondary-button";
  gotItButton.type = "button";
  gotItButton.textContent = "Got it";
  gotItButton.addEventListener("click", () => {
    if (friendCode && isApprovedFriendCode(friendCode)) {
      renderTradingOfferBuilder(friendCode);
      return;
    }

    renderTradingFriendChooser();
  });
  const startButton = document.createElement("button");
  startButton.className = "save-quiz-button";
  startButton.type = "button";
  startButton.textContent = "Start Trading";
  startButton.addEventListener("click", () => {
    if (friendCode && isApprovedFriendCode(friendCode)) {
      renderTradingOfferBuilder(friendCode);
      return;
    }

    renderTradingFriendChooser();
  });
  actions.append(gotItButton, startButton);
  tradingGameContent.append(rules, actions, renderTradingOffersPanel(), renderTradingInventoryPanel("My Starter Inventory"), renderTradingHistory());
}

function renderTradingFriendChooser() {
  tradingGameContent.innerHTML = "";

  const intro = document.createElement("div");
  intro.className = "box-of-lies-intro trading-intro";
  intro.innerHTML = `
    <div class="box-secret-visual" aria-hidden="true">💎</div>
    <div>
      <h3>Choose a friend</h3>
      <p>Send a fair preset trade offer. Your friend can accept or decline later.</p>
    </div>
  `;
  tradingGameContent.append(intro);

  const friendCodes = Array.isArray(activePlayer?.friends) ? activePlayer.friends : [];
  const availableFriends = friendCodes.filter((friendCode) => !isFriendBlocked(friendCode));

  if (availableFriends.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-leaderboard";
    empty.textContent = "Add a friend code first, then you can send trades.";
    tradingGameContent.append(empty, renderTradingOffersPanel(), renderTradingInventoryPanel("My Inventory"), renderTradingHistory());
    return;
  }

  const list = document.createElement("div");
  list.className = "friends-list box-friend-list";

  availableFriends.forEach((friendCode) => {
    const friendProfile = getFriendProfileSnapshot(friendCode);
    const row = document.createElement("article");
    row.className = "friend-entry";

    const avatar = document.createElement("div");
    renderAvatar(avatar, friendProfile.avatar || null);

    const details = document.createElement("div");
    details.className = "friend-details";
    const name = document.createElement("h3");
    name.textContent = friendProfile.nickname;
    const code = document.createElement("p");
    code.textContent = friendProfile.friendCode;
    details.append(name, code, makeFriendPresenceBadge(friendProfile));

    const startButton = document.createElement("button");
    startButton.className = "save-quiz-button";
    startButton.type = "button";
    startButton.textContent = "Create Trade";
    startButton.addEventListener("click", () => renderTradingOfferBuilder(friendProfile.friendCode));

    row.append(avatar, details, startButton);
    list.append(row);
  });

  tradingGameContent.append(list, renderTradingOffersPanel(), renderTradingInventoryPanel("My Inventory"), renderTradingHistory());
}

function changeTradingDraft(kind, itemId, delta, maxQuantity = 3) {
  const draft = activeTradingDraft[kind] || {};
  const currentQuantity = Number.parseInt(draft[itemId] || "0", 10) || 0;
  const nextQuantity = Math.max(0, Math.min(maxQuantity, currentQuantity + delta));

  if (nextQuantity === 0) {
    delete draft[itemId];
  } else {
    draft[itemId] = nextQuantity;
  }

  activeTradingDraft = {
    ...activeTradingDraft,
    [kind]: draft,
  };
}

function renderTradingSelectionGrid(title, items, kind) {
  const section = document.createElement("div");
  section.className = "trade-picker-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const grid = document.createElement("div");
  grid.className = "trade-item-grid";

  items.forEach((item) => {
    const selectedQuantity = Number.parseInt(activeTradingDraft[kind]?.[item.itemId] || "0", 10) || 0;
    const maxQuantity = kind === "offered" ? item.quantity : 3;
    const card = document.createElement("article");
    card.className = "trade-item-card selectable";
    const icon = document.createElement("span");
    icon.className = "trade-item-icon";
    icon.textContent = item.emoji;
    const name = document.createElement("strong");
    name.textContent = item.name;
    const meta = document.createElement("span");
    meta.textContent = kind === "offered"
      ? `You have x${item.quantity}`
      : `${item.rarity} item`;
    const selected = document.createElement("span");
    selected.className = "trade-selected-count";
    selected.textContent = `Selected: x${selectedQuantity}`;
    const controls = document.createElement("div");
    controls.className = "trade-item-controls";
    const minusButton = document.createElement("button");
    minusButton.className = "secondary-button";
    minusButton.type = "button";
    minusButton.textContent = "-";
    minusButton.disabled = selectedQuantity === 0;
    minusButton.addEventListener("click", () => {
      changeTradingDraft(kind, item.itemId, -1, maxQuantity);
      renderTradingOfferBuilder(activeTradingFriendCode, false);
    });
    const plusButton = document.createElement("button");
    plusButton.className = "secondary-button";
    plusButton.type = "button";
    plusButton.textContent = "+";
    plusButton.disabled = selectedQuantity >= maxQuantity;
    plusButton.addEventListener("click", () => {
      changeTradingDraft(kind, item.itemId, 1, maxQuantity);
      renderTradingOfferBuilder(activeTradingFriendCode, false);
    });
    controls.append(minusButton, plusButton);
    card.append(icon, name, meta, selected, controls);
    grid.append(card);
  });

  section.append(heading, grid);
  return section;
}

function renderTradingDraftSummary() {
  const summary = document.createElement("div");
  summary.className = "trade-draft-summary";
  summary.append(
    renderTradeItemList("You offer", tradingDraftToItems(activeTradingDraft.offered)),
    renderTradeItemList("You ask for", tradingDraftToItems(activeTradingDraft.requested)),
  );
  return summary;
}

function renderTradingOfferBuilder(friendCode, resetDraft = true) {
  const safeFriendCode = normalizeFriendCode(friendCode);

  if (!isApprovedFriendCode(safeFriendCode)) {
    tradingGameMessage.textContent = "Choose an added friend first.";
    renderTradingFriendChooser();
    return;
  }

  activeTradingFriendCode = safeFriendCode;

  if (resetDraft) {
    activeTradingDraft = { offered: {}, requested: {} };
  }

  const friendProfile = getFriendProfileSnapshot(safeFriendCode);
  const myInventory = getTradingInventory(activePlayer.friendCode);
  tradingGameContent.innerHTML = "";
  tradingGameMessage.textContent = isFriendOnline(friendProfile)
    ? `${friendProfile.nickname} looks online.`
    : "Your friend is offline. They can answer the trade when they come back.";

  const intro = document.createElement("div");
  intro.className = "box-secret-panel trading-offer-panel";
  const icon = document.createElement("div");
  icon.className = "box-secret-visual";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "💎";
  const details = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Create Trade";
  const title = document.createElement("h3");
  title.textContent = `Trade with ${friendProfile.nickname}`;
  const body = document.createElement("p");
  body.textContent = "Pick preset items only. Your friend can accept or decline.";
  details.append(eyebrow, title, body, makeFriendPresenceBadge(friendProfile));
  intro.append(icon, details);

  const sendButton = document.createElement("button");
  sendButton.className = "save-quiz-button";
  sendButton.type = "button";
  sendButton.textContent = "Send Trade Offer";
  sendButton.addEventListener("click", sendTradingOffer);

  const backButton = document.createElement("button");
  backButton.className = "secondary-button";
  backButton.type = "button";
  backButton.textContent = "Choose Another Friend";
  backButton.addEventListener("click", renderTradingFriendChooser);

  const actions = document.createElement("div");
  actions.className = "result-actions";
  actions.append(sendButton, backButton);

  tradingGameContent.append(
    intro,
    renderTradingSelectionGrid("Offer from my inventory", myInventory, "offered"),
    renderTradingSelectionGrid("Ask for a preset collectible", tradingCollectibles.map((item) => makeTradingItemEntry(item.itemId, 1)), "requested"),
    renderTradingDraftSummary(),
    actions,
    renderTradingHistory(),
  );
}

async function saveTradingTradeMessage(trade, receiverCode, messageText) {
  const onlineGameSaved = await saveSharedFriendGameState(trade);
  const result = await saveFriendMessage(
    receiverCode,
    messageText.slice(0, 150),
    "trading_game_offer",
    "",
    { gameData: { tradingGame: trade, gameInviteId: trade.id, gameInviteLink: trade.inviteLink || getGameInviteLink(trade.id) } },
  );
  saveTradingTrade(trade);
  return { ...result, onlineGameSaved };
}

async function sendTradingOffer() {
  const friendProfile = getFriendProfileSnapshot(activeTradingFriendCode);
  const offeredItems = tradingDraftToItems(activeTradingDraft.offered);
  const requestedItems = tradingDraftToItems(activeTradingDraft.requested);

  if (!friendProfile?.friendCode || !isApprovedFriendCode(friendProfile.friendCode)) {
    tradingGameMessage.textContent = "Choose an added friend first.";
    return;
  }

  if (offeredItems.length === 0 || requestedItems.length === 0) {
    tradingGameMessage.textContent = "Choose at least one item to offer and one item to ask for.";
    return;
  }

  const myInventory = await syncTradingInventoryFromOnline(activePlayer.friendCode);

  if (!hasTradingItems(myInventory, offeredItems)) {
    tradingGameMessage.textContent = "This trade can’t be sent because you do not have one of those items anymore.";
    renderTradingOfferBuilder(friendProfile.friendCode, false);
    return;
  }

  const trade = makeTradingTrade(friendProfile.friendCode, offeredItems, requestedItems);
  saveTradingTrade(trade);
  tradingGameMessage.textContent = `Sending trade offer to ${friendProfile.nickname}...`;

  try {
    const result = await saveTradingTradeMessage(
      trade,
      trade.toFriendCode,
      `Trade offer: ${formatTradingItems(trade.offeredItems)} for ${formatTradingItems(trade.requestedItems)}`,
    );
    const earnedStar = awardFriendActionStars(`trade-offer:${trade.toFriendCode}`, 1);

    addFriendActivity({
      type: "trade_offer_sent",
      friendCode: trade.toFriendCode,
      friendNickname: trade.toNickname,
      text: `You sent ${trade.toNickname} a trade offer.`,
    });

    tradingGameMessage.textContent = result.online
      ? `Trade offer sent to ${trade.toNickname}!${earnedStar ? " You earned 1 star." : ""}`
      : `Trade offer saved here for ${trade.toNickname}.${earnedStar ? " You earned 1 star." : ""}`;
    renderTradingSent(trade);
  } catch (error) {
    console.error("Trading offer send error:", error);
    tradingGameMessage.textContent = "Trade offer could not be sent yet. Please try again.";
  }
}

function applyTradingTradeForCurrentPlayer(trade) {
  if (trade.status !== "completed") {
    return { ok: false, message: "This trade is not completed yet." };
  }

  if (trade.inventoryMode === "shared") {
    syncTradingInventoryFromOnline(activePlayer?.friendCode || "").catch((error) => {
      console.error("Shared trade inventory sync error:", error);
    });
    return { ok: true, applied: false, message: "Shared inventory synced." };
  }

  const activeCode = normalizeFriendCode(activePlayer?.friendCode || "");

  if (![trade.fromFriendCode, trade.toFriendCode].map(normalizeFriendCode).includes(activeCode)) {
    return { ok: false, message: "This trade does not belong to this player." };
  }

  if (isTradingTradeApplied(trade, activeCode)) {
    return { ok: true, applied: false, message: "Trade already applied." };
  }

  const itemsToRemove = activeCode === normalizeFriendCode(trade.fromFriendCode) ? trade.offeredItems : trade.requestedItems;
  const itemsToAdd = activeCode === normalizeFriendCode(trade.fromFriendCode) ? trade.requestedItems : trade.offeredItems;
  const currentInventory = getTradingInventory(activeCode);
  const afterRemoval = subtractTradingItems(currentInventory, itemsToRemove);

  if (!afterRemoval) {
    return { ok: false, message: "This trade can’t be completed because one item is no longer available." };
  }

  saveTradingInventoryForCode(activeCode, addTradingItems(afterRemoval, itemsToAdd));
  markTradingTradeApplied(trade, activeCode);
  return { ok: true, applied: true, message: "Trade applied." };
}

async function completeTradingInventoriesForSharedTrade(trade) {
  const senderInventory = await getSharedTradingInventory(trade.fromFriendCode);
  const receiverInventory = await getSharedTradingInventory(trade.toFriendCode);

  if (!hasTradingItems(senderInventory, trade.offeredItems) || !hasTradingItems(receiverInventory, trade.requestedItems)) {
    return {
      ok: false,
      message: "This trade can’t be completed because one item is no longer available.",
    };
  }

  const senderAfterRemoval = subtractTradingItems(senderInventory, trade.offeredItems);
  const receiverAfterRemoval = subtractTradingItems(receiverInventory, trade.requestedItems);

  if (!senderAfterRemoval || !receiverAfterRemoval) {
    return {
      ok: false,
      message: "This trade can’t be completed because one item is no longer available.",
    };
  }

  const senderUpdatedInventory = addTradingItems(senderAfterRemoval, trade.requestedItems);
  const receiverUpdatedInventory = addTradingItems(receiverAfterRemoval, trade.offeredItems);

  saveTradingInventoryForCode(trade.fromFriendCode, senderUpdatedInventory);
  saveTradingInventoryForCode(trade.toFriendCode, receiverUpdatedInventory);

  if (onlineFriendGames.isConfigured) {
    await Promise.all([
      onlineFriendGames.saveInventory(trade.fromFriendCode, senderUpdatedInventory),
      onlineFriendGames.saveInventory(trade.toFriendCode, receiverUpdatedInventory),
    ]);
  }

  return { ok: true };
}

async function acceptTradingOffer(trade) {
  const latestTrade = getLatestTradingTrade(trade.id) || trade;
  hideMainSections();
  updateProfileBar();
  tradingGameCard.classList.remove("hidden");

  if (!isTradingReceiver(latestTrade) || latestTrade.status !== "pending") {
    tradingGameMessage.textContent = "This trade offer is not available anymore.";
    renderTradingByStatus(latestTrade);
    return;
  }

  const completedTrade = {
    ...latestTrade,
    status: "completed",
    inventoryMode: onlineFriendGames.isConfigured ? "shared" : "local",
    respondedAt: Date.now(),
    completedAt: Date.now(),
    updatedAt: Date.now(),
  };
  const applyResult = onlineFriendGames.isConfigured
    ? await completeTradingInventoriesForSharedTrade(completedTrade)
    : applyTradingTradeForCurrentPlayer(completedTrade);

  if (!applyResult.ok) {
    tradingGameMessage.textContent = applyResult.message;
    renderIncomingTradingOffer(latestTrade);
    return;
  }

  saveTradingTrade(completedTrade);
  tradingGameMessage.textContent = "Accepting trade...";

  try {
    await saveTradingTradeMessage(
      completedTrade,
      completedTrade.fromFriendCode,
      `${activePlayer.nickname} accepted your trade.`,
    );
    const earnedStars = awardFriendActionStars(`trade-complete:${completedTrade.id}`, 2);
    addFriendActivity({
      type: "trade_completed",
      friendCode: completedTrade.fromFriendCode,
      friendNickname: completedTrade.fromNickname,
      text: `You accepted ${completedTrade.fromNickname}'s trade.`,
    });
    tradingGameMessage.textContent = earnedStars ? "Trade completed. You earned 2 stars!" : "Trade completed.";
    hideMainSections();
    updateProfileBar();
    tradingGameCard.classList.remove("hidden");
    renderTradingResult(completedTrade);
  } catch (error) {
    console.error("Trading accept sync error:", error);
    tradingGameMessage.textContent = "Trade completed here. Online sync could not finish yet.";
    hideMainSections();
    updateProfileBar();
    tradingGameCard.classList.remove("hidden");
    renderTradingResult(completedTrade);
  }
}

async function declineTradingOffer(trade) {
  const latestTrade = getLatestTradingTrade(trade.id) || trade;
  hideMainSections();
  updateProfileBar();
  tradingGameCard.classList.remove("hidden");

  if (!isTradingReceiver(latestTrade) || latestTrade.status !== "pending") {
    tradingGameMessage.textContent = "This trade offer is not available anymore.";
    renderTradingByStatus(latestTrade);
    return;
  }

  const declinedTrade = {
    ...latestTrade,
    status: "declined",
    respondedAt: Date.now(),
    updatedAt: Date.now(),
  };
  saveTradingTrade(declinedTrade);
  tradingGameMessage.textContent = "Declining trade...";

  try {
    await saveTradingTradeMessage(
      declinedTrade,
      declinedTrade.fromFriendCode,
      `${activePlayer.nickname} declined your trade.`,
    );
    addFriendActivity({
      type: "trade_declined",
      friendCode: declinedTrade.fromFriendCode,
      friendNickname: declinedTrade.fromNickname,
      text: `You declined ${declinedTrade.fromNickname}'s trade.`,
    });
    tradingGameMessage.textContent = "Trade declined.";
    hideMainSections();
    updateProfileBar();
    tradingGameCard.classList.remove("hidden");
    renderTradingDeclined(declinedTrade);
  } catch (error) {
    console.error("Trading decline sync error:", error);
    tradingGameMessage.textContent = "Trade declined here. Online sync could not finish yet.";
    hideMainSections();
    updateProfileBar();
    tradingGameCard.classList.remove("hidden");
    renderTradingDeclined(declinedTrade);
  }
}

function getTradingTradeFromMessage(message) {
  const messageTrade = message?.gameData?.tradingGame || null;
  const trade = getLatestTradingTrade(messageTrade?.id || message?.gameData?.tradingTradeId || "") || messageTrade;

  if (!trade || trade.gameType !== "trading_game") {
    return null;
  }

  return trade;
}

async function openTradingOffer(message) {
  let trade = getTradingTradeFromMessage(message);
  const inviteId = trade?.id || message?.gameData?.gameInviteId || "";

  if (inviteId && onlineFriendGames.isConfigured) {
    try {
      const onlineTrade = await onlineFriendGames.loadGame(inviteId);
      if (onlineTrade?.gameType === "trading_game") {
        mergeTradingTrades([onlineTrade]);
        trade = onlineTrade;
      }
    } catch (error) {
      console.error("Trading online invite load error:", error);
    }
  }

  if (!trade) {
    chatMessage.textContent = "This trade could not be opened. Please ask your friend to send it again.";
    return;
  }

  hideMainSections();
  updateProfileBar();
  tradingGameCard.classList.remove("hidden");
  tradingGameMessage.textContent = "";
  if (trade.status === "completed" && trade.inventoryMode === "shared") {
    await syncTradingInventoryFromOnline(activePlayer?.friendCode || "");
  }
  renderTradingByStatus(trade);
}

function renderTradingByStatus(trade) {
  const latestTrade = getLatestTradingTrade(trade.id) || trade;

  if (latestTrade.status === "pending") {
    if (isTradingReceiver(latestTrade)) {
      renderIncomingTradingOffer(latestTrade);
    } else {
      renderTradingSent(latestTrade);
    }
    return;
  }

  if (latestTrade.status === "declined") {
    renderTradingDeclined(latestTrade);
    return;
  }

  if (latestTrade.status === "expired") {
    renderTradingExpired(latestTrade);
    return;
  }

  renderTradingResult(latestTrade);
}

function renderIncomingTradingOffer(trade) {
  tradingGameContent.innerHTML = "";
  const card = document.createElement("div");
  card.className = "box-secret-panel trading-offer-panel";
  const icon = document.createElement("div");
  icon.className = "box-secret-visual";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "💎";
  const details = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Incoming Trade";
  const title = document.createElement("h3");
  title.textContent = `${trade.fromNickname} sent you a trade offer.`;
  details.append(eyebrow, title, renderTradeItemList("They offer", trade.offeredItems), renderTradeItemList("They ask for", trade.requestedItems));
  card.append(icon, details);

  const actions = document.createElement("div");
  actions.className = "result-actions";
  const acceptButton = document.createElement("button");
  acceptButton.className = "save-quiz-button";
  acceptButton.type = "button";
  acceptButton.textContent = "Accept";
  acceptButton.addEventListener("click", () => acceptTradingOffer(trade));
  const declineButton = document.createElement("button");
  declineButton.className = "secondary-button";
  declineButton.type = "button";
  declineButton.textContent = "Decline";
  declineButton.addEventListener("click", () => declineTradingOffer(trade));
  actions.append(acceptButton, declineButton);

  tradingGameContent.append(card, actions, renderTradingInventoryPanel("My Inventory"), renderTradingHistory());
}

function renderTradingSent(trade) {
  tradingGameContent.innerHTML = "";
  const card = document.createElement("div");
  card.className = "box-secret-panel trading-offer-panel";
  const icon = document.createElement("div");
  icon.className = "box-secret-visual";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "💌";
  const details = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Trade Sent";
  const title = document.createElement("h3");
  title.textContent = `${trade.toNickname} can accept or decline this trade.`;
  details.append(eyebrow, title, renderTradeItemList("You offer", trade.offeredItems), renderTradeItemList("You ask for", trade.requestedItems));
  card.append(icon, details);

  const actions = document.createElement("div");
  actions.className = "result-actions";
  const chatButton = document.createElement("button");
  chatButton.className = "save-quiz-button";
  chatButton.type = "button";
  chatButton.textContent = "Open Chat";
  chatButton.addEventListener("click", () => showChat(trade.toFriendCode));
  const gamesButton = document.createElement("button");
  gamesButton.className = "secondary-button";
  gamesButton.type = "button";
  gamesButton.textContent = "Back to Games";
  gamesButton.addEventListener("click", showGames);
  const copyLinkButton = document.createElement("button");
  copyLinkButton.className = "secondary-button";
  copyLinkButton.type = "button";
  copyLinkButton.textContent = "Copy Trade Link";
  copyLinkButton.addEventListener("click", async () => {
    const link = trade.inviteLink || getGameInviteLink(trade.id);

    try {
      await navigator.clipboard.writeText(link);
      tradingGameMessage.textContent = "Trading Game link copied.";
    } catch {
      tradingGameMessage.textContent = `Trading Game link: ${link}`;
    }
  });
  actions.append(chatButton, copyLinkButton, gamesButton);

  tradingGameContent.append(card, actions, renderTradingInventoryPanel("My Inventory"), renderTradingHistory());
}

function renderTradingDeclined(trade) {
  tradingGameContent.innerHTML = "";
  const card = document.createElement("div");
  card.className = "box-secret-panel trading-offer-panel";
  const icon = document.createElement("div");
  icon.className = "box-secret-visual";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "✕";
  const details = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Trade Declined";
  const title = document.createElement("h3");
  title.textContent = isTradingSender(trade)
    ? `${trade.toNickname} declined this trade.`
    : "You declined this trade.";
  const body = document.createElement("p");
  body.textContent = "No items were swapped.";
  details.append(eyebrow, title, body);
  card.append(icon, details);
  tradingGameContent.append(card, renderTradingInventoryPanel("My Inventory"), renderTradingHistory());
}

function renderTradingExpired(trade) {
  tradingGameContent.innerHTML = "";
  const card = document.createElement("div");
  card.className = "box-secret-panel trading-offer-panel";
  const icon = document.createElement("div");
  icon.className = "box-secret-visual";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "⌛";
  const details = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Trade Expired";
  const title = document.createElement("h3");
  title.textContent = "This trade offer is too old.";
  const body = document.createElement("p");
  body.textContent = "Send a fresh trade if you still want to swap items.";
  details.append(eyebrow, title, body);
  card.append(icon, details);
  tradingGameContent.append(card, renderTradingInventoryPanel("My Inventory"), renderTradingHistory());
}

function renderTradingResult(trade) {
  saveTradingTrade(trade);
  const applyResult = applyTradingTradeForCurrentPlayer(trade);
  const tradeCompletedForThisPlayer = applyResult.ok;

  if (!applyResult.ok) {
    tradingGameMessage.textContent = applyResult.message;
  }

  tradingGameContent.innerHTML = "";
  const card = document.createElement("div");
  card.className = "box-secret-panel trading-offer-panel";
  const icon = document.createElement("div");
  icon.className = "box-secret-visual";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "🌟";
  const details = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = tradeCompletedForThisPlayer ? "Trade Complete" : "Trade Needs Attention";
  const title = document.createElement("h3");
  title.textContent = tradeCompletedForThisPlayer ? "Items swapped!" : "This trade could not be applied here.";
  const body = document.createElement("p");
  body.textContent = tradeCompletedForThisPlayer
    ? "Your inventory has been updated safely."
    : "One side no longer has the needed item in this saved inventory.";
  details.append(eyebrow, title, body, renderTradeItemList(`${trade.fromNickname} offered`, trade.offeredItems), renderTradeItemList(`${trade.toNickname} gave`, trade.requestedItems));
  card.append(icon, details);

  const actions = document.createElement("div");
  actions.className = "result-actions";
  const chatButton = document.createElement("button");
  chatButton.className = "save-quiz-button";
  chatButton.type = "button";
  chatButton.textContent = "Back to Chat";
  chatButton.addEventListener("click", () => showChat(isTradingSender(trade) ? trade.toFriendCode : trade.fromFriendCode));
  const gamesButton = document.createElement("button");
  gamesButton.className = "secondary-button";
  gamesButton.type = "button";
  gamesButton.textContent = "Back to Games";
  gamesButton.addEventListener("click", showGames);
  actions.append(chatButton, gamesButton);

  tradingGameContent.append(card, actions, renderTradingInventoryPanel("My Inventory"), renderTradingHistory());
}

function getTradingCardLine(trade) {
  if (trade.status === "pending") {
    return `${trade.fromNickname} sent ${trade.toNickname} a trade offer.`;
  }

  if (trade.status === "declined") {
    return `${trade.toNickname} declined a trade offer.`;
  }

  if (trade.status === "expired") {
    return "This trade offer expired.";
  }

  return `${trade.fromNickname} and ${trade.toNickname} completed a trade.`;
}

function getTradingCardTitle(trade) {
  if (trade.status === "pending") {
    return isTradingReceiver(trade) ? "Accept or decline this trade" : "Waiting for your friend";
  }

  if (trade.status === "declined") {
    return "Trade declined";
  }

  if (trade.status === "expired") {
    return "Trade expired";
  }

  return "Trade completed";
}

function getTradingCardButtonLabel(trade) {
  if (trade.status === "pending" && isTradingReceiver(trade)) {
    return "Review";
  }

  return trade.status === "completed" ? "View Trade" : "Open";
}

function showTradingGame(friendCode = "") {
  if (!activePlayer) {
    showPlayerGate();
    return;
  }

  hideMainSections();
  updateProfileBar();
  activeTradingFriendCode = normalizeFriendCode(friendCode);
  activeTradingDraft = { offered: {}, requested: {} };
  tradingGameMessage.textContent = "";
  tradingGameCard.classList.remove("hidden");
  renderTradingRules(activeTradingFriendCode);
  syncTradingInventoryFromOnline(activePlayer.friendCode).then(() => {
    if (!tradingGameCard.classList.contains("hidden") && !activeTradingFriendCode) {
      renderTradingRules();
    }
  }).catch((error) => console.error("Trading inventory refresh sync error:", error));
  syncFriendGameStateFromOnline().then(() => {
    if (!tradingGameCard.classList.contains("hidden") && !activeTradingFriendCode) {
      renderTradingRules();
    }
  }).catch((error) => console.error("Trading game refresh sync error:", error));
}

function showGameInviteLoadError(message = "This game invite could not be loaded. Please ask your friend to send it again.") {
  hideMainSections();
  updateProfileBar();
  tradingGameCard.classList.remove("hidden");
  tradingGameContent.innerHTML = "";
  const errorCard = document.createElement("div");
  errorCard.className = "box-secret-panel trading-offer-panel";
  const icon = document.createElement("div");
  icon.className = "box-secret-visual";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "!";
  const details = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Game Invite";
  const title = document.createElement("h3");
  title.textContent = "Invite not found";
  const body = document.createElement("p");
  body.textContent = message;
  details.append(eyebrow, title, body);
  errorCard.append(icon, details);
  tradingGameContent.append(errorCard);
  tradingGameMessage.textContent = "";
}

async function openGameInviteFromLink(inviteId) {
  const safeInviteId = String(inviteId || "").trim();

  if (!safeInviteId) {
    return false;
  }

  if (!activePlayer) {
    pendingGameInviteId = safeInviteId;
    showPlayerGate();
    return true;
  }

  if (!onlineFriendGames.isConfigured) {
    showGameInviteLoadError("Game invite links need Supabase game tables before they can work across devices.");
    return true;
  }

  try {
    const gameRecord = await onlineFriendGames.loadGame(safeInviteId);

    if (!gameRecord) {
      showGameInviteLoadError();
      return true;
    }

    if (![gameRecord.fromFriendCode, gameRecord.toFriendCode].map(normalizeFriendCode).includes(normalizeFriendCode(activePlayer.friendCode))) {
      showGameInviteLoadError("This invite belongs to a different friend code. Log in as the invited player to open it.");
      return true;
    }

    cacheFriendGameStateFromOnlineRecords([gameRecord]);
    hideMainSections();
    updateProfileBar();

    if (gameRecord.gameType === "box_of_lies") {
      boxOfLiesCard.classList.remove("hidden");
      boxOfLiesMessage.textContent = "";
      renderBoxOfLiesByStatus(gameRecord);
      return true;
    }

    if (gameRecord.gameType === "trading_game") {
      tradingGameCard.classList.remove("hidden");
      tradingGameMessage.textContent = "";
      if (gameRecord.status === "completed" && gameRecord.inventoryMode === "shared") {
        await syncTradingInventoryFromOnline(activePlayer.friendCode);
      }
      renderTradingByStatus(gameRecord);
      return true;
    }

    showGameInviteLoadError();
    return true;
  } catch (error) {
    console.error("Game invite link load error:", error);
    showGameInviteLoadError();
    return true;
  }
}

async function loadGameInviteFromUrl() {
  const inviteId = new URLSearchParams(window.location.search).get("gameInvite");

  if (!inviteId) {
    return false;
  }

  return openGameInviteFromLink(inviteId);
}

function getQuizIdFromInvite(quizInvite) {
  if (quizInvite?.quizId) {
    return quizInvite.quizId;
  }

  if (!quizInvite?.quizLink) {
    return "";
  }

  try {
    return new URL(quizInvite.quizLink, window.location.href).searchParams.get("quiz") || "";
  } catch {
    return "";
  }
}

async function playQuizInvite(message) {
  const quizInvite = message.quizInvite || {};
  const quizId = getQuizIdFromInvite(quizInvite);

  if (!quizId) {
    if (quizInvite.quizLink) {
      window.location.href = quizInvite.quizLink;
      return;
    }

    chatMessage.textContent = "This quiz could not be opened. Please ask your friend to send it again.";
    return;
  }

  chatMessage.textContent = "Opening quiz invite...";

  try {
    const onlineQuiz = await onlineQuizSharing.loadQuiz(quizId);
    const inviteQuestions = normalizeQuizQuestions(onlineQuiz?.questions || []);

    if (inviteQuestions.length === 0) {
      throw new Error("Quiz invite did not load questions.");
    }

    sharedQuizMode = "online-link";
    currentSharedQuiz = onlineQuiz;
    sharedLinkQuestions = inviteQuestions;
    activeOnlineQuizId = quizId;
    onlineLeaderboardEntries = sortLeaderboard(await onlineQuizSharing.loadScores(quizId));
    startQuiz(inviteQuestions, "online", "scored", quizId);
  } catch (error) {
    console.error("Quiz invite open error:", error);
    chatMessage.textContent = "This quiz could not be opened. Please ask your friend to send it again.";
  }
}

function getBoxOfLiesInviteLine(round) {
  if (round.status === "pending") {
    return `${round.fromNickname} invited ${round.toNickname} to play Box of Lies!`;
  }

  if (round.status === "accepted") {
    return `${round.toNickname} accepted the Box of Lies invite.`;
  }

  if (round.status === "declined") {
    return `${round.toNickname} declined the Box of Lies invite.`;
  }

  if (round.status === "expired") {
    return "This Box of Lies invite expired.";
  }

  if (round.status === "completed") {
    return `${round.winnerNickname || "Someone"} won Box of Lies!`;
  }

  return `${round.fromNickname} sent a Box of Lies message.`;
}

function getBoxOfLiesCardTitle(round) {
  if (round.status === "pending") {
    return isBoxOfLiesInvitedFriend(round) ? "Accept or decline this invite" : "Waiting for your friend";
  }

  if (round.status === "accepted") {
    return isBoxOfLiesInviter(round) ? "Ready for the rules" : "Waiting for the storyteller";
  }

  if (round.status === "in_progress") {
    return isBoxOfLiesInvitedFriend(round) ? "Guess Truth or Lie" : "Waiting for a guess";
  }

  if (round.status === "declined") {
    return "Invite declined";
  }

  if (round.status === "expired") {
    return "Invite expired";
  }

  return "Box revealed";
}

function getBoxOfLiesCardMeta(round) {
  if (round.status === "in_progress" || round.status === "completed") {
    return `Box message: “${round.selectedMessage}”`;
  }

  if (round.status === "pending") {
    return "The game starts after the invite is accepted.";
  }

  if (round.status === "accepted") {
    return "Rules come before the secret item.";
  }

  if (round.status === "declined") {
    return "No round was started.";
  }

  if (round.status === "expired") {
    return "Send a new invite to play.";
  }

  return `Secret item: ${round.secretEmoji} ${round.secretItem}`;
}

function getBoxOfLiesCardButtonLabel(round) {
  if (round.status === "accepted" && isBoxOfLiesInviter(round)) {
    return "Start Game";
  }

  if (round.status === "in_progress" && isBoxOfLiesInvitedFriend(round)) {
    return "Play";
  }

  if (round.status === "completed") {
    return "View Result";
  }

  return "Open";
}

function renderChatHistory() {
  chatHistory.innerHTML = "";

  if (!selectedChatFriendCode) {
    chatHistory.innerHTML = '<p class="empty-leaderboard">Choose a friend to see messages.</p>';
    return;
  }

  const messages = getActiveChatMessages();

  if (messages.length === 0) {
    chatHistory.innerHTML = '<p class="empty-leaderboard">No messages yet. Send a safe hello.</p>';
    return;
  }

  const latestBoxMessageIds = getLatestBoxOfLiesMessageIds(messages);
  const latestTradingMessageIds = getLatestTradingMessageIds(messages);

  messages.forEach((message) => {
    const bubble = document.createElement("article");
    bubble.className = normalizeFriendCode(message.senderCode) === normalizeFriendCode(activePlayer.friendCode) ? "chat-bubble mine" : "chat-bubble";

    const meta = document.createElement("p");
    meta.className = "chat-meta";
    const sentAt = new Date(message.createdAt);
    meta.textContent = `${message.senderNickname} • ${sentAt.toLocaleDateString()} ${sentAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;

    const text = document.createElement("p");
    text.className = "chat-text";
    text.textContent = message.text;

    if (message.type === "box_of_lies_invite" && getBoxOfLiesRoundFromMessage(message)) {
      if (!latestBoxMessageIds.has(message.id)) {
        return;
      }
      const round = getBoxOfLiesRoundFromMessage(message);
      const inviteCard = document.createElement("div");
      inviteCard.className = "quiz-invite-card box-lies-invite-card";

      const inviteIcon = document.createElement("span");
      inviteIcon.className = "quiz-invite-icon";
      inviteIcon.textContent = "▣";

      const inviteDetails = document.createElement("div");
      const inviteMessage = document.createElement("p");
      inviteMessage.className = "quiz-invite-message";
      inviteMessage.textContent = getBoxOfLiesInviteLine(round);
      const inviteTitle = document.createElement("h4");
      inviteTitle.textContent = getBoxOfLiesCardTitle(round);
      const inviteMeta = document.createElement("p");
      inviteMeta.textContent = getBoxOfLiesCardMeta(round);
      const statusLine = document.createElement("p");
      statusLine.textContent = `Status: ${round.status.replaceAll("_", " ")}`;
      inviteDetails.append(inviteMessage, inviteTitle, inviteMeta, statusLine);

      const buttonWrap = document.createElement("div");
      buttonWrap.className = "box-card-actions";

      if (round.status === "pending" && isBoxOfLiesInvitedFriend(round)) {
        const acceptButton = document.createElement("button");
        acceptButton.className = "save-quiz-button";
        acceptButton.type = "button";
        acceptButton.textContent = "Accept";
        acceptButton.addEventListener("click", () => acceptBoxOfLiesInvite(round));
        const declineButton = document.createElement("button");
        declineButton.className = "secondary-button";
        declineButton.type = "button";
        declineButton.textContent = "Decline";
        declineButton.addEventListener("click", () => declineBoxOfLiesInvite(round));
        buttonWrap.append(acceptButton, declineButton);
      } else {
        const playButton = document.createElement("button");
        playButton.className = "save-quiz-button";
        playButton.type = "button";
        playButton.textContent = getBoxOfLiesCardButtonLabel(round);
        playButton.addEventListener("click", () => openBoxOfLiesInvite(message));
        buttonWrap.append(playButton);
      }

      inviteCard.append(inviteIcon, inviteDetails, buttonWrap);
      bubble.append(meta, inviteCard);
    } else if (message.type === "trading_game_offer" && getTradingTradeFromMessage(message)) {
      if (!latestTradingMessageIds.has(message.id)) {
        return;
      }
      const trade = getTradingTradeFromMessage(message);
      const tradeCard = document.createElement("div");
      tradeCard.className = "quiz-invite-card trading-invite-card";

      const tradeIcon = document.createElement("span");
      tradeIcon.className = "quiz-invite-icon";
      tradeIcon.textContent = "💎";

      const tradeDetails = document.createElement("div");
      const tradeMessage = document.createElement("p");
      tradeMessage.className = "quiz-invite-message";
      tradeMessage.textContent = getTradingCardLine(trade);
      const tradeTitle = document.createElement("h4");
      tradeTitle.textContent = getTradingCardTitle(trade);
      const offeredLine = document.createElement("p");
      offeredLine.textContent = `Offer: ${formatTradingItems(trade.offeredItems)}`;
      const requestedLine = document.createElement("p");
      requestedLine.textContent = `Asks for: ${formatTradingItems(trade.requestedItems)}`;
      const statusLine = document.createElement("p");
      statusLine.textContent = `Status: ${trade.status.replaceAll("_", " ")}`;
      tradeDetails.append(tradeMessage, tradeTitle, offeredLine, requestedLine, statusLine);

      const buttonWrap = document.createElement("div");
      buttonWrap.className = "box-card-actions";

      if (trade.status === "pending" && isTradingReceiver(trade)) {
        const acceptButton = document.createElement("button");
        acceptButton.className = "save-quiz-button";
        acceptButton.type = "button";
        acceptButton.textContent = "Accept";
        acceptButton.addEventListener("click", () => acceptTradingOffer(trade));
        const declineButton = document.createElement("button");
        declineButton.className = "secondary-button";
        declineButton.type = "button";
        declineButton.textContent = "Decline";
        declineButton.addEventListener("click", () => declineTradingOffer(trade));
        buttonWrap.append(acceptButton, declineButton);
      } else {
        const openButton = document.createElement("button");
        openButton.className = "save-quiz-button";
        openButton.type = "button";
        openButton.textContent = getTradingCardButtonLabel(trade);
        openButton.addEventListener("click", () => openTradingOffer(message));
        buttonWrap.append(openButton);
      }

      tradeCard.append(tradeIcon, tradeDetails, buttonWrap);
      bubble.append(meta, tradeCard);
    } else if (message.type === "quiz_invite" && (message.quizInvite?.quizLink || message.quizInvite?.quizId)) {
      const inviteCard = document.createElement("div");
      inviteCard.className = "quiz-invite-card";

      const inviteIcon = document.createElement("span");
      inviteIcon.className = "quiz-invite-icon";
      inviteIcon.textContent = "💌";

      const inviteDetails = document.createElement("div");
      const inviteMessage = document.createElement("p");
      inviteMessage.className = "quiz-invite-message";
      inviteMessage.textContent = `${message.senderNickname} sent you a quiz!`;
      const inviteTitle = document.createElement("h4");
      inviteTitle.textContent = message.quizInvite.quizTitle || "Friend quiz";
      const inviteMeta = document.createElement("p");
      inviteMeta.textContent = `${message.quizInvite.questionCount || "?"} questions`;
      const senderLine = document.createElement("p");
      senderLine.textContent = `Sender: ${message.senderNickname}`;
      inviteDetails.append(inviteMessage, inviteTitle, inviteMeta, senderLine);

      const playButton = document.createElement("button");
      playButton.className = "save-quiz-button";
      playButton.type = "button";
      playButton.textContent = "Play Quiz";
      playButton.addEventListener("click", () => playQuizInvite(message));

      inviteCard.append(inviteIcon, inviteDetails, playButton);
      bubble.append(meta, inviteCard);
    } else {
      bubble.append(meta, text);
    }
    chatHistory.append(bubble);
  });

  chatHistory.scrollTop = chatHistory.scrollHeight;
}

async function updateChatControls() {
  const selectedProfile = findProfileByFriendCode(selectedChatFriendCode);
  chatSelectedFriend.textContent = selectedProfile ? selectedProfile.nickname : "Choose a friend to chat with.";
  const canChat = Boolean(selectedProfile && isApprovedFriendCode(selectedChatFriendCode));
  chatSendQuizButton.disabled = !canChat;
  sendChatMessageButton.disabled = !canChat;
  clearChatButton.disabled = !canChat;
  chatBlockFriendButton.disabled = !canChat;
  chatRemoveFriendButton.disabled = !canChat;
  chatMessageInput.disabled = !canChat;

  if (!canChat) {
    chatQuizPanel.classList.add("hidden");
    activeOnlineChatMessages = [];
    chatLoadedFromSupabase = false;
    renderChatHistory();
    return;
  }

  await loadActiveChatMessages();
}

function openChatQuizPanel() {
  if (!selectedChatFriendCode || !isApprovedFriendCode(selectedChatFriendCode)) {
    chatMessage.textContent = "Choose a friend first.";
    return;
  }

  chatQuizMessage.textContent = "";
  const hasQuizzes = renderChatQuizSelect();
  if (!hasQuizzes) {
    chatQuizMessage.textContent = "You do not have any quizzes yet. Create a quiz first.";
  }
  chatQuizPanel.classList.remove("hidden");
}

async function sendQuizFromChat() {
  if (!selectedChatFriendCode || !isApprovedFriendCode(selectedChatFriendCode)) {
    chatQuizMessage.textContent = "Choose a friend first.";
    return;
  }

  const quiz = findSavedQuizById(chatQuizSelect.value);
  const friendProfile = getFriendProfileSnapshot(selectedChatFriendCode);

  if (!quiz) {
    chatQuizMessage.textContent = "You do not have any quizzes yet. Create a quiz first.";
    return;
  }

  chatQuizMessage.textContent = `Sending quiz to ${friendProfile.nickname}...`;

  try {
    const invite = await sendQuizInviteToFriend(selectedChatFriendCode, quiz);
    chatQuizMessage.textContent = invite.online
      ? `Quiz sent to ${friendProfile.nickname}!`
      : "Quiz invite saved here, but online chat needs the updated messages table.";
    renderChatHistory();
  } catch (error) {
    console.error("Friend quiz invite error:", error);
    chatQuizMessage.textContent = String(error?.message || "").includes("Short friend links need")
      ? getOnlineSharingSetupMessage()
      : "Quiz could not be sent yet. Check Supabase setup and try again.";
  }
}

async function sendChatMessage(messageText, messageType = "typed", sticker = "") {
  const selectedProfile = findProfileByFriendCode(selectedChatFriendCode);

  if (!activePlayer || !selectedProfile || !isApprovedFriendCode(selectedChatFriendCode)) {
    chatMessage.textContent = "Choose a friend first.";
    return;
  }

  const validation = validateChatMessage(messageText);

  if (!validation.ok) {
    chatMessage.textContent = validation.message;
    return;
  }

  try {
    const result = await saveFriendMessage(selectedChatFriendCode, validation.text, messageType, sticker);
    chatMessageInput.value = "";
    chatMessage.textContent = result.online
      ? "Message sent online."
      : "Message saved temporarily because online chat could not connect.";
    renderChatHistory();
  } catch (error) {
    console.error("Friend chat message error:", error);
    chatMessage.textContent = "Please choose an added friend first.";
  }
}

function sendTypedChatMessage() {
  sendChatMessage(chatMessageInput.value, "typed");
}

function removeSelectedChatFriend() {
  if (!selectedChatFriendCode) {
    chatMessage.textContent = "Choose a friend first.";
    return;
  }

  removeFriend(selectedChatFriendCode);
  selectedChatFriendCode = "";
  renderChatFriends();
  updateChatControls();
}

function blockSelectedChatFriend() {
  if (!selectedChatFriendCode) {
    chatMessage.textContent = "Choose a friend first.";
    return;
  }

  blockFriend(selectedChatFriendCode);
  selectedChatFriendCode = "";
  renderChatFriends();
  updateChatControls();
}

function clearSelectedChat() {
  if (!selectedChatFriendCode) {
    chatMessage.textContent = "Choose a friend first.";
    return;
  }

  const shouldClear = confirm("Clear this chat history from this app?");

  if (!shouldClear) {
    return;
  }

  const chatId = getChatId(selectedChatFriendCode);
  const messages = getChatMessages().filter((message) => message.chatId !== chatId);
  saveChatMessages(messages);
  chatMessage.textContent = "Chat cleared from this app.";
  renderChatHistory();
}

function renderFriends() {
  if (!activePlayer) {
    return;
  }

  activePlayer = ensureFriendProfile(activePlayer);
  saveActivePlayerProfile();
  myFriendCode.textContent = activePlayer.friendCode;
  friendsList.innerHTML = "";

  const friendCodes = Array.isArray(activePlayer.friends) ? activePlayer.friends : [];

  if (friendCodes.length === 0) {
    friendsList.innerHTML = '<p class="empty-leaderboard">No friends added yet. Share your code with someone you know.</p>';
    return;
  }

  friendCodes.forEach((friendCode) => {
    const friendProfile = getFriendProfileSnapshot(friendCode);
    const row = document.createElement("article");
    row.className = "friend-entry";

    const avatar = document.createElement("div");
    renderAvatar(avatar, friendProfile.avatar || null);

    const details = document.createElement("div");
    details.className = "friend-details";

    const name = document.createElement("h3");
    name.textContent = friendProfile.nickname;

    const code = document.createElement("p");
    code.textContent = friendCode;

    const stars = document.createElement("p");
    stars.textContent = `Stars: ${friendProfile.stars || 0}`;

    details.append(name, code, stars, makeFriendPresenceBadge(friendProfile));

    const chatButton = document.createElement("button");
    chatButton.className = "save-quiz-button";
    chatButton.type = "button";
    chatButton.textContent = "Open Chat";
    chatButton.addEventListener("click", () => openChatWithFriend(friendCode));

    const sendQuizButton = document.createElement("button");
    sendQuizButton.className = "secondary-button";
    sendQuizButton.type = "button";
    sendQuizButton.textContent = "Send Quiz";
    sendQuizButton.addEventListener("click", () => openFriendActionPanel(friendCode));

    const boxOfLiesButton = document.createElement("button");
    boxOfLiesButton.className = "secondary-button";
    boxOfLiesButton.type = "button";
    boxOfLiesButton.textContent = "Box of Lies";
    boxOfLiesButton.addEventListener("click", () => showBoxOfLies(friendCode));

    const tradeButton = document.createElement("button");
    tradeButton.className = "secondary-button";
    tradeButton.type = "button";
    tradeButton.textContent = "Trade";
    tradeButton.addEventListener("click", () => showTradingGame(friendCode));

    const removeButton = document.createElement("button");
    removeButton.className = "secondary-button";
    removeButton.type = "button";
    removeButton.textContent = "Remove Friend";
    removeButton.addEventListener("click", () => removeFriend(friendCode));

    const blockButton = document.createElement("button");
    blockButton.className = "secondary-button";
    blockButton.type = "button";
    blockButton.textContent = "Block Friend";
    blockButton.addEventListener("click", () => blockFriend(friendCode));

    row.append(avatar, details, chatButton, sendQuizButton, boxOfLiesButton, tradeButton, removeButton, blockButton);
    friendsList.append(row);
  });

  renderFriendActivity();
}

function makeDiaryChoicePanel(panel, title, options, name, lockedMessage, isUnlocked) {
  panel.innerHTML = "";

  const heading = document.createElement("h3");
  heading.textContent = title;
  panel.append(heading);

  if (!isUnlocked) {
    const lockedNote = document.createElement("p");
    lockedNote.className = "locked-diary-note";
    lockedNote.textContent = lockedMessage;
    panel.append(lockedNote);
    return;
  }

  const choices = document.createElement("div");
  choices.className = "diary-choice-grid";

  options.forEach((option, index) => {
    const label = document.createElement("label");
    label.className = "diary-choice";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = name;
    input.value = option;

    if (index === 0) {
      input.checked = true;
    }

    const span = document.createElement("span");
    span.textContent = option;
    label.append(input, span);
    choices.append(label);
  });

  panel.append(choices);
}

function renderDiaryUnlockPanels() {
  makeDiaryChoicePanel(
    diaryMoodPanel,
    "Mood Tracker",
    diaryMoodOptions,
    "diary-mood",
    "Buy Mood Tracker in the shop to track moods.",
    hasPurchased("mood-tracker"),
  );
  makeDiaryChoicePanel(
    diaryStickerPanel,
    "Secret Sticker Pack",
    diaryStickerOptions,
    "diary-sticker",
    "Buy Secret Sticker Pack in the shop to use stickers.",
    hasPurchased("secret-sticker-pack"),
  );
}

function getSelectedDiaryChoice(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function renderDiaryHistory() {
  const entries = getDiaryEntries();
  diaryHistory.innerHTML = "";

  if (entries.length === 0) {
    diaryHistory.innerHTML = '<p class="empty-leaderboard">No diary entries yet.</p>';
    return;
  }

  entries.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "diary-entry";

    const meta = document.createElement("p");
    meta.className = "diary-entry-meta";
    meta.textContent = [entry.date, entry.time, entry.mood && `Mood: ${entry.mood}`, entry.sticker && `Sticker: ${entry.sticker}`].filter(Boolean).join(" • ");

    const text = document.createElement("p");
    text.className = "diary-entry-text";
    text.textContent = entry.text;

    const deleteButton = document.createElement("button");
    deleteButton.className = "secondary-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteDiaryEntry(entry.id));

    card.append(meta, text, deleteButton);
    diaryHistory.append(card);
  });
}

function deleteDiaryEntry(entryId) {
  const shouldDelete = confirm("Delete this diary entry?");

  if (!shouldDelete) {
    return;
  }

  saveDiaryEntries(getDiaryEntries().filter((entry) => entry.id !== entryId));
  diaryMessage.textContent = "Diary entry deleted.";
  renderDiaryHistory();
}

function renderShop() {
  const stars = getStarBalance();
  const rewards = getPurchasedRewards();
  const visibleItems = shopItems.filter((item) => item.category === activeShopCategory);
  const activeTheme = getActiveTheme();
  shopStars.textContent = `⭐ Stars: ${stars}`;
  shopTabs.innerHTML = "";
  shopList.innerHTML = "";

  shopCategories.forEach((category) => {
    const tab = document.createElement("button");
    tab.className = category === activeShopCategory ? "shop-tab active" : "shop-tab";
    tab.type = "button";
    tab.textContent = category;
    tab.addEventListener("click", () => {
      activeShopCategory = category;
      renderShop();
    });
    shopTabs.append(tab);
  });

  if (activeShopCategory === "Themes") {
    const defaultCard = document.createElement("article");
    defaultCard.className = activeTheme === "default" ? "shop-item active-theme-item" : "shop-item";

    const icon = document.createElement("div");
    icon.className = "shop-icon";
    icon.textContent = "✦";

    const details = document.createElement("div");
    details.className = "shop-details";

    const meta = document.createElement("p");
    meta.className = "shop-category";
    meta.textContent = "Themes";

    const title = document.createElement("h3");
    title.textContent = "Default Theme";

    const description = document.createElement("p");
    description.className = "shop-description";
    description.textContent = "The original light mystery look.";

    const status = document.createElement("p");
    status.className = "theme-status";
    status.textContent = activeTheme === "default" ? "Current theme" : `Current theme: ${getActiveThemeName()}`;

    const action = document.createElement("button");
    action.className = activeTheme === "default" ? "purchased-label" : "secondary-button";
    action.type = "button";
    action.textContent = activeTheme === "default" ? "Active Theme" : "Apply Theme";
    action.disabled = activeTheme === "default";
    action.addEventListener("click", () => setActiveTheme("default"));

    details.append(meta, title, description, status, action);
    defaultCard.append(icon, details);
    shopList.append(defaultCard);
  }

  visibleItems.forEach((item) => {
    const isPurchased = rewards.includes(item.id);
    const isTheme = isThemeReward(item);
    const isGameReward = isGamePack(item);
    const isDiaryItem = isDiaryReward(item);
    const isActiveTheme = activeTheme === item.id;
    const card = document.createElement("article");
    card.className = isActiveTheme ? "shop-item active-theme-item" : "shop-item";

    const icon = document.createElement("div");
    icon.className = "shop-icon";
    icon.textContent = item.icon;

    const details = document.createElement("div");
    details.className = "shop-details";

    const meta = document.createElement("p");
    meta.className = "shop-category";
    meta.textContent = item.category;

    const title = document.createElement("h3");
    title.textContent = item.name;

    const cost = document.createElement("p");
    cost.className = "shop-cost";
    cost.textContent = `⭐ ${item.cost} stars`;

    const description = document.createElement("p");
    description.className = "shop-description";
    description.textContent = item.description;

    const effect = document.createElement("p");
    effect.className = "shop-effect";
    effect.innerHTML = `<strong>What this does:</strong> ${item.effect}`;

    const action = document.createElement("button");
    action.className = isPurchased ? "purchased-label" : "save-quiz-button";
    action.type = "button";
    action.textContent = isPurchased && isGameReward
      ? getPurchasedGamePackLabel(item)
      : isPurchased && isDiaryItem
        ? getPurchasedDiaryRewardLabel(item)
        : isPurchased
          ? "Purchased"
          : "Buy";
    action.disabled = isPurchased;

    if (!isPurchased) {
      action.addEventListener("click", () => buyShopItem(item));
    }

    details.append(meta, title, cost, description, effect, action);

    if (isTheme && isPurchased) {
      const themeButton = document.createElement("button");
      themeButton.className = isActiveTheme ? "purchased-label" : "secondary-button";
      themeButton.type = "button";
      themeButton.textContent = isActiveTheme ? "Active Theme" : "Apply Theme";
      themeButton.disabled = isActiveTheme;
      themeButton.addEventListener("click", () => setActiveTheme(item.id));
      details.append(themeButton);
    }

    if (item.id === "daily-diary" && isPurchased) {
      const diaryButton = document.createElement("button");
      diaryButton.className = "secondary-button";
      diaryButton.type = "button";
      diaryButton.textContent = "Open Diary";
      diaryButton.addEventListener("click", showDiary);
      details.append(diaryButton);
    }

    card.append(icon, details);
    shopList.append(card);
  });
}

function buyShopItem(item) {
  const rewards = getPurchasedRewards();

  if (rewards.includes(item.id)) {
    renderShop();
    return;
  }

  const stars = getStarBalance();

  if (stars < item.cost) {
    shopMessage.textContent = "You need more stars to unlock this.";
    return;
  }

  setStarBalance(stars - item.cost);
  savePurchasedRewards([...rewards, item.id]);
  shopMessage.textContent = `${item.name} unlocked.`;
  applyPurchasedEffects();
  updateGamePackStatuses();
  renderShop();
}

function saveDiaryNote() {
  if (!hasPurchased("daily-diary")) {
    diaryMessage.textContent = "Unlock Daily Diary in the shop first.";
    return;
  }

  const text = diaryNote.value.trim();

  if (!text) {
    diaryMessage.textContent = "Write a diary note before saving.";
    return;
  }

  const now = new Date();
  const entry = {
    id: crypto.randomUUID(),
    date: now.toISOString().slice(0, 10),
    time: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    text,
    mood: hasPurchased("mood-tracker") ? getSelectedDiaryChoice("diary-mood") : "",
    sticker: hasPurchased("secret-sticker-pack") ? getSelectedDiaryChoice("diary-sticker") : "",
    createdAt: now.getTime(),
  };

  saveDiaryEntries([entry, ...getDiaryEntries()]);
  diaryNote.value = "";
  diaryMessage.textContent = "Diary entry saved.";
  renderDiaryHistory();
}

function resetEverything() {
  const shouldReset = confirm("This will delete your saved quiz, leaderboard, stars, rewards, diary, and settings. Are you sure?");

  if (!shouldReset) {
    return;
  }

  const typedWord = prompt("Type RESET to delete everything.");

  if (typedWord !== "RESET") {
    return;
  }

  localStorage.clear();
  questions = [];
  currentQuestion = 0;
  correctAnswers = 0;
  latestResult = null;
  activeQuizSource = "custom";
  activeQuizMode = "scored";
  activePlayer = null;
  guestMode = false;
  renderCreatorFields(minQuestions, []);
  renderLeaderboard();
  showPlayerGate();
}

function getAuthDisplayEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getFallbackNicknameFromEmail(email) {
  const localPart = getAuthDisplayEmail(email).split("@")[0] || "MysteryPlayer";
  const safeNickname = cleanPlayerNickname(localPart.replace(/[^a-z0-9_-]/gi, "").slice(0, 20));
  return safeNickname || "MysteryPlayer";
}

function buildProfileForAuth(user, preferredNickname = "") {
  const localProfile = activePlayer || loadCurrentPlayer();
  const nickname = cleanPlayerNickname(preferredNickname || localProfile?.nickname || user?.user_metadata?.nickname || getFallbackNicknameFromEmail(user?.email));
  const profiles = getPlayerProfiles();
  const avatar = getUnlockedAvatar(localProfile?.avatar || getSelectedAvatar() || createDefaultAvatar());

  return ensureFriendProfile({
    stars: localProfile?.stars || getStarBalance(),
    purchasedRewards: localProfile?.purchasedRewards || getPurchasedRewards(),
    diaryAccess: localProfile?.diaryAccess || hasPurchased("daily-diary"),
    diaryNotes: localProfile?.diaryNotes || getDiaryNotes(),
    settings: {},
    createdAt: Date.now(),
    ...localProfile,
    userId: user?.id || onlineAccountStorage.userId,
    nickname,
    friendCode: localProfile?.friendCode || generateFriendCode(nickname, profiles),
    avatar,
  });
}

function mergeDiaryEntryLists(firstEntries, secondEntries) {
  const entriesByKey = new Map();

  [...normalizeDiaryEntries(firstEntries), ...normalizeDiaryEntries(secondEntries)].forEach((entry) => {
    const key = entry.id || `${entry.createdAt}:${entry.text}`;
    entriesByKey.set(key, {
      ...entriesByKey.get(key),
      ...entry,
    });
  });

  return [...entriesByKey.values()].sort((firstEntry, secondEntry) => secondEntry.createdAt - firstEntry.createdAt);
}

function mergeSavedQuizLists(firstQuizzes, secondQuizzes) {
  const quizzesById = new Map();

  [...(firstQuizzes || []), ...(secondQuizzes || [])].forEach((quiz, index) => {
    const normalizedQuiz = normalizeSavedQuizRecord(quiz, `Quiz ${index + 1}`);

    if (normalizedQuiz.questions.length === 0) {
      return;
    }

    quizzesById.set(normalizedQuiz.id, {
      ...quizzesById.get(normalizedQuiz.id),
      ...normalizedQuiz,
    });
  });

  return [...quizzesById.values()].sort((firstQuiz, secondQuiz) => new Date(secondQuiz.updatedAt) - new Date(firstQuiz.updatedAt));
}

async function saveLocalAccountDataToSupabase() {
  if (!onlineAccountStorage.isLoggedIn || !activePlayer) {
    return;
  }

  onlineAccountSyncInProgress = true;

  try {
    await onlineAccountStorage.saveProfile(activePlayer).catch((error) => console.error("Supabase profile import error:", error));
    await onlineAccountStorage.savePurchases(getPurchasedRewards()).catch((error) => console.error("Supabase purchases import error:", error));
    await onlineAccountStorage.saveDiaryEntries(getDiaryEntries()).catch((error) => console.error("Supabase diary import error:", error));
    await onlineAccountStorage.saveQuizzes(getSavedQuizzes()).catch((error) => console.error("Supabase quizzes import error:", error));
  } finally {
    onlineAccountSyncInProgress = false;
  }
}

async function loadSupabaseAccountDataToLocal() {
  if (!onlineAccountStorage.isLoggedIn) {
    return null;
  }

  onlineAccountSyncInProgress = true;

  try {
    const [onlineProfile, onlinePurchases, onlineDiaryEntries, onlineQuizzes] = await Promise.all([
      onlineAccountStorage.loadProfile().catch((error) => {
        console.error("Supabase profile load error:", error);
        return null;
      }),
      onlineAccountStorage.loadPurchases().catch(() => []),
      onlineAccountStorage.loadDiaryEntries().catch(() => []),
      onlineAccountStorage.loadQuizzes().catch(() => []),
    ]);

    if (onlineProfile) {
      activePlayer = ensureFriendProfile({
        ...activePlayer,
        ...onlineProfile,
        purchasedRewards: [...new Set([...(activePlayer?.purchasedRewards || []), ...onlinePurchases])],
        diaryAccess: [...new Set([...(activePlayer?.purchasedRewards || []), ...onlinePurchases])].includes("daily-diary"),
      });
      localStorage.setItem(currentPlayerKey, activePlayer.nickname);
      savePlayerProfiles(getPlayerProfiles().filter((profile) => normalizeNickname(profile.nickname) !== normalizeNickname(activePlayer.nickname)).concat(activePlayer));
      replaceUsedNickname("", activePlayer.nickname);
    }

    if (onlinePurchases.length > 0 && activePlayer) {
      activePlayer = ensureFriendProfile({
        ...activePlayer,
        purchasedRewards: [...new Set([...(activePlayer.purchasedRewards || []), ...onlinePurchases])],
        diaryAccess: [...new Set([...(activePlayer.purchasedRewards || []), ...onlinePurchases])].includes("daily-diary"),
      });
      savePlayerProfiles(getPlayerProfiles().map((profile) => normalizeNickname(profile.nickname) === normalizeNickname(activePlayer.nickname) ? activePlayer : profile));
    }

    const mergedDiaryEntries = mergeDiaryEntryLists(getDiaryEntries(), onlineDiaryEntries);
    localStorage.setItem(diaryEntriesKey, JSON.stringify(mergedDiaryEntries));

    const mergedQuizzes = mergeSavedQuizLists(getSavedQuizzes(), onlineQuizzes);
    localStorage.setItem(savedQuizzesKey, JSON.stringify(mergedQuizzes));

    if (onlineProfile?.activeTheme) {
      localStorage.setItem(activeThemeKey, onlineProfile.activeTheme);
    }

    return activePlayer;
  } finally {
    onlineAccountSyncInProgress = false;
  }
}

async function openSupabaseAccount(session, preferredNickname = "") {
  if (session?.access_token) {
    saveSupabaseAuthSession(session);
  }

  const user = session?.user || getSupabaseAuthUser();
  const existingOnlineProfile = await onlineAccountStorage.loadProfile().catch(() => null);
  const profile = existingOnlineProfile || buildProfileForAuth(user, preferredNickname);

  setActivePlayer(profile);
  await saveLocalAccountDataToSupabase();
  await loadSupabaseAccountDataToLocal();
  updateProfileBar();
  applyPurchasedEffects();
  updateGamePackStatuses();
  authMessage.textContent = "Online login is ready. Your player data can sync across devices.";
  showStart();
}

async function restoreSupabaseAccount() {
  const session = getSupabaseAuthSession();

  if (!session?.access_token) {
    return false;
  }

  const expiresSoon = session.expires_at && session.expires_at * 1000 < Date.now() + 60000;

  if (expiresSoon) {
    try {
      await onlineAccountStorage.refreshSession();
    } catch (error) {
      console.error("Supabase session refresh error:", error);
      clearSupabaseAuthSession();
      return false;
    }
  }

  try {
    await openSupabaseAccount(getSupabaseAuthSession());
    return true;
  } catch (error) {
    console.error("Supabase account restore error:", error);
    return false;
  }
}

async function handleAuthSignup(event) {
  event.preventDefault();

  const email = getAuthDisplayEmail(authSignupEmail.value);
  const password = authSignupPassword.value;
  const nicknameCheck = validateNickname(authSignupNickname.value, { currentNickname: activePlayer?.nickname || "" });

  if (nicknameCheck.message) {
    authMessage.textContent = nicknameCheck.message;
    return;
  }

  if (password.length < 6) {
    authMessage.textContent = "Please choose a password with at least 6 characters.";
    return;
  }

  authMessage.textContent = "Creating the parent/guardian online account...";

  try {
    const session = await onlineAccountStorage.signUp({
      email,
      password,
      nickname: nicknameCheck.displayName,
    });

    if (!session?.access_token) {
      authMessage.textContent = "Account created. Check the parent/guardian email if Supabase asks for confirmation, then log in here.";
      return;
    }

    await openSupabaseAccount(session, nicknameCheck.displayName);
    authSignupForm.reset();
  } catch (error) {
    console.error("Supabase signup error:", error);
    authMessage.textContent = "Sign up did not work yet. Check the parent/guardian email, password, and Supabase settings.";
  }
}

async function handleAuthLogin(event) {
  event.preventDefault();

  const email = getAuthDisplayEmail(authLoginEmail.value);
  const password = authLoginPassword.value;

  if (!email || !password) {
    authMessage.textContent = "Please enter the parent/guardian login email and password.";
    return;
  }

  authMessage.textContent = "Logging in online...";

  try {
    const session = await onlineAccountStorage.signIn({ email, password });
    await openSupabaseAccount(session);
    authLoginForm.reset();
  } catch (error) {
    console.error("Supabase login error:", error);
    authMessage.textContent = "Online login did not open. Check the parent/guardian email and password.";
  }
}

async function logoutSupabaseAccount() {
  await onlineAccountStorage.signOut();
  usernamePinSession = null;
  activePlayer = null;
  guestMode = false;
  localStorage.removeItem(currentPlayerKey);
  updateProfileBar();
  showPlayerGate();
}

function validateUsernamePin(username, pin) {
  const originalUsername = String(username || "");
  const displayName = cleanPlayerNickname(originalUsername);
  const normalizedName = normalizeNickname(displayName);

  if (!normalizedName) {
    return { ok: false, message: "Please enter a nickname." };
  }

  if (originalUsername.trim().length > 20) {
    return { ok: false, message: "Please choose a nickname under 20 characters." };
  }

  if (looksLikeFullName(displayName)) {
    return { ok: false, message: "Use a nickname, not your real full name." };
  }

  if (!/^\d{4,6}$/.test(pin)) {
    return { ok: false, message: "Please enter a 4 to 6 digit PIN." };
  }

  return {
    ok: true,
    username: displayName,
    normalizedUsername: normalizedName,
    pin,
  };
}

function collectLocalProgressSnapshot() {
  return {
    hasActivePlayer: Boolean(activePlayer),
    stars: activePlayer?.stars || Number.parseInt(localStorage.getItem(guestStarsKey) || "0", 10) || 0,
    purchases: getPurchasedRewards(),
    quizzes: getSavedQuizzes(),
    avatar: activePlayer?.avatar || createDefaultAvatar(),
    activeTheme: getActiveTheme(),
  };
}

function hasLocalProgressSnapshot(snapshot) {
  return Boolean(
    snapshot.hasActivePlayer
    || snapshot.stars > 0
    || snapshot.purchases.length > 0
    || snapshot.quizzes.length > 0
    || snapshot.activeTheme !== "default"
  );
}

function getUsernameAccountErrorMessage(error) {
  const message = String(error?.message || "");

  if (message.includes("USERNAME_TAKEN") || message.includes("duplicate key")) {
    return "I’m sorry, but someone else has this name. Please choose something else.";
  }

  if (message.includes("INVALID_LOGIN")) {
    return "Username or PIN is incorrect. Please try again.";
  }

  if (message.includes("INVALID_PIN")) {
    return "Please enter a 4 to 6 digit PIN.";
  }

  return "Username login is not ready yet. Check Supabase setup and try again.";
}

async function openUsernameAccount(account, pin, { askImport = true } = {}) {
  const safeAccount = normalizeUsernameAccount(account);

  if (!safeAccount) {
    usernameLoginMessage.textContent = "Username or PIN is incorrect. Please try again.";
    return;
  }

  const localSnapshot = collectLocalProgressSnapshot();
  const shouldImport = askImport && hasLocalProgressSnapshot(localSnapshot)
    ? confirm("Do you want to save this local progress to this player account?")
    : false;
  const onlineProfile = profileFromUsernameAccount(safeAccount);
  const profile = shouldImport
    ? ensureFriendProfile({
        ...onlineProfile,
        stars: Math.max(onlineProfile.stars || 0, localSnapshot.stars || 0),
        purchasedRewards: [...new Set([...(onlineProfile.purchasedRewards || []), ...localSnapshot.purchases])],
        diaryAccess: [...new Set([...(onlineProfile.purchasedRewards || []), ...localSnapshot.purchases])].includes("daily-diary"),
        avatar: localSnapshot.avatar || onlineProfile.avatar,
      })
    : onlineProfile;
  const localQuizzes = getSavedQuizzes();
  const onlineQuizzes = mergeSavedQuizLists([], safeAccount.savedQuizzes || []);
  const visibleQuizzes = shouldImport
    ? mergeSavedQuizLists(onlineQuizzes, localSnapshot.quizzes)
    : mergeSavedQuizLists(localQuizzes, onlineQuizzes);

  onlineAccountSyncInProgress = true;
  setActivePlayer(profile);
  localStorage.setItem(savedQuizzesKey, JSON.stringify(visibleQuizzes));
  localStorage.setItem(activeThemeKey, shouldImport ? localSnapshot.activeTheme : safeAccount.activeTheme);
  usernamePinSession = {
    username: safeAccount.username,
    pin,
  };
  onlineAccountSyncInProgress = false;

  if (shouldImport) {
    await onlineUsernameAccounts.saveCurrentProgress().catch((error) => {
      console.error("Supabase username import error:", error);
      usernameLoginMessage.textContent = "Logged in, but local progress could not be saved online yet.";
    });
  }

  usernameLoginForm.reset();
  usernameCreateForm.reset();
  usernameLoginMessage.textContent = "Player account opened.";
  usernameCreateMessage.textContent = "";
  updateProfileBar();
  applyPurchasedEffects();
  updateGamePackStatuses();
  if (pendingGameInviteId) {
    const inviteId = pendingGameInviteId;
    pendingGameInviteId = "";
    await openGameInviteFromLink(inviteId);
    return;
  }

  showStart();
}

async function createUsernamePlayerAccount() {
  const validation = validateUsernamePin(usernameCreateName.value, usernameCreatePin.value);

  if (!validation.ok) {
    usernameCreateMessage.textContent = validation.message;
    return;
  }

  if (usernameCreatePin.value !== usernameCreateConfirmPin.value) {
    usernameCreateMessage.textContent = "Please make sure both PIN boxes match.";
    return;
  }

  usernameCreateMessage.textContent = "Creating player account...";

  try {
    const account = await onlineUsernameAccounts.createAccount({
      username: validation.username,
      pin: validation.pin,
      emojiAvatar: selectedAvatar?.emojiAvatar || activePlayer?.avatar?.emojiAvatar || defaultEmojiAvatar,
    });
    await openUsernameAccount(account, validation.pin, { askImport: true });
  } catch (error) {
    console.error("Username account create error:", error);
    usernameCreateMessage.textContent = getUsernameAccountErrorMessage(error);
  }
}

async function loginUsernamePlayerAccount() {
  const validation = validateUsernamePin(usernameLoginName.value, usernameLoginPin.value);

  if (!validation.ok) {
    usernameLoginMessage.textContent = validation.message;
    return;
  }

  usernameLoginMessage.textContent = "Checking username and PIN...";

  try {
    const account = await onlineUsernameAccounts.login({
      username: validation.username,
      pin: validation.pin,
    });

    if (!account) {
      usernameLoginMessage.textContent = "Username or PIN is incorrect. Please try again.";
      return;
    }

    await openUsernameAccount(account, validation.pin, { askImport: true });
  } catch (error) {
    console.error("Username login error:", error);
    usernameLoginMessage.textContent = getUsernameAccountErrorMessage(error);
  }
}

function createPlayer(event) {
  event.preventDefault();

  if (usernamePinSession && activePlayer) {
    const avatar = getUnlockedAvatar(getSelectedAvatar());
    updateActivePlayerProfile({ avatar });
    createPlayerMessage.textContent = "Avatar saved to your player account.";
    showStart();
    return;
  }

  const previousNickname = activePlayer?.nickname || "";
  const nicknameCheck = validateNickname(newPlayerNickname.value, { currentNickname: previousNickname });

  if (nicknameCheck.message) {
    createPlayerMessage.textContent = nicknameCheck.message;
    return;
  }

  const nickname = nicknameCheck.displayName;
  const profiles = getPlayerProfiles();
  const existingProfile = profiles.find((profile) => normalizeNickname(profile.nickname) === nicknameCheck.normalizedName);

  if (existingProfile && normalizeNickname(existingProfile.nickname) !== normalizeNickname(activePlayer?.nickname)) {
    createPlayerMessage.textContent = "I’m sorry, but someone else has this name. Please choose something else.";
    return;
  }

  const avatar = getUnlockedAvatar(getSelectedAvatar());
  const profile = {
    stars: 0,
    purchasedRewards: [],
    diaryAccess: false,
    diaryNotes: {},
    settings: {},
    createdAt: Date.now(),
    ...activePlayer,
    ...existingProfile,
    nickname,
    friendCode: activePlayer?.friendCode || existingProfile?.friendCode || generateFriendCode(nickname, profiles),
    friends: activePlayer?.friends || existingProfile?.friends || [],
    avatar,
  };

  const updatedProfiles = existingProfile || activePlayer
    ? profiles.map((savedProfile) => (
      normalizeNickname(savedProfile.nickname) === normalizeNickname(existingProfile?.nickname || previousNickname)
        ? profile
        : savedProfile
    ))
    : [...profiles, profile];

  savePlayerProfiles(updatedProfiles);
  replaceUsedNickname(previousNickname, nickname);
  syncNicknameAcrossSavedData(previousNickname, nickname, avatar);
  setActivePlayer(profile);
  createPlayerForm.reset();
  selectedAvatar = createDefaultAvatar();
  updateAvatarPreview();
  showStart();
}

function loginPlayer(event) {
  event.preventDefault();

  const nickname = cleanPlayerNickname(loginPlayerNickname.value);
  const profile = getPlayerProfiles().find((savedProfile) => normalizeNickname(savedProfile.nickname) === normalizeNickname(nickname));

  if (!profile) {
    loginPlayerMessage.textContent = "That player did not open. Check the nickname.";
    return;
  }

  setActivePlayer(profile);
  loginPlayerForm.reset();
  showStart();
}

function switchPlayer() {
  stopPresenceUpdates();
  usernamePinSession = null;
  activePlayer = null;
  guestMode = false;
  localStorage.removeItem(currentPlayerKey);
  showPlayerGate();
}

function handleQuestionTotalChange() {
  renderCreatorFields(questionTotalInput.value);
}

function handleQuizSave(event) {
  event.preventDefault();

  const quizQuestions = readCreatorQuestions();
  const missingFields = getMissingCreatorFields(quizQuestions);
  const quizTitle = quizTitleInput.value.trim();
  const quizTheme = quizThemeInput.value.trim();

  if (!quizTitle) {
    creatorMessage.textContent = "Add a quiz title first.";
    return;
  }

  if (missingFields.length > 0) {
    creatorMessage.textContent = `${missingFields[0]} Check the case cards, then try saving again.`;
    return;
  }

  const savedQuizzes = getSavedQuizzes();
  const now = new Date().toISOString();

  if (editingQuizId) {
    const existingQuiz = findSavedQuizById(editingQuizId);
    const updatedQuiz = normalizeSavedQuizRecord({
      ...existingQuiz,
      id: editingQuizId,
      title: quizTitle,
      theme: quizTheme,
      createdAt: existingQuiz?.createdAt || now,
      updatedAt: now,
      questions: quizQuestions,
    }, quizTitle);
    saveSavedQuizzes(savedQuizzes.map((quiz) => (quiz.id === editingQuizId ? updatedQuiz : quiz)));
    activeQuizId = updatedQuiz.id;
    creatorMessage.textContent = "Quiz updated safely in My Quizzes.";
    return;
  }

  const newQuiz = normalizeSavedQuizRecord({
    title: quizTitle,
    theme: quizTheme,
    createdAt: now,
    updatedAt: now,
    questions: quizQuestions,
  }, quizTitle);
  saveSavedQuizzes([...savedQuizzes, newQuiz]);
  editingQuizId = newQuiz.id;
  activeQuizId = newQuiz.id;
  creatorMessage.textContent = "New quiz saved safely in My Quizzes.";
}

function renderSafeQuizzes() {
  safeQuizList.innerHTML = "";

  safeQuizzes.forEach((quiz) => {
    const quizButton = document.createElement("button");
    quizButton.className = "safe-quiz-option";
    quizButton.type = "button";

    const title = document.createElement("span");
    title.className = "choice-title";
    title.textContent = quiz.title;

    const description = document.createElement("span");
    description.className = "choice-description";
    description.textContent = quiz.description;

    quizButton.append(title, description);
    quizButton.addEventListener("click", () => startQuiz(quiz.questions, "safe", quiz.mode || "scored"));
    safeQuizList.append(quizButton);
  });
}

function formatQuizDate(dateValue) {
  if (!dateValue) {
    return "Not saved yet";
  }

  return new Date(dateValue).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function renderMyQuizzes() {
  const savedQuizzes = getSavedQuizzes();
  myQuizzesList.innerHTML = "";

  if (savedQuizzes.length === 0) {
    myQuizzesList.innerHTML = '<p class="empty-leaderboard">You have not made any quizzes yet.</p>';
    return;
  }

  savedQuizzes.forEach((quiz) => {
    const card = document.createElement("article");
    card.className = "saved-quiz-card";

    const title = document.createElement("h3");
    title.textContent = quiz.title;

    const meta = document.createElement("p");
    meta.className = "saved-quiz-meta";
    meta.textContent = [
      quiz.theme && `Theme: ${quiz.theme}`,
      `${quiz.questions.length} questions`,
      `Created: ${formatQuizDate(quiz.createdAt)}`,
      `Edited: ${formatQuizDate(quiz.updatedAt)}`,
    ].filter(Boolean).join(" • ");

    const actions = document.createElement("div");
    actions.className = "saved-quiz-actions";

    const playButton = document.createElement("button");
    playButton.className = "save-quiz-button";
    playButton.type = "button";
    playButton.textContent = "Play";
    playButton.addEventListener("click", () => playSavedQuizById(quiz.id));

    const editButton = document.createElement("button");
    editButton.className = "secondary-button";
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => showQuizEditor(quiz.id));

    const duplicateButton = document.createElement("button");
    duplicateButton.className = "secondary-button";
    duplicateButton.type = "button";
    duplicateButton.textContent = "Duplicate";
    duplicateButton.addEventListener("click", () => duplicateSavedQuiz(quiz.id));

    const linkButton = document.createElement("button");
    linkButton.className = "secondary-button";
    linkButton.type = "button";
    linkButton.textContent = "Create Friend Link";
    linkButton.addEventListener("click", () => createFriendLinkForQuiz(quiz.id));

    const deleteButton = document.createElement("button");
    deleteButton.className = "secondary-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteSavedQuiz(quiz.id));

    actions.append(playButton, editButton, duplicateButton, linkButton, deleteButton);
    card.append(title, meta, actions);
    myQuizzesList.append(card);
  });
}

function playSavedQuizById(quizId) {
  const quiz = findSavedQuizById(quizId);

  if (!quiz) {
    showMyQuizzes();
    myQuizzesMessage.textContent = "That quiz could not be found.";
    return;
  }

  activeQuizId = quiz.id;
  startQuiz(quiz.questions, "custom", "scored", quiz.id);
}

function duplicateSavedQuiz(quizId) {
  const quiz = findSavedQuizById(quizId);

  if (!quiz) {
    return;
  }

  const now = new Date().toISOString();
  const duplicate = normalizeSavedQuizRecord({
    ...quiz,
    id: `quiz-${crypto.randomUUID()}`,
    title: `${quiz.title} Copy`,
    createdAt: now,
    updatedAt: now,
    questions: quiz.questions,
  });
  saveSavedQuizzes([...getSavedQuizzes(), duplicate]);
  renderMyQuizzes();
  myQuizzesMessage.textContent = "Quiz duplicated.";
}

function deleteSavedQuiz(quizId) {
  const shouldDelete = confirm("Are you sure you want to delete this quiz? This cannot be undone.");

  if (!shouldDelete) {
    return;
  }

  saveSavedQuizzes(getSavedQuizzes().filter((quiz) => quiz.id !== quizId));

  if (activeQuizId === quizId) {
    activeQuizId = "";
  }

  renderMyQuizzes();
  myQuizzesMessage.textContent = "Quiz deleted.";
}

function generateShortQuizId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let quizId = "QZ-";

  for (let index = 0; index < 5; index += 1) {
    quizId += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return quizId;
}

function buildShortFriendLink(quizId) {
  const friendUrl = new URL(window.location.href);
  friendUrl.search = "";
  friendUrl.hash = "";
  friendUrl.searchParams.set("quiz", quizId);
  return friendUrl.toString();
}

function getOnlineSharingSetupMessage() {
  return `Short friend links need ${onlineQuizProvider} config in config.js. The URL and publishable key must be available in the browser.`;
}

function getOnlineSharingRequestErrorMessage() {
  return `Supabase is connected, but the quiz could not be saved or loaded. Check the browser console, then check the quizzes and quiz_scores tables and policies in Supabase.`;
}

function showOnlineSharingNotReady(messageTarget, outputTarget = null) {
  if (outputTarget) {
    outputTarget.classList.add("hidden");
  }

  messageTarget.textContent = getOnlineSharingSetupMessage();
}

function showOnlineSharingRequestError(messageTarget, error, outputTarget = null) {
  console.error("Supabase friend link error:", error);

  if (outputTarget) {
    outputTarget.classList.add("hidden");
  }

  messageTarget.textContent = getOnlineSharingRequestErrorMessage();
}

async function createOnlineFriendLink(quiz) {
  if (!onlineQuizSharing.isConfigured) {
    throw new Error("Online quiz sharing is not configured yet.");
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const quizId = generateShortQuizId();

    try {
      await onlineQuizSharing.saveQuiz({
        quizId,
        title: quiz.title,
        theme: quiz.theme,
        questions: quiz.questions,
        creatorNickname: activePlayer?.nickname || "",
      });

      return buildShortFriendLink(quizId);
    } catch (error) {
      const isDuplicateId = String(error?.message || "").toLowerCase().includes("duplicate")
        || String(error?.code || "") === "23505";

      if (!isDuplicateId || attempt === 4) {
        throw error;
      }
    }
  }

  throw new Error("Could not create a unique quiz ID.");
}

function createFriendLink() {
  if (!editingQuizId) {
    friendLinkMessage.textContent = "Save this quiz first, then I can make a friend link.";
    friendLinkOutputWrap.classList.add("hidden");
    return;
  }

  const savedQuiz = findSavedQuizById(editingQuizId);
  const savedQuestions = savedQuiz?.questions || [];

  if (savedQuestions.length === 0) {
    friendLinkMessage.textContent = "Save your quiz first, then I can make a friend link.";
    friendLinkOutputWrap.classList.add("hidden");
    return;
  }

  if (!onlineQuizSharing.isConfigured) {
    showOnlineSharingNotReady(friendLinkMessage, friendLinkOutputWrap);
    return;
  }

  createOnlineFriendLink(savedQuiz).then((friendLink) => {
    friendLinkOutput.value = friendLink;
    friendLinkOutputWrap.classList.remove("hidden");
    friendLinkMessage.textContent = "Short friend link ready. It only contains a quiz ID.";
  }).catch((error) => {
    showOnlineSharingRequestError(friendLinkMessage, error, friendLinkOutputWrap);
  });
}

function createFriendLinkForQuiz(quizId) {
  const quiz = findSavedQuizById(quizId);

  if (!quiz) {
    myQuizzesMessage.textContent = "That quiz could not be found.";
    return;
  }

  if (!onlineQuizSharing.isConfigured) {
    showOnlineSharingNotReady(myQuizzesMessage);
    return;
  }

  createOnlineFriendLink(quiz).then(async (friendLink) => {
    try {
      await navigator.clipboard.writeText(friendLink);
      myQuizzesMessage.textContent = `Short friend link copied for ${quiz.title}.`;
    } catch {
      myQuizzesMessage.textContent = `Short friend link for ${quiz.title}: ${friendLink}`;
    }
  }).catch((error) => {
    showOnlineSharingRequestError(myQuizzesMessage, error);
  });
}

async function copyFriendLink() {
  if (!friendLinkOutput.value) {
    friendLinkMessage.textContent = "Create a friend link first.";
    return;
  }

  try {
    await navigator.clipboard.writeText(friendLinkOutput.value);
    friendLinkMessage.textContent = "Friend link copied.";
  } catch {
    friendLinkOutput.select();
    document.execCommand("copy");
    friendLinkMessage.textContent = "Friend link copied.";
  }
}

function parseSharedQuizCode(code) {
  const parsedCode = JSON.parse(code);
  const quizQuestions = Array.isArray(parsedCode) ? parsedCode : parsedCode.questions;
  return normalizeQuizQuestions(quizQuestions);
}

async function openOnlineQuizFromLink(quizId) {
  hideMainSections();
  sharedQuizMode = "online-link";
  currentSharedQuiz = null;
  sharedLinkQuestions = [];
  sharedQuizCard.classList.remove("hidden");
  sharedQuizCode.value = "";
  sharedQuizMessage.textContent = "Loading shared quiz...";
  activeOnlineQuizId = quizId;
  onlineLeaderboardEntries = [];
  manualSharedQuizPanel.classList.add("hidden");
  sharedLinkPanel.classList.remove("hidden");
  startSharedLinkQuizButton.classList.add("hidden");

  if (!onlineQuizSharing.isConfigured) {
    sharedQuizMessage.textContent = "Short friend links need Supabase config in config.js before this quiz can load.";
    return true;
  }

  try {
    const onlineQuiz = await onlineQuizSharing.loadQuiz(quizId);
    currentSharedQuiz = onlineQuiz;
    sharedLinkQuestions = normalizeQuizQuestions(currentSharedQuiz?.questions || []);
    onlineLeaderboardEntries = sortLeaderboard(await onlineQuizSharing.loadScores(quizId));
  } catch (error) {
    console.error("Supabase shared quiz load error:", error);
    currentSharedQuiz = null;
    sharedLinkQuestions = [];
    onlineLeaderboardEntries = [];
    sharedQuizMessage.textContent = "This quiz link could not be loaded. Please ask your friend to send it again.";
    return true;
  }

  if (sharedLinkQuestions.length === 0) {
    currentSharedQuiz = null;
    sharedQuizMessage.textContent = "This quiz link could not be loaded. Please ask your friend to send it again.";
    return true;
  }

  startSharedLinkQuizButton.classList.remove("hidden");
  sharedQuizMessage.textContent = "";
  return true;
}

async function loadSharedQuizFromUrl() {
  const quizId = new URLSearchParams(window.location.search).get("quiz");

  if (!quizId) {
    return false;
  }

  return openOnlineQuizFromLink(quizId);
}

function loadSharedQuiz() {
  if (sharedQuizMode === "online-link") {
    return;
  }

  let sharedQuestions = [];

  try {
    sharedQuestions = parseSharedQuizCode(sharedQuizCode.value.trim());
  } catch {
    sharedQuizMessage.textContent = "That code did not open. Check that it was copied fully, then try again.";
    return;
  }

  if (sharedQuestions.length === 0) {
    sharedQuizMessage.textContent = "That code needs questions, 4 answers for each question, and a correct answer number.";
    return;
  }

  activeOnlineQuizId = "";
  onlineLeaderboardEntries = [];
  currentSharedQuiz = null;
  sharedQuizMessage.textContent = "Shared quiz loaded.";
  startQuiz(sharedQuestions, "shared");
}

function startSharedLinkQuiz() {
  const quizQuestions = sharedQuizMode === "online-link"
    ? normalizeQuizQuestions(currentSharedQuiz?.questions || sharedLinkQuestions)
    : sharedLinkQuestions;

  if (quizQuestions.length === 0) {
    sharedQuizMessage.textContent = sharedQuizMode === "online-link"
      ? "This quiz link could not be loaded. Please ask your friend to send it again."
      : "This quiz link does not look right. Please ask your friend to send it again.";
    return;
  }

  startQuiz(quizQuestions, sharedQuizMode === "online-link" ? "online" : "shared", "scored", activeOnlineQuizId);
}

function replayCurrentQuiz() {
  if (questions.length > 0) {
    startQuiz(questions, activeQuizSource, activeQuizMode, activeQuizId);
    return;
  }

  showStart();
}

function goHome() {
  showStart();
}

heroLoginButton.addEventListener("click", showUsernameLogin);
heroGuestButton.addEventListener("click", useGuestMode);
playBestieGameButton.addEventListener("click", showBestieQuizHome);
playWouldYouRatherGameButton.addEventListener("click", () => startMiniGame("wouldYouRather"));
playThisOrThatGameButton.addEventListener("click", () => startMiniGame("thisOrThat"));
playMysteryGameButton.addEventListener("click", () => startMiniGame("mysteryPersonality"));
playFavouriteGameButton.addEventListener("click", () => startMiniGame("guessFavourite"));
playBoxOfLiesGameButton.addEventListener("click", () => showBoxOfLies());
playTradingGameButton.addEventListener("click", () => showTradingGame());
featureBestieQuizButton.addEventListener("click", showBestieQuizHome);
featureGamesButton.addEventListener("click", showGames);
featureMyQuizzesButton.addEventListener("click", showMyQuizzes);
featureFriendLinksButton.addEventListener("click", showSharedQuiz);
featureFriendsButton.addEventListener("click", showFriends);
featureChatButton.addEventListener("click", showChat);
featureShopButton.addEventListener("click", showShop);
featureDiaryButton.addEventListener("click", showDiary);
featureThemesButton.addEventListener("click", showThemes);
featureStarLeaderboardButton.addEventListener("click", showStarLeaderboard);
miniGameAgainButton.addEventListener("click", () => startMiniGame(activeMiniGame));
makeOwnQuizButton.addEventListener("click", showMyQuizzes);
createNewQuizButton.addEventListener("click", showNewQuizCreator);
playSafeQuizzesButton?.addEventListener("click", showSafeQuizzes);
playSharedQuizButton.addEventListener("click", showSharedQuiz);
createPlayerChoice.addEventListener("click", showCreatePlayer);
createAvatarHomeButton.addEventListener("click", showCreatePlayer);
editAvatarButton.addEventListener("click", showCreatePlayer);
usernameLoginChoice.addEventListener("click", showUsernameLogin);
onlineAuthChoice.addEventListener("click", showOnlineAuth);
loginPlayerChoice.addEventListener("click", showLoginPlayer);
guestPlayerChoice.addEventListener("click", useGuestMode);
createPlayerForm.addEventListener("submit", createPlayer);
loginPlayerForm.addEventListener("submit", loginPlayer);
accountLoginTab.addEventListener("click", () => setUsernameAccountMode("login"));
accountCreateTab.addEventListener("click", () => setUsernameAccountMode("create"));
usernameOpenCreateButton.addEventListener("click", () => setUsernameAccountMode("create"));
usernameBackLoginButton.addEventListener("click", () => setUsernameAccountMode("login"));
usernameCreateAccountButton.addEventListener("click", createUsernamePlayerAccount);
usernameLoginAccountButton.addEventListener("click", loginUsernamePlayerAccount);
usernameLoginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loginUsernamePlayerAccount();
});
usernameCreateForm.addEventListener("submit", (event) => {
  event.preventDefault();
  createUsernamePlayerAccount();
});
authSignupForm.addEventListener("submit", handleAuthSignup);
authLoginForm.addEventListener("submit", handleAuthLogin);
profileHomeButtons.forEach((button) => button.addEventListener("click", showPlayerGate));
authLogoutButton.addEventListener("click", logoutSupabaseAccount);
switchPlayerButton.addEventListener("click", switchPlayer);
homeButtons.forEach((button) => button.addEventListener("click", goHome));
gamesButtons.forEach((button) => button.addEventListener("click", showGames));
openShopButton.addEventListener("click", showShop);
openStarLeaderboardButton.addEventListener("click", showStarLeaderboard);
openFriendsButton.addEventListener("click", showFriends);
openChatButton.addEventListener("click", showChat);
copyFriendCodeButton.addEventListener("click", copyFriendCode);
addFriendButton.addEventListener("click", addFriendByCode);
sendFriendChallengeButton.addEventListener("click", createFriendChallenge);
copyFriendChallengeButton.addEventListener("click", copyFriendChallengeLink);
chatSendQuizButton.addEventListener("click", openChatQuizPanel);
chatSendQuizConfirmButton.addEventListener("click", sendQuizFromChat);
sendChatMessageButton.addEventListener("click", sendTypedChatMessage);
chatMessageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    sendTypedChatMessage();
  }
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    updateOwnPresence();
  }
});
window.addEventListener("beforeunload", stopPresenceUpdates);
chatBlockFriendButton.addEventListener("click", blockSelectedChatFriend);
chatRemoveFriendButton.addEventListener("click", removeSelectedChatFriend);
clearChatButton.addEventListener("click", clearSelectedChat);
backToShopButton.addEventListener("click", showShop);
saveDiaryNoteButton.addEventListener("click", saveDiaryNote);
questionTotalInput.addEventListener("input", handleQuestionTotalChange);
questionTotalInput.addEventListener("change", handleQuestionTotalChange);
quizBuilderForm.addEventListener("submit", handleQuizSave);
playSavedQuizButton.addEventListener("click", () => {
  if (editingQuizId) {
    playSavedQuizById(editingQuizId);
    return;
  }

  const firstQuiz = getSavedQuizzes()[0];
  startQuiz(firstQuiz?.questions || getSavedQuiz(), "custom", "scored", firstQuiz?.id || "");
});
createFriendLinkButton.addEventListener("click", createFriendLink);
copyFriendLinkButton.addEventListener("click", copyFriendLink);
loadSharedQuizButton.addEventListener("click", loadSharedQuiz);
startSharedLinkQuizButton.addEventListener("click", startSharedLinkQuiz);
leaderboardForm.addEventListener("submit", addToLeaderboard);
playAgainButton.addEventListener("click", replayCurrentQuiz);
restartQuizButton.addEventListener("click", replayCurrentQuiz);
editCurrentQuizButton.addEventListener("click", showSavedQuizEditor);
editQuizButton.addEventListener("click", showSavedQuizEditor);
resetEverythingButton.addEventListener("click", resetEverything);

async function initializeApp() {
  const savedQuizzes = getSavedQuizzes();
  const savedQuiz = savedQuizzes[0]?.questions || getSavedQuiz();

  renderCreatorFields(savedQuiz.length || minQuestions, savedQuiz);
  quizTitleInput.value = savedQuizzes[0]?.title || "";
  quizThemeInput.value = savedQuizzes[0]?.theme || "Best Friend";
  renderSafeQuizzes();
  seedUsedNicknamesFromSavedData();

  await restoreSupabaseAccount();

  guestMode = false;
  updateAvatarPreview();
  updateProfileBar();
  applyPurchasedEffects();
  updateGamePackStatuses();
  const openedGameInvite = await loadGameInviteFromUrl();
  const openedSharedQuiz = openedGameInvite ? false : await loadSharedQuizFromUrl();

  if (!openedGameInvite && !openedSharedQuiz) {
    showStart();
  }

  renderLeaderboard();
}

initializeApp().catch((error) => {
  console.error("App startup error:", error);
  updateProfileBar();
  showPlayerGate();
});
