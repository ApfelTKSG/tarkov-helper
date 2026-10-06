'use client';

import { useState } from 'react';
import { useGame } from '@/app/context/GameContext';
import { parseDatabase, type ProfileDatabase } from '@/src/domain/profiles';
import { updateDatabase } from '@/src/client/profile-store';
import { deriveLoyaltyLevel } from '@/src/domain/progression';
import type { GameMode } from '@/src/domain/game';

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
      <div className="flex flex-wrap items-end gap-4">
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
        <label className="grid gap-1 text-sm">
          プレステージ
          <input
            className={`${field} w-24`}
            type="number"
            min="0"
            step="1"
            placeholder="未入力"
            value={profile.prestige ?? ''}
            disabled={!!storageError}
            onChange={(e) => {
              const prestige = e.target.value === '' ? undefined : Number(e.target.value);
              if (prestige === undefined || (Number.isInteger(prestige) && prestige >= 0))
                edit((p) => ({ ...p, prestige }));
            }}
          />
        </label>
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
          実際のゲームの値を入力してください。LLを「自動」にすると、解放済み・PMCレベル・信頼度が入力されている場合に計算します。
        </p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {snapshot?.traders
            .filter((t) => t.levels.length)
            .map((trader) => {
              const progress = profile.traders[trader.id] ?? {};
              const calculated = deriveLoyaltyLevel(
                profile.level,
                progress.reputation,
                trader.levels,
                progress.unlocked,
              );
              return (
                <fieldset key={trader.id} className="rounded border border-slate-600 p-3">
                  <legend className="px-1">{trader.name}</legend>
                  <div className="flex flex-wrap gap-2">
                    <label className="grid gap-1 text-xs">
                      解放状態
                      <select
                        className={field}
                        value={progress.unlocked === undefined ? '' : String(progress.unlocked)}
                        disabled={!!storageError}
                        onChange={(e) =>
                          edit((p) => ({
                            ...p,
                            traders: {
                              ...p.traders,
                              [trader.id]: {
                                ...p.traders[trader.id],
                                unlocked:
                                  e.target.value === '' ? undefined : e.target.value === 'true',
                              },
                            },
                          }))
                        }
                      >
                        <option value="">不明</option>
                        <option value="true">解放済み</option>
                        <option value="false">未解放</option>
                      </select>
                    </label>
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
