import { supabase } from "@/lib/supabase";

export interface Review {
  id: string;
  product_id: string;
  reviewer_name: string;
  rating: number;
  title: string | null;
  body: string;
  status: "published" | "hidden";
  created_at: string;
  user_id?: string;
}

export async function fetchReviews(productId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, product_id, user_id, reviewer_name, rating, title, body, status, created_at")
    .eq("product_id", productId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []) as Review[];
}

export async function canReview(productId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("can_review", { p_product_id: productId });
  if (error) return false;
  return !!data;
}

export async function submitReview(productId: string, rating: number, title: string, body: string): Promise<void> {
  const { error } = await supabase.rpc("submit_review", { p_product_id: productId, p_rating: rating, p_title: title, p_body: body });
  if (error) throw new Error(error.message || "Could not save your review.");
}

// --- Admin ---
export async function fetchAllReviewsAdmin(): Promise<(Review & { product?: { name: string; slug: string } | null })[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*, product:products(name, slug)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data || []) as (Review & { product?: { name: string; slug: string } | null })[];
}

export async function setReviewStatus(id: string, status: "published" | "hidden"): Promise<void> {
  const { error } = await supabase.from("reviews").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteReview(id: string): Promise<void> {
  const { error } = await supabase.from("reviews").delete().eq("id", id);
  if (error) throw error;
}
