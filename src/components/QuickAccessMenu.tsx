import React from 'react';
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

interface QuickAccessMenuProps {
  game: Game | null;
  ranked: RankedAchievements | null;
  games?: Game[];
  isRunningGame?: boolean;
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
  onSelectGame,
  onTogglePin,
  onOpenFullDashboard,
  onRefresh,
}) => {
  if (!game) {
    return (
      <PanelSection title="Next Unlock">
        <PanelSectionRow>
          <Field
            label="No Game Detected"
            description="Launch a game on Steam to track unlockable achievements."
          />
        </PanelSectionRow>
        {onRefresh && (
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={onRefresh}>
              Scan Again
            </ButtonItem>
          </PanelSectionRow>
        )}
      </PanelSection>
    );
  }

  const topUpNext = ranked?.up_next?.slice(0, 3) || [];
  const pinnedList = ranked?.pinned || [];
  const hasAchievements = (game.total_achievements || 0) > 0;

  return (
    <>
      <PanelSection title={game.name}>
        {/* Game Selector Dropdown if multiple games exist */}
        {games.length > 1 && onSelectGame && (
          <PanelSectionRow>
            <DropdownItem
              label="Selected Game"
              menuLabel="Choose Game"
              rgOptions={games.map((g) => ({ data: g.appid, label: g.name }))}
              selectedOption={game.appid}
              onChange={(opt: SingleDropdownOption) => onSelectGame(opt.data)}
            />
          </PanelSectionRow>
        )}

        {/* Header Progress Bar */}
        {hasAchievements ? (
          <PanelSectionRow>
            <ProgressBarWithInfo
              nProgress={game.completion_percentage}
              sOperationText={isRunningGame ? "Currently Playing" : "Completion Progress"}
              sTimeRemaining={`${game.unlocked_count} / ${game.total_achievements} (${game.completion_percentage}%)`}
            />
          </PanelSectionRow>
        ) : (
          <PanelSectionRow>
            <Field
              label={isRunningGame ? "Scanning Achievements" : "No Achievements Found"}
              description={
                isRunningGame
                  ? `Scanning achievements for ${game.name}...`
                  : "No achievements recorded for this title."
              }
            />
          </PanelSectionRow>
        )}
      </PanelSection>

      {/* Pinned Achievements Section */}
      {hasAchievements && pinnedList.length > 0 && (
        <PanelSection title={`Pinned (${pinnedList.length})`}>
          {pinnedList.map((ach) => (
            <PanelSectionRow key={ach.id}>
              <Field
                focusable={true}
                highlightOnFocus={true}
                label={ach.name}
                description={ach.hint || ach.description || 'Pinned achievement'}
                icon={
                  ach.icon ? (
                    <img
                      src={ach.icon}
                      alt=""
                      style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : undefined
                }
                onClick={() => onTogglePin(ach.id)}
                onActivate={() => onTogglePin(ach.id)}
                bottomSeparator="none"
              >
                <span style={{ fontSize: '11px', color: '#eab308', fontWeight: 600 }}>
                  ★ {ach.global_percentage}%
                </span>
              </Field>
            </PanelSectionRow>
          ))}
        </PanelSection>
      )}

      {/* Up Next Recommendations */}
      {hasAchievements && (
        <PanelSection title="Up Next (Closest Unlocks)">
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
                      : (ach.hint || ach.description || `${ach.global_percentage}% of players unlocked`)
                  }
                  icon={
                    ach.icon ? (
                      <img
                        src={ach.icon}
                        alt=""
                        style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : undefined
                  }
                  onClick={() => onTogglePin(ach.id)}
                  onActivate={() => onTogglePin(ach.id)}
                  bottomSeparator="none"
                >
                  <span style={{ fontSize: '11px', color: '#60a5fa', fontWeight: 600 }}>
                    {ach.global_percentage}%
                  </span>
                </Field>
              </PanelSectionRow>
            ))
          ) : (
            <PanelSectionRow>
              <Field
                label="All Achievements Unlocked!"
                description="Congratulations! You have completed all achievements for this title."
              />
            </PanelSectionRow>
          )}
        </PanelSection>
      )}

      {/* Controls / Dashboard */}
      <PanelSection>
        {onRefresh && (
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={onRefresh}>
              Refresh Achievements
            </ButtonItem>
          </PanelSectionRow>
        )}
        {onOpenFullDashboard && (
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={onOpenFullDashboard}>
              Open Full Dashboard
            </ButtonItem>
          </PanelSectionRow>
        )}
      </PanelSection>
    </>
  );
};
