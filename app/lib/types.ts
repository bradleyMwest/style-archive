export interface Item {
  id: string;
  name: string;
  type: string; // e.g., shirt, pants, shoes
  color: string;
  size: string;
  image: string; // URL or path
  images: string[]; // Array of image URLs
  tags: string[];
  material?: string;
  brand?: string;
  description?: string;
  price?: {
    amount?: number;
    currency?: string;
  };
  listingUrl?: string;
  dateAdded: string;
}

export interface Outfit {
  id: string;
  name: string;
  items: Item[];
  dateCreated: string;
}

export type OutfitSuggestionStatus = 'liked' | 'try' | 'nope';

export interface OutfitSuggestion {
  id: string;
  name: string;
  description: string;
  reasoning: string;
  itemIds: string[];
  status: OutfitSuggestionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StyleProfile {
  selfDescription?: string | null;
  styleGoals?: string | null;
  lifestyleNotes?: string | null;
  fitNotes?: string | null;
  preferredBrands?: string | null;
  favoriteColors?: string | null;
  budgetFocus?: string | null;
  ageRange?: string | null;
  location?: string | null;
  climate?: string | null;
  aiSummary?: string | null;
  aiKeywords?: string | null;
  aiUpdatedAt?: string | null;
}

export type CandidateStatus = 'draft' | 'ready' | 'evaluated' | 'archived';
export type CandidateVerdict = 'buy' | 'maybe' | 'pass';

export interface CandidateEvaluation {
  id: string;
  verdict: CandidateVerdict;
  explanation?: string;
  compatibilityScore?: number;
  redundancyScore?: number;
  gapScore?: number;
  versatilityScore?: number;
  reasoning?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CandidateItem {
  id: string;
  url: string;
  sourceDomain?: string;
  title?: string;
  brand?: string;
  type?: string;
  color?: string;
  size?: string;
  material?: string;
  description?: string;
  notes?: string;
  tags: string[];
  heroImage?: string;
  images: string[];
  price?: {
    amount?: number;
    currency?: string;
  };
  status: CandidateStatus;
  evaluation?: CandidateEvaluation;
  createdAt: string;
  updatedAt: string;
}
