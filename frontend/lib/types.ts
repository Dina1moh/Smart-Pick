export interface Product {
  title: string;
  url: string;
  price: number | null;
  currency: string;
  stars: number | null;
  reviews_count: number | null;
  quality_score: number;
  delivery: string | null;
  warranty: string | null;
  image: string | null;
  in_stock: boolean;
  rank: number;
  source?: string;
}

export interface CompareResult {
  product_query: string;
  priority: string;
  category: string | null;
  top_pick: Product | null;
  results: Product[];
  justification: string;
  total_found: number;
}

export type PriorityId =
  | "lowest_price"
  | "best_rating"
  | "best_warranty"
  | "fastest_delivery";
