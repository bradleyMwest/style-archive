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
