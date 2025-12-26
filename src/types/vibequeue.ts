export type RequestStatus = 'pending' | 'next_up' | 'playing' | 'played' | 'rejected';

export interface Song {
  id: string;
  title: string;
  artist: string;
  genre: string | null;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
  is_available?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Request {
  id: string;
  songId: string;
  requesterUsername: string;
  status: RequestStatus;
  isTipped: boolean;
  createdAt: string;
  updatedAt: string;
  song?: Song;
  song_id?: string;
  requester_username?: string;
  is_tipped?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Settings {
  id: string;
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentHandles {
  venmo: string;
  paypal: string;
  cashapp: string;
}
