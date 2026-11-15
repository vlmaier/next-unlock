import React, { useState, useMemo, useEffect } from 'react';
import {
  PanelSection,
  PanelSectionRow,
  DropdownItem,
  Field,
  ProgressBarWithInfo,
  ButtonItem,
  SingleDropdownOption,
} from './deckyUi';
import { Game, RankedAchievements } from '../types/achievement';
import { AchievementIcon } from './AchievementIcon';
import { computeAchievementSets, rankAchievements } from '../services/steamApi';

interface QuickAccessMenuProps {
  game: Game | null;
  ranked: RankedAchievements | null;
  games?: Game[];
  isRunningGame?: boolean;
  isRefreshing?: boolean;
  onSelectGame?: (appid: number) => void;
  onTogglePin: (id: string) => void;
  onOpenFullDashboard?: () => void;
  onRefresh?: () => void;
}

export const QuickAccessMenu: React.FC<QuickAccessMenuProps> = ({
  game,
  ranked,
  games = [],
  isRunningGame = false,
  isRefreshing = false,
  onSelectGame,
  onTogglePin,
  onOpenFullDashboard,
  onRefresh,
}) => {
  const [selectedSetId, setSelectedSetId] = useState<number | 'all'>('all');

  useEffect(() => {
    setSelectedSetId('all');
  }, [game?.appid]);

  const achievementSets = useMemo(() => {
    if (!game) return [];
    return computeAchievementSets(game.achievements || [], game.achievement_sets);
  }, [game]);

  const activeSet = useMemo(() => {
    if (selectedSetId === 'all') return null;
    return achievementSets.find((s) => s.id === selectedSetId) || null;
  }, [achievementSets, selectedSetId]);

  const effectiveRanked = useMemo(() => {
    if (!game || selectedSetId === 'all') return ranked;
    const pinnedSet = new Set<string>();
    const setAchs = (game.achievements || []).filter((a) => {
      if (a.is_pinned) pinnedSet.add(a.id);
      return (typeof a.set_id === 'number' ? a.set_id : 0) === selectedSetId;
    });
    return rankAchievements(setAchs, pinnedSet);
  }, [game, selectedSetId, ranked]);

  const pinnedList = effectiveRanked?.pinned || [];
  const unpinnedUpNext = (effectiveRanked?.up_next || []).filter((a) => !a.is_pinned);
  const topUpNext = (
    unpinnedUpNext.length > 0 ? unpinnedUpNext : effectiveRanked?.up_next || []
  ).slice(0, 3);
  const hasAchievements = Boolean(game && (game.total_achievements || 0) > 0);

  const progressPct = activeSet
    ? activeSet.completion_percentage
    : game?.completion_percentage || 0;
  const progressUnlocked = activeSet
    ? activeSet.unlocked_count
    : game?.unlocked_count || 0;
  const progressTotal = activeSet
    ? activeSet.total_achievements
    : game?.total_achievements || 0;

  return (
    <div className="flex flex-col gap-1">
      <PanelSection title={game ? game.name : 'Installed Library'}>
        {/* Game Selector Dropdown is ALWAYS visible if any installed games exist */}
        {games.length > 0 && onSelectGame && (
          <PanelSectionRow>
            <DropdownItem
              label={isRunningGame ? 'Active / Selected Game' : 'Installed Game'}
              menuLabel="Choose Game"
              rgOptions={games.map((g) => ({
                data: g.appid,
                label:
                  g.total_achievements > 0
                    ? `${g.name} (${Math.round(g.completion_percentage)}%)`
                    : g.name,
              }))}
              selectedOption={game?.appid ?? games[0].appid}
              onChange={(opt: SingleDropdownOption) => onSelectGame(Number(opt.data))}
            />
          </PanelSectionRow>
        )}

        {/* Steam Achievement Set Selector (when game defines multiple sets) */}
        {game && achievementSets.length > 1 && (
          <PanelSectionRow>
            <DropdownItem
              label="Achievement Set"
              menuLabel="Choose Achievement Set"
              rgOptions={[
                {
                  data: 'all',
                  label: `All Sets (${game.unlocked_count}/${game.total_achievements} • ${Math.round(game.completion_percentage)}%)`,
                },
                ...achievementSets.map((s) => ({
                  data: s.id,
                  label: `${s.name}${s.dlc_appid ? ' [DLC]' : ''} (${s.unlocked_count}/${s.total_achievements} • ${Math.round(s.completion_percentage)}%)`,
                })),
              ]}
              selectedOption={selectedSetId}
              onChange={(opt: SingleDropdownOption) =>
                setSelectedSetId(opt.data === 'all' ? 'all' : Number(opt.data))
              }
            />
          </PanelSectionRow>
        )}

        {/* Header Progress Bar or Status */}
        {game && hasAchievements ? (
          <PanelSectionRow>
            <ProgressBarWithInfo
              nProgress={progressPct}
              sOperationText={
                activeSet
                  ? activeSet.name
                  : isRunningGame
                  ? 'Running Now'
                  : 'Completion'
              }
              sTimeRemaining={`${progressUnlocked} / ${progressTotal} (${progressPct}%)`}
            />
          </PanelSectionRow>
        ) : game ? (
          <PanelSectionRow>
            <Field
              label={isRefreshing ? 'Loading Achievements...' : 'No Steam Achievements'}
              description={
                isRefreshing
                  ? `Fetching achievement data for ${game.name}...`
                  : games.length > 1
                  ? 'No achievements recorded for this title. Select another game above.'
                  : 'No achievements recorded for this title.'
              }
            />
          </PanelSectionRow>
        ) : (
          <PanelSectionRow>
            <Field
              label="No Installed Games Found"
              description="Install or launch a Steam game, or open the Full Dashboard below."
            />
          </PanelSectionRow>
        )}
      </PanelSection>

      {/* Pinned Achievements Section */}
      {hasAchievements && pinnedList.length > 0 && (
        <PanelSection title={`Pinned Targets (${pinnedList.length})`}>
          {pinnedList.map((ach) => (
            <PanelSectionRow key={ach.id}>
              <Field
                focusable={true}
                highlightOnFocus={true}
                label={ach.name}
                description={
                  ach.progress && ach.progress.max > 1
                    ? `Progress: ${ach.progress.current} / ${ach.progress.max} • ${ach.global_percentage}% global`
                    : ach.description || `Unlocked by ${ach.global_percentage}% of players`
                }
                icon={
                  <AchievementIcon
                    src={ach.icon}
                    name={ach.name}
                    unlocked={ach.unlocked}
                    rarityTier={ach.rarity_tier}
                    size="xs"
                  />
                }
                onClick={() => onTogglePin(ach.id)}
                onActivate={() => onTogglePin(ach.id)}
                bottomSeparator="none"
              >
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#eab308]/20 text-[#eab308] border border-[#eab308]/40 font-bold whitespace-nowrap">
                  ★ {ach.global_percentage}%
                </span>
              </Field>
            </PanelSectionRow>
          ))}
        </PanelSection>
      )}

      {/* Up Next Recommendations */}
      {hasAchievements && (
        <PanelSection title="Up Next (Easiest & Closest)">
          {topUpNext.length > 0 ? (
            topUpNext.map((ach) => (
              <PanelSectionRow key={ach.id}>
                <Field
                  focusable={true}
                  highlightOnFocus={true}
                  label={ach.name}
                  description={
                    ach.progress && ach.progress.max > 1
                      ? `Progress: ${ach.progress.current} / ${ach.progress.max} • ${ach.global_percentage}% of players`
                      : ach.description || `Unlocked by ${ach.global_percentage}% of players`
                  }
                  icon={
                    <AchievementIcon
                      src={ach.icon}
                      name={ach.name}
                      unlocked={ach.unlocked}
                      rarityTier={ach.rarity_tier}
                      size="xs"
                    />
                  }
                  onClick={() => onTogglePin(ach.id)}
                  onActivate={() => onTogglePin(ach.id)}
                  bottomSeparator="none"
                >
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap border ${
                      ach.is_pinned
                        ? 'bg-[#eab308]/20 text-[#eab308] border-[#eab308]/40'
                        : 'bg-[#389fff]/15 text-[#389fff] border-[#389fff]/30'
                    }`}
                  >
                    {ach.is_pinned ? `★ ${ach.global_percentage}%` : `${ach.global_percentage}%`}
                  </span>
                </Field>
              </PanelSectionRow>
            ))
          ) : (
            <PanelSectionRow>
              <Field
                label="100% Completed!"
                description={
                  activeSet
                    ? `You have unlocked every achievement in ${activeSet.name}.`
                    : 'You have unlocked every achievement for this game.'
                }
              />
            </PanelSectionRow>
          )}
        </PanelSection>
      )}

      {/* Action Controls — Always Accessible */}
      <PanelSection>
        {onOpenFullDashboard && (
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={onOpenFullDashboard}>
              Open Full Dashboard
            </ButtonItem>
          </PanelSectionRow>
        )}
        {onRefresh && (
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={onRefresh} disabled={isRefreshing}>
              {isRefreshing ? 'Refreshing...' : 'Refresh Achievements'}
            </ButtonItem>
          </PanelSectionRow>
        )}
      </PanelSection>
    </div>
  );
};
