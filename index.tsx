import React from 'react';
import { createRoot } from 'react-dom/client';

// --- TYPE DEFINITIONS ---
type GameMode = 'single' | 'league' | 'team';
type PokemonCategory = 'normal' | 'rare' | 'legendary' | 'mythical';
type GamePage = 'start' | 'pokemon-selection' | 'battle' | 'game-over' | 'how-to-play';

interface Pokemon {
    id: number;
    name: string;
    sprites: {
        front_default: string;
        other?: {
            'official-artwork': {
                front_default: string;
            };
        };
    };
    types: { type: { name: string } }[];
    stats: { base_stat: number; stat: { name: string } }[];
    moves: { move: { name: string, url: string } }[];
}

interface Move {
    id: number;
    name: string;
    power: number | null;
    accuracy: number | null;
    type: { name: string };
}

interface BattlePokemon {
    id: number;
    name: string;
    sprite: string;
    types: string[];
    maxHp: number;
    currentHp: number;
    attack: number;
    defense: number;
    moves: Move[];
    isFainted: boolean;
}

interface FloatingText {
    target: 'player' | 'opponent';
    message: string;
    type: 'super-effective' | 'not-very-effective' | 'no-effect';
}

// --- CONSTANTS AND CONFIGURATION ---
const POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2';
const POKEMON_PER_PAGE = 30;
const MOVES_PER_POKEMON = 6;
const LEAGUE_ROUNDS = 5;

const CATEGORY_POKEMON_IDS: Record<PokemonCategory, number[]> = {
    normal: [1,4,7,10,13,16,19,21,23,25,27,29,32,35,37,39,41,43,46,48,50,52,54,56,58,60,63,66,69,72,74,77,79,81,83,86,88,90,92,95,98,100,102,104,106,108,109,111,113,114,115,116,118,120,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143],
    rare: [2,3,5,6,8,9,11,12,14,15,17,18,26,28,31,34,36,38,40,42,45,47,49,51,53,55,57,59,62,65,68,71,73,76,78,80,82,85,87,89,91,94,97,99,101,105,110,112,117,119,121],
    legendary: [144,145,146,150,243,244,245,249,250,377,378,379,380,381,382,383,384,480,481,482,483,484,485,486,487,488,638,639,640,641,642,643,644,646,716,717,718,772,773,785,786,787,788,789,790,791,792,888,889,890,892,894,895,896,897,898,905,1001,1002,1003,1004,1007,1008,1014,1015,1016,1017,1024],
    mythical: [151,251,385,386,490,491,492,493,494,647,648,649,720,721,800,801,802,807,808,809,891,892,893]
};


const TYPE_CHART: Record<string, Record<string, number>> = {
    normal: { rock: 0.5, ghost: 0, steel: 0.5 },
    fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
    water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
    electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
    grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
    ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
    fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
    poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
    ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
    flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
    psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0 },
    bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
    rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
    ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
    dragon: { dragon: 2, steel: 0.5, fairy: 0 },
    dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
    steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
    fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

// --- API HELPERS & CACHING ---
const apiCache = new Map<string, any>();

async function fetchFromApi<T>(endpoint: string): Promise<T> {
    if (apiCache.has(endpoint)) {
        return apiCache.get(endpoint) as T;
    }
    try {
        const response = await fetch(endpoint.startsWith('http') ? endpoint : `${POKEAPI_BASE_URL}/${endpoint}`);
        if (!response.ok) throw new Error(`API call failed: ${response.status}`);
        const data = await response.json();
        apiCache.set(endpoint, data);
        return data as T;
    } catch (error) {
        console.error("Fetch error:", error);
        throw error;
    }
}

// --- GAME STATE ---
let state = {
    page: 'start' as GamePage,
    mode: null as GameMode | null,
    category: null as PokemonCategory | null,
    
    // Pokemon Selection
    allPokemon: [] as { name: string, url: string }[],
    displayedPokemon: [] as Pokemon[],
    selectionOffset: 0,
    isLoadingMore: false,
    selectedTeam: [] as Pokemon[],
    filter: '',
    isStartingBattle: false,

    // Battle
    playerTeam: [] as BattlePokemon[],
    opponentTeam: [] as BattlePokemon[],
    playerActivePokemonIndex: 0,
    opponentActivePokemonIndex: 0,
    battleLog: [] as string[],
    isPlayerTurn: true,
    isBattleOver: false,
    battleResult: '' as 'win' | 'lose' | '',
    lastPlayerMove: null as string | null,
    lastOpponentMove: null as string | null,
    floatingText: null as FloatingText | null,

    // League
    leagueRound: 0,
    leagueOpponents: [] as Pokemon[],
};

function setState(newState: Partial<typeof state>) {
    Object.assign(state, newState);
    render();
}

// --- BATTLE LOGIC ---
function getStat(pokemon: Pokemon, statName: string): number {
    return pokemon.stats.find(s => s.stat.name === statName)?.base_stat || 10;
}

function getPokemonImageUrl(pokemon: Pokemon): string {
    return pokemon.sprites.other?.['official-artwork']?.front_default || pokemon.sprites.front_default;
}

async function createBattlePokemon(pokemon: Pokemon): Promise<BattlePokemon> {
    const movePromises = pokemon.moves
        .sort(() => 0.5 - Math.random())
        .map(m => fetchFromApi<Move>(m.move.url));
    
    const resolvedMoves = await Promise.all(movePromises);
    const powerfulMoves = resolvedMoves.filter(m => m && m.power).slice(0, MOVES_PER_POKEMON);
    
    const hp = getStat(pokemon, 'hp');

    return {
        id: pokemon.id,
        name: pokemon.name,
        sprite: getPokemonImageUrl(pokemon),
        types: pokemon.types.map(t => t.type.name),
        maxHp: Math.floor(hp * 1.5 + 60),
        currentHp: Math.floor(hp * 1.5 + 60),
        attack: getStat(pokemon, 'attack'),
        defense: getStat(pokemon, 'defense'),
        moves: powerfulMoves,
        isFainted: false,
    };
}

function calculateDamage(attacker: BattlePokemon, defender: BattlePokemon, move: Move): { damage: number, effectiveness: string } {
    const moveType = move.type.name;
    let typeMultiplier = 1;
    let effectivenessMessage = '';

    defender.types.forEach(defenderType => {
        typeMultiplier *= TYPE_CHART[moveType]?.[defenderType] ?? 1;
    });

    if (typeMultiplier > 1) effectivenessMessage = "It's super effective!";
    if (typeMultiplier < 1 && typeMultiplier > 0) effectivenessMessage = "It's not very effective...";
    if (typeMultiplier === 0) effectivenessMessage = `It doesn't affect ${defender.name}...`;
    
    const randomFactor = Math.random() * (1 - 0.85) + 0.85;
    const damage = Math.floor(
        ((((2 * 50 / 5 + 2) * (move.power || 30) * (attacker.attack / defender.defense)) / 50 + 2) * typeMultiplier * randomFactor)
    );

    return { damage: Math.max(1, damage), effectiveness: effectivenessMessage };
}

// --- UI COMPONENTS (React) ---

const App = () => {
    if (state.isStartingBattle) {
        return (
            <div className="d-flex justify-center align-center h-100">
                <div className="glass-container text-center">
                    <h2>Preparing your battle...</h2>
                    <div className="loading-spinner"></div>
                </div>
            </div>
        );
    }
    return (
        <>
            <div id="main-content">
                {state.page === 'start' && <StartScreen />}
                {state.page === 'how-to-play' && <HowToPlayScreen />}
                {state.page === 'pokemon-selection' && <PokemonSelectionScreen />}
                {state.page === 'battle' && <BattleScreen />}
                {state.page === 'game-over' && <GameOverScreen />}
            </div>
            <TypeChartPanel />
        </>
    );
};

const StartScreen = () => {
    const handleModeSelect = (mode: GameMode) => setState({ mode });
    const handleCategorySelect = (category: PokemonCategory) => {
        setState({ category, page: 'pokemon-selection' });
        loadInitialPokemon();
    };

    return (
        <div id="start-screen" className="glass-container">
            <h1>Pokémon Battle Arena</h1>
            {!state.mode ? (
                <div className="mode-selection">
                    <h2>Choose a Mode</h2>
                    <div className="start-buttons-grid">
                        <button className="btn" onClick={() => handleModeSelect('single')}>Single Battle</button>
                        <button className="btn" onClick={() => handleModeSelect('team')}>Team Battle</button>
                        <button className="btn" onClick={() => handleModeSelect('league')}>League Challenge</button>
                        <button className="btn btn-secondary" onClick={() => setState({ page: 'how-to-play' })}>How to Play</button>
                    </div>
                </div>
            ) : (
                <div className="category-selection">
                    <h2>Select Category</h2>
                    <div className="category-grid">
                        <button className="btn" onClick={() => handleCategorySelect('normal')}>Normal</button>
                        <button className="btn" onClick={() => handleCategorySelect('rare')}>Rare</button>
                        <button className="btn" onClick={() => handleCategorySelect('legendary')}>Legendary</button>
                        <button className="btn" onClick={() => handleCategorySelect('mythical')}>Mythical</button>
                    </div>
                    <button className="btn btn-secondary mt-2" onClick={() => setState({ mode: null })}>Back to Modes</button>
                </div>
            )}
        </div>
    );
};

const HowToPlayScreen = () => (
    <div id="how-to-play-screen" className="glass-container">
        <div className="how-to-play-header">
            <h1>How to Play</h1>
            <button className="btn" onClick={() => setState({ page: 'start', mode: null })}>Back</button>
        </div>
        <div className="how-to-play-content">
            <div className="rules-section">
                <h2>Single Battle</h2>
                <p>The classic one-on-one Pokémon duel.</p>
                <ul>
                    <li><strong>Goal:</strong> Defeat your opponent's single Pokémon.</li>
                    <li><strong>Setup:</strong> Choose one Pokémon from the selected category. The AI opponent will also choose one.</li>
                    <li><strong>Gameplay:</strong> You and the opponent take turns attacking. The first trainer to make the other's Pokémon faint is the winner!</li>
                </ul>
            </div>
            <div className="rules-section">
                <h2>Team Battle</h2>
                <p>A strategic battle between two full teams.</p>
                <ul>
                    <li><strong>Goal:</strong> Defeat the opponent's entire team of 5 Pokémon.</li>
                    <li><strong>Setup:</strong> Select a team of 5 Pokémon. The AI will do the same.</li>
                    <li><strong>Gameplay:</strong> Fight one-on-one with your active Pokémon. You can either attack or switch your active Pokémon with a benched one. When a Pokémon faints, you must send out another. The battle is won when all 5 of the opponent's Pokémon have fainted.</li>
                </ul>
            </div>
            <div className="rules-section">
                <h2>League Challenge</h2>
                <p>The ultimate test of endurance and skill. Can you conquer the league?</p>
                <ul>
                    <li><strong>Goal:</strong> Win a series of 5 consecutive battles against different trainers.</li>
                    <li><strong>Setup:</strong> Choose one Pokémon. This will be your partner for the entire league.</li>
                    <li><strong>Gameplay:</strong> You face 5 opponents in a row. Your Pokémon is fully healed between rounds. After each victory, you can choose to update your Pokémon's moves. Losing any battle ends the challenge. Win all 5 to become the League Champion!</li>
                </ul>
            </div>
        </div>
    </div>
);

const PokemonSelectionScreen = () => {
    const { mode, displayedPokemon, selectedTeam, filter, isLoadingMore } = state;
    const teamSize = mode === 'team' ? 5 : 1;
    
    const goBack = () => setState({ 
        page: 'start', 
        allPokemon: [], 
        displayedPokemon: [], 
        selectedTeam: [] 
    });

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setState({ filter: e.target.value.toLowerCase() });
    };

    const filteredPokemon = displayedPokemon.filter(p => p.name.includes(filter) || String(p.id).includes(filter));

    return (
        <div id="pokemon-selection-screen" className="glass-container">
            <header className="selection-header">
                <h2>{mode === 'team' ? `Select Your Team (${selectedTeam.length}/${teamSize})` : 'Select Your Pokémon'}</h2>
                <input type="text" className="search-bar" placeholder="Search by name or ID..." onChange={handleSearch} value={filter}/>
            </header>
            <main className="selection-main">
                <div className="pokemon-grid-container">
                    <div id="pokemon-grid">
                        {filteredPokemon.map(p => <PokemonCard key={p.id} pokemon={p} />)}
                    </div>
                    {isLoadingMore && <p className="text-center mt-2">Loading...</p>}
                </div>
                {mode === 'team' && <TeamPreviewPanel />}
            </main>
            <footer id="selection-footer">
                <button className="btn btn-secondary" onClick={goBack}>Back</button>
                <button className="btn" onClick={loadMorePokemon} disabled={isLoadingMore}>Load More</button>
                {mode !== 'team' && <p className="text-center" style={{flexGrow:1, alignSelf: 'center'}}>Select a Pokémon to start the battle!</p>}
            </footer>
        </div>
    );
};

const PokemonCard: React.FC<{ pokemon: Pokemon }> = ({ pokemon }) => {
    const isSelected = state.selectedTeam.some(p => p.id === pokemon.id);
    const teamSize = state.mode === 'team' ? 5 : 1;

    const handleClick = () => {
        if (state.isStartingBattle) return;

        if (state.mode === 'team') {
            if (isSelected) {
                setState({ selectedTeam: state.selectedTeam.filter(p => p.id !== pokemon.id) });
            } else if (state.selectedTeam.length < teamSize) {
                setState({ selectedTeam: [...state.selectedTeam, pokemon] });
            }
        } else { // Single or League mode
            setState({ selectedTeam: [pokemon], isStartingBattle: true });
            setTimeout(() => startBattle(), 50);
        }
    };

    return (
        <div className={`pokemon-card ${isSelected ? 'selected' : ''}`} onClick={handleClick}>
            <img src={getPokemonImageUrl(pokemon)} alt={pokemon.name} loading="lazy" />
            <p className="pokemon-card-name">{pokemon.name}</p>
        </div>
    );
};

const TeamPreviewPanel = () => {
    const teamSize = 5;
    const slots = Array.from({ length: teamSize });
    
    const handleStartTeamBattle = () => {
        if (state.selectedTeam.length !== teamSize || state.isStartingBattle) return;
        setState({ isStartingBattle: true });
        setTimeout(() => startBattle(), 50);
    };

    return (
        <aside className="team-preview-panel glass-container">
            <h3>Your Team</h3>
            <div id="team-slots">
                {slots.map((_, i) => (
                    <div key={i} className={`team-slot ${!state.selectedTeam[i] ? 'empty' : ''}`}>
                        {state.selectedTeam[i] ? (
                            <>
                                <img src={getPokemonImageUrl(state.selectedTeam[i])} alt={state.selectedTeam[i].name} />
                                <span>{state.selectedTeam[i].name}</span>
                            </>
                        ) : (
                            <span>Empty Slot</span>
                        )}
                    </div>
                ))}
            </div>
            <button className="btn w-100" onClick={handleStartTeamBattle} disabled={state.selectedTeam.length !== teamSize || state.isStartingBattle}>
                Start Battle
            </button>
        </aside>
    );
};

const BattleScreen = () => {
    const player = state.playerTeam[state.playerActivePokemonIndex];
    const opponent = state.opponentTeam[state.opponentActivePokemonIndex];

    if (!player || !opponent) return <div className="text-center">Loading battle...</div>;

    return (
        <>
            <div id="battle-screen">
                <div className="battle-header">
                     <h2>{state.mode === 'league' ? `League Round ${state.leagueRound + 1}` : `${state.mode} Battle`}</h2>
                     <button className="btn btn-secondary end-battle-btn" onClick={goBackToStart}>End Battle</button>
                </div>
                <div id="battle-arena">
                    <PokemonFighter pokemon={player} isOpponent={false} />
                    <PokemonFighter pokemon={opponent} isOpponent={true} />
                </div>
                <div id="battle-log-container">
                    <div id="battle-log">
                        {state.battleLog.map((msg, i) => <p key={i} dangerouslySetInnerHTML={{ __html: msg }}></p>)}
                    </div>
                </div>
            </div>
            {state.isBattleOver && <GameOverScreen />}
        </>
    );
};

const PokemonFighter = ({ pokemon, isOpponent }: { pokemon: BattlePokemon, isOpponent: boolean }) => {
    const hpPercentage = (pokemon.currentHp / pokemon.maxHp) * 100;
    let hpColor = 'var(--color-green)';
    if (hpPercentage < 50) hpColor = 'var(--color-yellow)';
    if (hpPercentage < 20) hpColor = 'var(--color-red)';
    const fighterKey = isOpponent ? 'opponent' : 'player';
    const showFloatingText = state.floatingText && state.floatingText.target === fighterKey;
    
    return (
        <div className={`pokemon-fighter-container ${isOpponent ? 'opponent' : 'player'}`}>
            <div className="pokemon-fighter-info glass-container">
                <div className="info-header">
                    <span>{pokemon.name}</span>
                    <div className="d-flex gap-1">
                        {pokemon.types.map(t => <TypeBadge key={t} type={t} />)}
                    </div>
                </div>
                <div className="hp-bar-container">
                    <div className="hp-bar" style={{ width: `${hpPercentage}%`, backgroundColor: hpColor }}></div>
                </div>
                <span className="hp-text">{pokemon.currentHp} / {pokemon.maxHp}</span>
            </div>
            <div className="pokemon-img-container">
                 {showFloatingText && (
                    <div className={`floating-text ${state.floatingText.type}`}>
                        {state.floatingText.message}
                    </div>
                )}
                <img id={isOpponent ? 'opponent-sprite' : 'player-sprite'} src={pokemon.sprite} alt={pokemon.name} className={pokemon.isFainted ? 'fainted' : ''}/>
            </div>
             <div className="moves-display">
                {isOpponent ? (
                    <OpponentMoves moves={pokemon.moves} lastMove={state.lastOpponentMove} />
                ) : state.isPlayerTurn && !state.isBattleOver ? (
                    <ActionButtons />
                ) : (
                    <div className="action-buttons-placeholder">Waiting...</div>
                )}
            </div>
        </div>
    );
};

const OpponentMoves = ({ moves, lastMove }: { moves: Move[], lastMove: string | null }) => (
    <div className="opponent-moves-container">
        <h3>Moves</h3>
        <div className="moves-grid">
            {moves.map(move => (
                <div key={move.id} className={`move-btn-sm ${lastMove === move.name ? 'disabled' : ''}`}>
                    <span className="move-name">{move.name}</span>
                    <TypeBadge type={move.type.name} />
                </div>
            ))}
        </div>
    </div>
);


const TypeBadge: React.FC<{ type: string }> = ({ type }) => (
    <span className="type-badge" style={{ backgroundColor: `var(--type-${type})` }}>{type}</span>
);

const ActionButtons = () => {
    const player = state.playerTeam[state.playerActivePokemonIndex];

    return (
        <div className="action-buttons-container">
            <div className="moves-grid">
                {player.moves.map(move => (
                    <button 
                        key={move.id} 
                        className="move-btn" 
                        style={{ borderColor: `var(--type-${move.type.name})` }} 
                        onClick={() => handlePlayerAction({ type: 'attack', move })}
                        disabled={state.lastPlayerMove === move.name}
                        title={state.lastPlayerMove === move.name ? "Cannot use the same move twice in a row." : `${move.name} | Power: ${move.power}`}
                    >
                        <span className="move-name">{move.name}</span>
                        <span className="move-power">Power: {move.power || '??'}</span>
                        <TypeBadge type={move.type.name} />
                    </button>
                ))}
            </div>
            {state.mode === 'team' &&
                <div id="switch-btn-container">
                    <button className="btn btn-secondary" onClick={() => handlePlayerAction({ type: 'switch' })} disabled={state.playerTeam.filter(p => !p.isFainted).length <= 1}>
                        Switch
                    </button>
                </div>
            }
        </div>
    );
};

const GameOverScreen = () => (
    <div className="modal-overlay">
        <div className="modal-content glass-container text-center">
            <h1>{state.battleResult === 'win' ? 'You Win!' : 'You Lose!'}</h1>
            
            {state.mode === 'league' && state.battleResult === 'win' ? (
                <>
                    {state.leagueRound < (LEAGUE_ROUNDS - 1) ? (
                        <>
                            <p>You defeated trainer {state.leagueRound + 1}! Get ready for the next battle.</p>
                            <div className="d-flex justify-center gap-1 mt-2">
                                <button className="btn" onClick={nextLeagueRound}>Next Opponent</button>
                                <button className="btn btn-secondary" onClick={updateMovesAndContinue}>Update Moves & Continue</button>
                            </div>
                        </>
                    ) : (
                        <>
                            <p>Congratulations! You have conquered the League of <span style={{textTransform: 'capitalize'}}>{state.category}</span>!</p>
                             <div className="d-flex justify-center gap-1 mt-2">
                                <button className="btn" onClick={goBackToStart}>Play Again</button>
                                <button className="btn btn-secondary" onClick={() => openModal(<BattleLogModal />)}>Battle Log</button>
                            </div>
                        </>
                    )}
                </>
            ) : (
                 <div className="d-flex justify-center gap-1 mt-2">
                    <button className="btn" onClick={goBackToStart}>Play Again</button>
                    <button className="btn btn-secondary" onClick={() => openModal(<BattleLogModal />)}>Battle Log</button>
                </div>
            )}
        </div>
    </div>
);

const BattleLogModal = () => (
    <div className="modal-overlay battle-log-modal">
        <div className="modal-content glass-container">
            <h2 className="text-center">Battle Log</h2>
            <div className="battle-log-content">
                {state.battleLog.map((msg, i) => <p key={i} dangerouslySetInnerHTML={{ __html: msg }}></p>)}
            </div>
            <div className="text-center">
                <button className="btn btn-secondary" onClick={closeModal}>Close</button>
            </div>
        </div>
    </div>
);

const SwitchPokemonModal = () => (
    <div className="modal-overlay">
        <div className="modal-content glass-container">
            <h2 className="text-center">Switch Pokémon</h2>
            <div id="switch-pokemon-grid">
                {state.playerTeam.map((p, i) => (
                    <div key={p.id} className={`pokemon-card ${p.isFainted || i === state.playerActivePokemonIndex ? 'fainted' : ''}`} onClick={() => !p.isFainted && i !== state.playerActivePokemonIndex && handleSwitch(i)}>
                        <img src={p.sprite} alt={p.name} />
                        <p className="pokemon-card-name">{p.name}</p>
                        <p>{p.currentHp} / {p.maxHp} HP</p>
                    </div>
                ))}
            </div>
            <div className="text-center">
                <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
            </div>
        </div>
    </div>
);

const LeagueTransitionOverlay = () => {
    const nextOpponent = state.leagueOpponents[state.leagueRound];
    if (!nextOpponent) return null;
    const nextOpponentImageUrl = getPokemonImageUrl(nextOpponent);

    return (
        <div className="modal-overlay league-transition-overlay">
            <div className="modal-content glass-container text-center">
                <h2>Round {state.leagueRound + 1}</h2>
                <div className="d-flex justify-center align-center gap-2">
                    <img src={state.playerTeam[0].sprite} style={{width: '150px'}}/>
                    <div className="vs-pokeball"></div>
                    <img src={nextOpponentImageUrl} style={{width: '150px'}}/>
                </div>
                <button className="btn" onClick={startNextLeagueBattle}>Fight!</button>
            </div>
        </div>
    );
};

const TypeChartPanel = () => {
    const [isOpen, setIsOpen] = React.useState(false);

    const chartData = React.useMemo(() => {
        return Object.entries(TYPE_CHART).map(([type, effects]) => {
            const superEffective = Object.entries(effects).filter(([, val]) => val === 2).map(([key]) => key);
            const notVery = Object.entries(effects).filter(([, val]) => val === 0.5).map(([key]) => key);
            const noEffect = Object.entries(effects).filter(([, val]) => val === 0).map(([key]) => key);
            return { type, superEffective, notVery, noEffect };
        });
    }, []);

    return (
        <>
            <button id="type-chart-toggle" onClick={() => setIsOpen(!isOpen)}>?</button>
            <div id="type-chart-panel" className={isOpen ? 'open' : ''}>
                <div className="type-chart-header">
                    <h2>Type Effectiveness</h2>
                    <button className="close-btn" onClick={() => setIsOpen(false)}>&#x2715;</button>
                </div>
                <div id="type-chart-content">
                    {chartData.map(({ type, superEffective, notVery, noEffect }) => (
                        <div key={type} className="type-effectiveness-card">
                            <div className="type-card-header">
                                <TypeBadge type={type} />
                                <span>(Attacking)</span>
                            </div>
                            <div className="type-card-body">
                                {superEffective.length > 0 && (
                                    <div className="effectiveness-row">
                                        <strong>2x DMG</strong> vs: 
                                        <div className="badges-container">{superEffective.map(t => <TypeBadge key={t} type={t} />)}</div>
                                    </div>
                                )}
                                {notVery.length > 0 && (
                                    <div className="effectiveness-row">
                                        <strong>0.5x DMG</strong> vs: 
                                        <div className="badges-container">{notVery.map(t => <TypeBadge key={t} type={t} />)}</div>
                                    </div>
                                )}
                                {noEffect.length > 0 && (
                                    <div className="effectiveness-row">
                                        <strong>0x DMG</strong> vs: 
                                        <div className="badges-container">{noEffect.map(t => <TypeBadge key={t} type={t} />)}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

// --- LOG HELPERS ---
function getTypeBadgeHTML(type: string): string {
    const style = `background-color: var(--type-${type}); display: inline-block; padding: 0.2em 0.5em; border-radius: 5px; color: white; font-size: 0.8rem; text-shadow: 1px 1px 2px black; text-transform: uppercase; font-weight: bold; margin-left: 8px; vertical-align: middle;`;
    return `<span style="${style}">${type}</span>`;
}

function formatEffectivenessMessage(message: string): string {
    if (message.includes("super effective")) {
        return `<span class="log-super-effective">${message}</span>`;
    }
    if (message.includes("not very effective")) {
        return `<span class="log-not-effective">${message}</span>`;
    }
    if (message.includes("doesn't affect")) {
        return `<span class="log-no-effect">${message}</span>`;
    }
    return message;
}

// --- GAME FLOW & ACTIONS ---
function goBackToStart() {
    Object.assign(state, {
        page: 'start', mode: null, category: null, allPokemon: [], displayedPokemon: [],
        selectionOffset: 0, selectedTeam: [], filter: '', playerTeam: [], opponentTeam: [],
        playerActivePokemonIndex: 0, opponentActivePokemonIndex: 0, battleLog: [], isPlayerTurn: true,
        isBattleOver: false, battleResult: '', leagueRound: 0, leagueOpponents: [], isStartingBattle: false,
        lastPlayerMove: null, lastOpponentMove: null, floatingText: null,
    });
    render();
}

async function loadInitialPokemon() {
    const ids = CATEGORY_POKEMON_IDS[state.category!];
    const pokemonList = ids.map(id => ({
        name: String(id), 
        url: `${POKEAPI_BASE_URL}/pokemon/${id}`
    }));
    setState({ allPokemon: pokemonList, selectionOffset: 0, displayedPokemon: [] });
    loadMorePokemon();
}

async function loadMorePokemon() {
    if (state.isLoadingMore) return;
    setState({ isLoadingMore: true });

    const nextPokemonSlice = state.allPokemon.slice(state.selectionOffset, state.selectionOffset + POKEMON_PER_PAGE);
    const pokemonDetails = await Promise.all(
        nextPokemonSlice.map(p => fetchFromApi<Pokemon>(p.url))
    );

    setState({
        displayedPokemon: [...state.displayedPokemon, ...pokemonDetails],
        selectionOffset: state.selectionOffset + POKEMON_PER_PAGE,
        isLoadingMore: false,
    });
}

async function startBattle() {
    if (state.mode === 'team' && state.selectedTeam.length !== 5) return;
    if (state.mode !== 'team' && state.selectedTeam.length !== 1) return;

    const playerBattleTeam = await Promise.all(state.selectedTeam.map(createBattlePokemon));

    let opponentPokemonChoices: Pokemon[] = [];
    if (state.mode === 'league') {
        const opponentIds = CATEGORY_POKEMON_IDS[state.category!].filter(id => id !== state.selectedTeam[0].id);
        const randomOpponentIds = opponentIds.sort(() => 0.5 - Math.random()).slice(0, LEAGUE_ROUNDS);
        const leagueOpponents = await Promise.all(randomOpponentIds.map(id => fetchFromApi<Pokemon>(`${POKEAPI_BASE_URL}/pokemon/${id}`)));
        setState({ leagueOpponents });
        opponentPokemonChoices = [leagueOpponents[0]];
    } else {
        const teamSize = state.mode === 'team' ? 5 : 1;
        const opponentIds = CATEGORY_POKEMON_IDS[state.category!].filter(id => !state.selectedTeam.some(s => s.id === id));
        const randomOpponentIds = opponentIds.sort(() => 0.5 - Math.random()).slice(0, teamSize);
        opponentPokemonChoices = await Promise.all(randomOpponentIds.map(id => fetchFromApi<Pokemon>(`${POKEAPI_BASE_URL}/pokemon/${id}`)));
    }
    
    const opponentBattleTeam = await Promise.all(opponentPokemonChoices.map(createBattlePokemon));

    setState({
        playerTeam: playerBattleTeam,
        opponentTeam: opponentBattleTeam,
        page: 'battle',
        battleLog: [
            `The battle between <strong>${playerBattleTeam[0].name}</strong> and <strong>${opponentBattleTeam[0].name}</strong> begins!`,
            `What will <strong>${playerBattleTeam[0].name}</strong> do?`
        ],
        isStartingBattle: false,
        isPlayerTurn: true,
    });
}

function handlePlayerAction(action: { type: 'attack', move: Move } | { type: 'switch' }) {
    if (!state.isPlayerTurn || state.isBattleOver) return;

    if (action.type === 'attack') {
        setState({ isPlayerTurn: false, lastPlayerMove: action.move.name });
        processTurn(state.playerTeam[state.playerActivePokemonIndex], state.opponentTeam[state.opponentActivePokemonIndex], action.move);
    } else if (action.type === 'switch') {
        // Switching is a free action for the player.
        openModal(<SwitchPokemonModal />);
    }
}

function processTurn(attacker: BattlePokemon, defender: BattlePokemon, move: Move) {
    const isPlayerAttacker = attacker === state.playerTeam[state.playerActivePokemonIndex];
    
    addLog(`<strong>${attacker.name}</strong> used <strong>${move.name}</strong>${getTypeBadgeHTML(move.type.name)}!`);
    document.getElementById(isPlayerAttacker ? 'player-sprite' : 'opponent-sprite')?.classList.add('attack-animation');

    setTimeout(() => {
        const { damage, effectiveness } = calculateDamage(attacker, defender, move);

        const defenderIsPlayer = defender === state.playerTeam[state.playerActivePokemonIndex];
        let effectivenessMessageForFloat = '';
        let effectivenessTypeForFloat: 'super-effective' | 'not-very-effective' | 'no-effect' | null = null;

        if (effectiveness.includes("super effective")) {
            effectivenessMessageForFloat = 'Super effective!';
            effectivenessTypeForFloat = 'super-effective';
        } else if (effectiveness.includes("not very effective")) {
            effectivenessMessageForFloat = 'Not very effective!';
            effectivenessTypeForFloat = 'not-very-effective';
        } else if (effectiveness.includes("doesn't affect")) {
            effectivenessMessageForFloat = "It doesn't affect...";
            effectivenessTypeForFloat = 'no-effect';
        }

        if (effectivenessTypeForFloat) {
            setState({
                floatingText: {
                    target: defenderIsPlayer ? 'player' : 'opponent',
                    message: effectivenessMessageForFloat,
                    type: effectivenessTypeForFloat,
                }
            });
            setTimeout(() => {
                setState({ floatingText: null });
            }, 1500); 
        }

        if (effectiveness) addLog(formatEffectivenessMessage(effectiveness));
        
        defender.currentHp = Math.max(0, defender.currentHp - damage);
        addLog(`It dealt <strong>${damage}</strong> damage!`);
        document.getElementById(isPlayerAttacker ? 'opponent-sprite' : 'player-sprite')?.classList.add('hit-animation');
        render(); // Update HP bar

        setTimeout(async () => {
            document.getElementById(isPlayerAttacker ? 'player-sprite' : 'opponent-sprite')?.classList.remove('attack-animation');
            document.getElementById(isPlayerAttacker ? 'opponent-sprite' : 'player-sprite')?.classList.remove('hit-animation');
            
            if (await checkFaint(defender)) return;
            
            if (isPlayerAttacker) {
                setTimeout(aiTurn, 1000);
            } else {
                setState({ isPlayerTurn: true });
                addLog(`What will <strong>${state.playerTeam[state.playerActivePokemonIndex].name}</strong> do?`);
            }
        }, 500);
    }, 500);
}

function aiTurn() {
    if (state.isBattleOver) return;
    let ai = state.opponentTeam[state.opponentActivePokemonIndex];
    const player = state.playerTeam[state.playerActivePokemonIndex];

    const performAttack = (attacker: BattlePokemon) => {
        const availableMoves = attacker.moves.filter(m => m.name !== state.lastOpponentMove);
        const movesToChooseFrom = availableMoves.length > 0 ? availableMoves : attacker.moves;
        const randomMove = movesToChooseFrom[Math.floor(Math.random() * movesToChooseFrom.length)];

        setState({ lastOpponentMove: randomMove.name });
        processTurn(attacker, player, randomMove);
    };
    
    const canSwitch = state.opponentTeam.filter(p => !p.isFainted).length > 1;
    if (ai.currentHp / ai.maxHp < 0.2 && canSwitch) {
        let newIndex;
        do {
            newIndex = Math.floor(Math.random() * state.opponentTeam.length);
        } while (newIndex === state.opponentActivePokemonIndex || state.opponentTeam[newIndex].isFainted);
        
        addLog(`<strong>${ai.name}</strong> was switched out!`);
        setState({ opponentActivePokemonIndex: newIndex, lastOpponentMove: null });
        
        const newAiPokemon = state.opponentTeam[newIndex];
        addLog(`Go, <strong>${newAiPokemon.name}</strong>!`);
        
        // After switching, the AI still gets to attack in the same turn.
        setTimeout(() => performAttack(newAiPokemon), 1000);
        return;
    }

    performAttack(ai);
}

async function checkFaint(pokemon: BattlePokemon): Promise<boolean> {
    if (pokemon.currentHp > 0) return false;

    pokemon.isFainted = true;
    addLog(`<strong>${pokemon.name}</strong> fainted!`);
    const isPlayerPokemon = state.playerTeam.includes(pokemon);
    document.getElementById(isPlayerPokemon ? 'player-sprite' : 'opponent-sprite')?.classList.add('faint-animation');

    await new Promise(resolve => setTimeout(resolve, 1000));

    const activeTeam = isPlayerPokemon ? state.playerTeam : state.opponentTeam;
    const remainingPokemon = activeTeam.filter(p => !p.isFainted);

    if (remainingPokemon.length === 0) {
        setState({ isBattleOver: true, battleResult: isPlayerPokemon ? 'lose' : 'win' });
        return true;
    }
    
    if (isPlayerPokemon) {
        addLog(`You need to switch to another Pokémon.`);
        openModal(<SwitchPokemonModal />);
    } else {
        const nextOpponentIndex = state.opponentTeam.findIndex(p => !p.isFainted);
        setState({ opponentActivePokemonIndex: nextOpponentIndex, lastOpponentMove: null });
        addLog(`Opponent sent out <strong>${state.opponentTeam[nextOpponentIndex].name}</strong>!`);
        setState({ isPlayerTurn: true });
        addLog(`What will <strong>${state.playerTeam[state.playerActivePokemonIndex].name}</strong> do?`);
    }

    return true;
}

function handleSwitch(newIndex: number) {
    const wasPlayerPokemonFainted = state.playerTeam[state.playerActivePokemonIndex].isFainted;
    
    closeModal();
    const oldPokemonName = state.playerTeam[state.playerActivePokemonIndex].name;
    
    setState({ 
        playerActivePokemonIndex: newIndex, 
        lastPlayerMove: null 
    });

    const newPokemonName = state.playerTeam[newIndex].name;
    addLog(`<strong>${oldPokemonName}</strong>, come back! Go, <strong>${newPokemonName}</strong>!`);

    // If the switch was forced because a Pokémon fainted, it becomes the player's turn.
    if (wasPlayerPokemonFainted) {
        setState({ isPlayerTurn: true });
        addLog(`What will <strong>${newPokemonName}</strong> do?`);
    }
    // For a voluntary switch, the turn was already the player's and it remains so.
    // The player can now choose an action.
}

function nextLeagueRound() {
    closeModal();
    setState({ leagueRound: state.leagueRound + 1 });
    openModal(<LeagueTransitionOverlay />);
}

async function updateMovesAndContinue() {
    openModal(
        <div className="modal-overlay">
            <div className="modal-content glass-container text-center">
                <h2>Updating moves...</h2>
                <div className="loading-spinner"></div>
            </div>
        </div>
    );
    
    const playerPokemonInfo = state.selectedTeam[0];
    
    const movePromises = playerPokemonInfo.moves
        .sort(() => 0.5 - Math.random())
        .map(m => fetchFromApi<Move>(m.move.url));
    
    const resolvedMoves = await Promise.all(movePromises);
    const newMoves = resolvedMoves.filter(m => m && m.power).slice(0, MOVES_PER_POKEMON);
    
    state.playerTeam[0].moves = newMoves;
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    nextLeagueRound();
}

async function startNextLeagueBattle() {
    closeModal();
    // Heal player's pokemon
    state.playerTeam.forEach(p => { p.currentHp = p.maxHp; p.isFainted = false; });

    const opponentPokemon = state.leagueOpponents[state.leagueRound];
    const opponentBattleTeam = await Promise.all([createBattlePokemon(opponentPokemon)]);

    setState({
        opponentTeam: opponentBattleTeam,
        playerActivePokemonIndex: 0,
        opponentActivePokemonIndex: 0,
        battleLog: [`Round ${state.leagueRound + 1}! Your opponent is <strong>${opponentBattleTeam[0].name}</strong>!`],
        isPlayerTurn: true,
        isBattleOver: false,
        battleResult: '',
        lastPlayerMove: null,
        lastOpponentMove: null,
    });
}

function addLog(message: string) {
    state.battleLog.push(message);
    if (state.battleLog.length > 100) state.battleLog.shift(); // Increase log limit
    const logEl = document.getElementById('battle-log');
    if (logEl) setTimeout(() => logEl.scrollTop = logEl.scrollHeight, 0);
    render();
}

// --- MODAL ---
function openModal(content: React.ReactElement) {
    let modalContainer = document.getElementById('modal-container');
    if (!modalContainer) {
        modalContainer = document.createElement('div');
        modalContainer.id = 'modal-container';
        document.body.appendChild(modalContainer);
    }
    createRoot(modalContainer).render(content);
}

function closeModal() {
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) {
        modalContainer.innerHTML = '';
    }
    // If we closed the switch modal without choosing (e.g. cancel), and it's a forced switch, we must reopen it.
    const player = state.playerTeam[state.playerActivePokemonIndex];
    if (player?.isFainted && !state.isBattleOver) {
        openModal(<SwitchPokemonModal />);
    }
}

// --- RENDER ---
const root = createRoot(document.getElementById('app')!);
function render() {
    root.render(<App />);
}

// --- INITIALIZE ---
render();
