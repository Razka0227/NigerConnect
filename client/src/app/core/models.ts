export interface ApiResponse<T> {
  ok: boolean;
  data: T;
  meta?: Record<string, unknown>;
}

export interface User {
  id: string;
  phone: string;
  countryCode: string;
  name?: string;
  username?: string;
  avatarUrl?: string;
  language: string;
  role: 'user' | 'driver' | 'admin';
  isVerified: boolean;
  createdAt: string;
}

export interface AuthSession {
  user: User;
  token: string;
  isNew?: boolean;
}

export interface OtpResponse {
  phone: string;
  expiresIn: number;
  devCode?: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  title?: string;
  updatedAt: string;
  lastMessage?: Message;
  other: (User & { lastReadAt?: string; muted?: boolean })[];
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  clientMsgId: string;
  type: 'text' | 'image' | 'location' | 'audio' | 'system';
  body?: string;
  mediaUrl?: string;
  mediaMeta?: { size?: number; width?: number; height?: number; duration?: number };
  replyToId?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
  // local flags (not sent to server)
  pending?: boolean;
  failed?: boolean;
}

export interface Ad {
  id: string;
  category: string;
  title: string;
  description: string;
  price?: number;
  currency: string;
  city?: string;
  images: string[];
  status: string;
  views: number;
  createdAt: string;
  seller?: User;
}

export interface Ride {
  id: string;
  driver?: User;
  from: string;
  to: string;
  departAt: string;
  pricePerSeat: number;
  seatsTotal: number;
  seatsLeft: number;
  vehicle?: string;
  status: string;
  createdAt: string;
  hasRequested?: boolean;
  requestsCount?: number;
}

export interface RideRequest {
  id: string;
  rideId: string;
  userId: string;
  seats: number;
  status: string;
  createdAt: string;
}

export interface Wallet {
  balance: number;
  currency: string;
}

export interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  method: string;
  provider?: string;
  reference?: string;
  meta?: Record<string, unknown>;
  status: string;
  createdAt: string;
}

export interface NewsItem {
  id: string;
  category: string;
  title: string;
  summary?: string;
  body?: string;
  imageUrl?: string;
  source?: string;
  publishedAt: string;
}

export interface NewsDetail extends NewsItem {
  body: string;
}
