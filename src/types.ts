/// <reference types="google-apps-script" />

// 基本型定義
export interface Config {
    THREADS_API_BASE: string;
    SPREADSHEET_ID: string;
    POST_INTERVAL_MINUTES: number;
    REPLY_DELAY_MINUTES: number;
    MAX_DAILY_POSTS: number;
    CLOUDINARY: {
        CLOUD_NAME: string;
        API_KEY: string;
        API_SECRET: string;
        BASE_URL: string;
    };
    DRIVE_FOLDER_NAME: string;
    SUPPORTED_IMAGE_TYPES: string[];
    IMAGE_EXTENSIONS: string[];
    MAX_IMAGE_SIZE_MB: number;
    ALL_ACCOUNTS_INTERVAL: number;
    TEST_INTERVAL: number;
    SHEET_NAMES: {
        ACCOUNTS: string;
        CONTENT: string;
        SCHEDULE: string;
        LOGS: string;
        AFFILIATE: string;
    };
    SCHEDULE: {
        POSTING_HOURS: number[];
        ACCOUNT_INTERVAL_SECONDS: number;
        EXECUTION_LOG_SHEET: string;
        TIMEZONE: string;
        ENABLED: boolean;
    };
    RANDOM_CONTENT: {
        ENABLE_RANDOM_SELECTION: boolean;
        AVOID_RECENT_CONTENT: boolean;
        RECENT_CONTENT_LIMIT: number;
        ENABLE_SHARED_CONTENT: boolean;
        DEBUG_MODE: boolean;
    };
}

export interface Account {
    id: string;
    username: string;
    appId: string;
    userId: string;
    status: string;
    lastPostTime?: Date | string; // ← stringも許可
    dailyPostCount?: number;
}

export interface Content {
    id: string;
    mainText: string;
    useImage: 'YES' | 'NO';
    usage: number;
    accountId?: string;
    usedCount?: number;
    title?: string;
}

export interface AffiliateContent {
    id: string;
    contentId: string;
    appName: string;
    description: string;
    affiliateUrl: string;
    callToAction: string;
    isSharedAffiliate?: boolean;
    accountId?: string;
}

export interface PostResult {
    success: boolean;
    postId?: string;
    error?: string;
    hasImage?: boolean;
    imageUrl?: string;
    contentId?: string;
    cloudinaryInfo?: any;
    creationId?: string;
}

export interface ReplyResult {
    success: boolean;
    postId?: string;
    creationId?: string;
    error?: string;
}