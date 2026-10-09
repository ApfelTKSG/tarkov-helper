'use client';

import { useState } from 'react';
import { useGame } from '@/app/context/GameContext';
import { parseDatabase, type ProfileDatabase } from '@/src/domain/profiles';
import { updateDatabase } from '@/src/client/profile-store';
import { deriveLoyaltyLevel } from '@/src/domain/progression';
import type { GameMode } from '@/src/domain/game';
import { traderUnlocked, visibleTrader } from '@/src/domain/traders';
import ApiImage from './ApiImage';

const field = 'rounded border border-slate-600 bg-slate-900 px-2 py-1 text-white';
const modeNames = { regular: '通常', pve: 'PvE', 'pvp-season': 'PvPシーズン' };
export default function ProfileControls() {
  const {
    profile,
    database,
    snapshot,
    manifest,
    changeMode,
    chooseProfile,
    edit,
    storageError,
    notices,
    refresh,
  } = useGame();
  const [preview, setPreview] = useState<ProfileDatabase | null>(null);
  const [importError, setImportError] = useState('');
  const [importText, setImportText] = useState('');
  const prestigeIcon = snapshot?.prestige
    .find((p) => p.prestigeLevel === profile.prestige)
    ?.rewards?.customization?.find((c) => c.customizationType === 'Stub')?.imageLink;
  const maximumPrestige = Math.max(
    6,
    profile.prestige ?? 0,
    ...(snapshot?.prestige.map((p) => p.prestigeLevel) ?? []),
  );
  const exportBackup = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(database, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `tarkov-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-800 p-4">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 [&>label]:w-36 [&>label]:gap-1 [&>label]:text-sm [&>label]:leading-5 [&>label>input]:h-10 [&>label>select]:h-10 [&>label>input]:w-full [&>label>select]:w-full [&>label>input]:text-sm [&>label>select]:text-sm [&>label>input]:leading-normal [&>label>select]:leading-normal">
        <label className="grid gap-1 text-sm">
          ゲームモード
          <select
            className={field}
            value={profile.mode}
            disabled={!manifest || !!storageError}
            onChange={(event) => changeMode(event.target.value as GameMode)}
          >
            {Object.entries(modeNames).map(([mode, name]) => (
              <option key={mode} value={mode}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          保存プロフィール
          <select
            className={field}
            value={profile.id}
            disabled={!!storageError}
            onChange={(event) => chooseProfile(event.target.value)}
          >
            {Object.values(database.profiles).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          PMCレベル
          <input
            aria-label="PMCレベル"
            className={`${field} w-24`}
            type="number"
            min="1"
            step="1"
            placeholder="未入力"
            value={profile.level ?? ''}
            disabled={!!storageError}
            onChange={(e) => {
              const level = e.target.value === '' ? undefined : Number(e.target.value);
              if (level === undefined || (Number.isInteger(level) && level >= 1))
                edit((p) => ({ ...p, level }));
            }}
          />
        </label>
        <label className="grid gap-1 text-sm">
          陣営
          <select
            className={field}
            value={profile.faction ?? ''}
            disabled={!!storageError}
            onChange={(e) =>
              edit((p) => ({
                ...p,
                faction: e.target.value === '' ? undefined : (e.target.value as 'USEC' | 'BEAR'),
              }))
            }
          >
            <option value="">未入力</option>
            <option>USEC</option>
            <option>BEAR</option>
          </select>
        </label>
        <div className="grid w-36 gap-1 text-sm leading-5">
          <span id="prestige-label">プレステージ</span>
          <div
            role="group"
            aria-labelledby="prestige-label"
            className="flex h-10 items-center justify-between rounded border border-slate-600 bg-slate-900"
            title="達成済みのプレステージ。初回前は未達成。New Beginningは次の段階を表示します。"
          >
            <button
              type="button"
              aria-label="プレステージを下げる"
              disabled={!!storageError || profile.prestige === 0}
              className="h-full w-8 shrink-0 rounded-l hover:bg-slate-700 disabled:opacity-30"
              onClick={() => edit((p) => ({ ...p, prestige: Math.max(0, (p.prestige ?? 1) - 1) }))}
            >
              ←
            </button>
            <span aria-live="polite" className="flex min-w-0 items-center justify-center">
              {prestigeIcon ? (
                <ApiImage
                  src={prestigeIcon}
                  name={`プレステージ ${profile.prestige}`}
                  className="h-9 w-12 object-contain"
                />
              ) : (
                <span className="text-xs text-slate-300">
                  {profile.prestige === undefined
                    ? '未入力'
                    : profile.prestige === 0
                      ? '未達成'
                      : `段階 ${profile.prestige}`}
                </span>
              )}
            </span>
            <button
              type="button"
              aria-label="プレステージを上げる"
              disabled={!!storageError || (profile.prestige ?? -1) >= maximumPrestige}
              className="h-full w-8 shrink-0 rounded-r hover:bg-slate-700 disabled:opacity-30"
              onClick={() => edit((p) => ({ ...p, prestige: (p.prestige ?? -1) + 1 }))}
            >
              →
            </button>
          </div>
        </div>
      </div>
      {storageError && (
        <p role="alert" className="text-red-300">
          {storageError} バックアップを書き出してから復元してください。
        </p>
      )}
      {notices.map((notice, index) => (
        <p className="text-amber-300 text-sm" key={index}>
          {notice}
        </p>
      ))}
      <details>
        <summary className="cursor-pointer text-amber-300">トレーダーの信頼度・LLを設定</summary>
        <p className="my-3 text-sm text-slate-300">
          実際のゲームの値を入力してください。LLを「自動」にすると、PMCレベルと信頼度から計算します。JaegerはIntroduction、RefはEasy
          Money - Part 1の完了で自動解放します。
          タスク完了・失敗の信頼度は自動反映します。未入力の場合は0から加算します。デイリーなどの変動はここで現在値に修正できます。既存の完了済みタスクには遡って加算しません。
        </p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {snapshot?.traders
            .filter((t) => t.levels.length && visibleTrader(t))
            .map((trader) => {
              const progress = profile.traders[trader.id] ?? {};
              const calculated = deriveLoyaltyLevel(
                profile.level,
                progress.reputation,
                trader.levels,
                traderUnlocked(trader.id, profile),
              );
              return (
                <fieldset key={trader.id} className="rounded border border-slate-600 p-3">
                  <legend className="px-1">{trader.name}</legend>
                  <div className="flex flex-wrap gap-2">
                    <label className="grid gap-1 text-xs">
                      信頼度
                      <input
                        aria-label={`${trader.name} 信頼度`}
                        className={`${field} w-24`}
                        type="number"
                        step="any"
                        placeholder="未入力"
                        value={progress.reputation ?? ''}
                        disabled={!!storageError}
                        onChange={(e) => {
                          const reputation =
                            e.target.value === '' ? undefined : Number(e.target.value);
                          if (reputation === undefined || Number.isFinite(reputation))
                            edit((p) => ({
                              ...p,
                              traders: {
                                ...p.traders,
                                [trader.id]: { ...p.traders[trader.id], reputation },
                              },
                            }));
                        }}
                      />
                    </label>
                    <label className="grid gap-1 text-xs">
                      LL
                      <select
                        aria-label={`${trader.name} LL`}
                        className={field}
                        value={progress.level ?? ''}
                        disabled={!!storageError}
                        onChange={(e) =>
                          edit((p) => ({
                            ...p,
                            traders: {
                              ...p.traders,
                              [trader.id]: {
                                ...p.traders[trader.id],
                                level: e.target.value === '' ? undefined : Number(e.target.value),
                              },
                            },
                          }))
                        }
                      >
                        <option value="">
                          自動 {calculated === undefined ? '(不明)' : `(${calculated})`}
                        </option>
                        {[1, 2, 3, 4].map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </fieldset>
              );
            })}
        </div>
      </details>
      <details>
        <summary className="cursor-pointer text-amber-300">バックアップ・復元・データ更新</summary>
        <div className="mt-3 flex flex-wrap gap-3">
          <button className={field} onClick={exportBackup}>
            全プロフィールを書き出す
          </button>
          <button className={field} onClick={refresh}>
            配信データを再確認
          </button>
          {profile.pinnedRevision && (
            <button
              className={field}
              disabled={!!storageError}
              onClick={() => edit((p) => ({ ...p, pinnedRevision: undefined }))}
            >
              版固定を解除
            </button>
          )}
          <label className={`${field} cursor-pointer`}>
            バックアップを選ぶ
            <input
              className="block max-w-64 text-sm"
              type="file"
              accept=".json,application/json"
              onChange={async (event) => {
                setPreview(null);
                setImportError('');
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 10_000_000) throw new Error('ファイルが大きすぎます');
                  const text = await file.text();
                  setImportText(text);
                  setPreview(parseDatabase(text));
                } catch (error) {
                  setImportError(error instanceof Error ? error.message : '読み込めません');
                }
              }}
            />
          </label>
        </div>
        {importError && (
          <p role="alert" className="mt-2 text-red-300">
            {importError}
          </p>
        )}
        {preview && (
          <div className="mt-3 rounded border border-amber-700 p-3">
            <p>復元プレビュー: {Object.keys(preview.profiles).length}プロフィール</p>
            <ul>
              {Object.values(preview.profiles).map((p) => (
                <li key={p.id}>
                  {p.name} — 完了 {Object.values(p.tasks).filter((s) => s === 'complete').length}
                  件・お気に入り {p.favorites.length}件
                </li>
              ))}
            </ul>
            <p className="my-2 text-amber-200">
              端末内の全プロフィールをこのバックアップで置き換えます。先に現在のバックアップを書き出してください。
            </p>
            <button
              className={field}
              onClick={() => {
                if (updateDatabase(() => parseDatabase(importText), true)) {
                  setPreview(null);
                  refresh();
                }
              }}
            >
              この内容で復元する
            </button>
            <button className={`${field} ml-2`} onClick={() => setPreview(null)}>
              キャンセル
            </button>
          </div>
        )}
        {manifest && snapshot && (
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p>
              使用中: {snapshot.revision.slice(0, 12)} / 更新{' '}
              {new Date(snapshot.generatedAt).toLocaleString('ja-JP')}{' '}
              {profile.pinnedRevision ? '（版を固定中）' : ''}
            </p>
            <p>
              採用データ: {snapshot.tasks.length}タスク。保存済みの未知タスクID:{' '}
              {
                Object.keys(profile.tasks).filter(
                  (id) => !snapshot.tasks.some((t) => t.id === id) && !id.startsWith('hideout-'),
                ).length
              }
              件。未割当の旧アイテム進捗: {Object.keys(profile.legacyCollected).length}
              件（バックアップに保持）。
            </p>
            {!manifest.modes[profile.mode].diff.initial && (
              <p>
                配信版の差分: 追加 {manifest.modes[profile.mode].diff.added.length} / 削除{' '}
                {manifest.modes[profile.mode].diff.removed.length} / 変更{' '}
                {manifest.modes[profile.mode].diff.changed.length}
              </p>
            )}
            {!profile.pinnedRevision && (
              <button
                className={field}
                disabled={!!storageError}
                onClick={() => edit((p) => ({ ...p, pinnedRevision: snapshot.revision }))}
              >
                この版を固定
              </button>
            )}
            {manifest.modes[profile.mode].previous && (
              <button
                className={`${field} ml-2`}
                onClick={() =>
                  edit((p) => ({
                    ...p,
                    pinnedRevision: manifest.modes[profile.mode].previous!.revision,
                  }))
                }
              >
                直前の正常版を試す
              </button>
            )}
          </div>
        )}
      </details>
    </section>
  );
}
