// トレーダー名をURL-safeなslugに変換（クライアント・サーバー両方で使用可能）

// トレーダー名をURL-safeなslugに変換
export function traderNameToSlug(traderName: string): string {
  return traderName.replace(/\s+/g, '-');
}

// slugをトレーダー名に戻す
export function slugToTraderName(slug: string): string {
  return slug.replace(/-/g, ' ');
}
