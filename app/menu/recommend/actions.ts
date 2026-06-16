"use server";

import { redirect } from "next/navigation";

export async function shuffleRecommendations() {
  redirect(`/menu/recommend?seed=${Date.now()}`);
}
