export type RequestStatus = 'pending' | 'next_up' | 'playing' | 'played' | 'rejected';

export interface Song {
  id: string;
  title: string;
  artist: string;
  genre: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface Request {
  id: string;
  song_id: string;
  requester_username: string;
  status: RequestStatus;
  is_tipped: boolean;
  created_at: string;
  updated_at: string;
  song?: Song;
}

export interface Settings {
  id: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentHandles {
  venmo: string;
  paypal: string;
  cashapp: string;
}
