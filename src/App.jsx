import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// html2canvas library will be loaded from CDN
const loadHtml2Canvas = () => {
  return new Promise((resolve, reject) => {
    if (window.html2canvas) {
      resolve(window.html2canvas);
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = () => resolve(window.html2canvas);
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

const MTGMonteCarloAnalyzer = () => {
  // State Management
  const [apiMode, setApiMode] = useState('local'); // 'local' or 'scryfall'
  const [cardsDatabase, setCardsDatabase] = useState(null);
  const [cardLookupMap, setCardLookupMap] = useState(new Map());
  const [deckText, setDeckText] = useState('');
  const [parsedDeck, setParsedDeck] = useState(null);
  const [selectedKeyCards, setSelectedKeyCards] = useState(new Set());
  const [enableMulligans, setEnableMulligans] = useState(false);
  const [mulliganRule, setMulliganRule] = useState('london'); // 'london' or 'vancouver'
  const [mulliganStrategy, setMulliganStrategy] = useState('balanced'); // 'conservative', 'balanced', 'aggressive', 'custom'
  const [customMulliganRules, setCustomMulliganRules] = useState({
    mulligan0Lands: true,
    mulligan7Lands: true,
    mulliganNoPlaysByTurn: false,
    noPlaysTurnThreshold: 2,
    mulliganMinLands: false,
    minLandsThreshold: 1,
    mulliganMaxLands: false,
    maxLandsThreshold: 5
  });
  const [includeCreatures, setIncludeCreatures] = useState(true);
  const [includeArtifacts, setIncludeArtifacts] = useState(true);
  const [disabledCreatures, setDisabledCreatures] = useState(new Set());
  const [disabledArtifacts, setDisabledArtifacts] = useState(new Set());
  const [includeExploration, setIncludeExploration] = useState(true);
  const [disabledExploration, setDisabledExploration] = useState(new Set());
  
  
  const [simulationResults, setSimulationResults] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState('');
  
  // Settings
  const [iterations, setIterations] = useState(10000);
  const [turns, setTurns] = useState(7);
  const [handSize, setHandSize] = useState(7);
  const [maxSequences, setMaxSequences] = useState(1);
  const [selectedTurnForSequences, setSelectedTurnForSequences] = useState(3);
  const [commanderMode, setCommanderMode] = useState(false); // Commander format settings

  // File upload handler
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024 * 1024) {
      setError('File too large (max 1 GB). The Scryfall Default Cards file should be around 200-300 MB.');
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!Array.isArray(data)) {
        setError('Invalid JSON format. Expected an array of card objects.');
        return;
      }

      setCardsDatabase(data);
      
      // Build lookup map - skip tokens
      const lookupMap = new Map();
      let skippedTokens = 0;
      
      data.forEach(card => {
        // Skip tokens - we only want real playable cards
        if (card.layout === 'token' || 
            card.layout === 'double_faced_token' || 
            card.set_type === 'token' || 
            card.type_line?.includes('Token')) {
          skippedTokens++;
          return;
        }
        
        const name = card.name.toLowerCase();
        
        // If a card with this name already exists, prefer the one with higher CMC
        // (real cards over tokens if somehow a token slipped through)
        if (lookupMap.has(name)) {
          const existing = lookupMap.get(name);
          if ((card.cmc || 0) > (existing.cmc || 0)) {
            lookupMap.set(name, card);
          }
        } else {
          lookupMap.set(name, card);
        }
      });
      
      setCardLookupMap(lookupMap);
      
      setError('');
      console.log(`✓ Loaded ${data.length} cards from uploaded file (${skippedTokens} tokens filtered out)`);
    } catch (err) {
      setError('Invalid JSON file. Please check the file format.');
      console.error(err);
    }
  };

  // Card lookup function
  const lookupCard = async (cardName) => {
    const searchName = cardName.toLowerCase().trim();

    // Check cache first
    if (cardLookupMap.has(searchName)) {
      return cardLookupMap.get(searchName);
    }

    // Fuzzy matching
    for (const [name, card] of cardLookupMap.entries()) {
      if (name.startsWith(searchName) || name.includes(searchName)) {
        return card;
      }
    }

    // Scryfall API fallback
    if (apiMode === 'scryfall') {
      try {
        const response = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`);
        if (response.ok) {
          const data = await response.json();
          
          // DEBUG: Log what we got from Scryfall
          if (data.cmc === 0 && data.name) {
            console.log(`🔍 Scryfall returned for "${cardName}":`, {
              name: data.name,
              type_line: data.type_line,
              layout: data.layout,
              set_type: data.set_type,
              cmc: data.cmc,
              mana_cost: data.mana_cost
            });
          }
          
          // Skip tokens - we only want real playable cards
          if (data.layout === 'token' || data.layout === 'double_faced_token' || 
              data.set_type === 'token' || data.type_line?.includes('Token')) {
            console.warn(`⚠️ Skipping token for: ${cardName}`);
            
            // Try searching for the non-token version
            const searchResponse = await fetch(`https://api.scryfall.com/cards/search?q=!"${encodeURIComponent(cardName)}"+-is:token&unique=cards&order=released`);
            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              if (searchData.data && searchData.data.length > 0) {
                const nonToken = searchData.data[0]; // Get the first non-token result
                console.log(`✅ Found non-token version:`, nonToken.name, 'CMC:', nonToken.cmc);
                cardLookupMap.set(searchName, nonToken);
                return nonToken;
              }
            }
            return null; // No non-token version found
          }
          
          cardLookupMap.set(searchName, data);
          return data;
        }
      } catch (err) {
        console.error('Scryfall API error:', err);
      }
    }

    return null;
  };

  // Known rituals list - mana-generating spells
  // Exploration effects - allow playing multiple lands per turn
  const EXPLORATION_EFFECTS = new Set([
    'exploration', 'burgeoning', 'azusa, lost but seeking', 'oracle of mul daya',
    'mina and denn, wildborn', 'wayward swordtooth', 'dryad of the ilysian grove',
    'fastbond', 'storm cauldron', 'rites of flourishing', 'summer bloom',
    'zhur-taa ancient', 'sakura-tribe scout', 'walking atlas', 'llanowar scout',
    'excavator', 'patron of the moon', 'manabond', 'budoka gardener'
  ]);

  // Mana artifacts that enter battlefield tapped
  const ENTERS_TAPPED_ARTIFACTS = new Set([
    'coldsteel heart',
    'fractured powerstone',
    'guardian idol',
    'star compass',
    'charcoal diamond',
    'fire diamond',
    'marble diamond',
    'moss diamond',
    'sky diamond',
  ]);

  // Special lands with unique mechanics
  const SPECIAL_LANDS = new Set([
    'ancient tomb',
    'city of traitors'
  ]);

  // Special mana artifacts with unique mechanics
  const SPECIAL_ARTIFACTS = new Set([
    'basalt monolith',
    'grim monolith',
    'mana vault',
    'mox diamond',
    'chrome mox',
    'mox opal',
    'mox amber'
  ]);

  // Known fetch lands list
  const KNOWN_FETCH_LANDS = new Set([
    'scalding tarn', 'misty rainforest', 'verdant catacombs', 'marsh flats', 'arid mesa',
    'polluted delta', 'flooded strand', 'bloodstained mire', 'wooded foothills', 'windswept heath',
    'prismatic vista', 'fabled passage', 'evolving wilds', 'terramorphic expanse',
    'flood plain', 'bad river', 'rocky tar pit', 'mountain valley', 'grasslands',
    'panorama', 'myriad landscape', 'warped landscape',
    // Hideaway fetch lands (Streets of New Capenna)
    'obscura storefront', 'maestros theater', 'riveteers overlook', 'cabaretti courtyard', 'brokers hideout',
    // Landscape fetch lands (Modern Horizons 3) - {1}, T, Sacrifice: fetch basic of 2 types
    'bountiful landscape', 'contaminated landscape', 'deceptive landscape', 'foreboding landscape',
    'perilous landscape', 'seething landscape', 'shattered landscape', 'sheltering landscape',
    'tranquil landscape', 'twisted landscape',
    // Other landscape-type fetch lands
    'ash barrens',
    // Additional fetch lands
    'multiversal passage'  // Fetches basic, enters tapped
  ]);

  // Comprehensive land cycle detection
  const LANDS_ENTER_TAPPED_ALWAYS = new Set([
    // Tri-Lands (Shards/Khans)
    'seaside citadel', 'crumbling necropolis', 'arcane sanctum', 'savage lands', 'jungle shrine',
    'frontier bivouac', 'mystic monastery', 'nomad outpost', 'sandsteppe citadel', 'opulent palace',
    
    // Tri-Lands (Ikoria Triomes - have basic land types, can be fetched)
    'savai triome', 'raugrin triome', 'ketria triome', 'indatha triome', 'zagoth triome',
    
    // Tri-Lands (Streets of New Capenna)
    'raffine\'s tower', 'spara\'s headquarters', 'ziatora\'s proving ground', 'jetmir\'s garden', 'xander\'s lounge',
    
    // Depletion Lands (Mercadian Masques)
    'saprazzan skerry', 'remote farm', 'rushwood grove', 'sandstone needle', 'hickory woodlot',
    'peat bog', 'everglades', 'timberline ridge', 'caldera lake', 'hollow trees',
    
    // Gain Lands (Core Set)
    'tranquil cove', 'dismal backwater', 'bloodfell caves', 'rugged highlands', 'blossoming sands',
    'scoured barrens', 'swiftwater cliffs', 'jungle hollow', 'wind-scarred crag', 'thornwood falls',
    
    // Coastal Lands
    'coastal tower', 'salt marsh', 'urborg volcano', 'shivan oasis', 'elfhame palace',
    
    // Wedge Tap Lands
    'sandsteppe citadel', 'mystic monastery', 'opulent palace', 'nomad outpost', 'frontier bivouac',
    
    // Bicycle Lands (Amonkhet)
    'irrigated farmland', 'fetid pools', 'canyon slough', 'sheltered thicket', 'scattered groves',
    
    // Temples (Theros)
    'temple of enlightenment', 'temple of deceit', 'temple of malice', 'temple of abandon', 'temple of plenty',
    'temple of silence', 'temple of epiphany', 'temple of malady', 'temple of triumph', 'temple of mystery',
    
    // Surveil Lands (Murders at Karlov Manor - have basic land types)
    'meticulous archive', 'undercity sewers', 'raucous theater', 'commercial district', 'lush portico',
    'shadowy backstreet', 'thundering falls', 'underground mortuary', 'elegant parlor', 'hedge maze',
    
    // Utility Lands that enter tapped
    'path of ancestry',  // Produces any color, scry 1 when creature ETB
    
    // Utility Lands (enter tapped)
    'path of ancestry',  // Commander staple, produces any color
    
    // Refuges
    'sejiri refuge', 'jwar isle refuge', 'akoum refuge', 'kazandu refuge', 'graypelt refuge',
    
    // Guildgates
    'azorius guildgate', 'dimir guildgate', 'rakdos guildgate', 'gruul guildgate', 'selesnya guildgate',
    'orzhov guildgate', 'izzet guildgate', 'golgari guildgate', 'boros guildgate', 'simic guildgate',
    
    // Bounce Lands (Ravnica Karoos) - Enter tapped AND bounce
    'azorius chancery', 'dimir aqueduct', 'rakdos carnarium', 'gruul turf', 'selesnya sanctuary',
    'orzhov basilica', 'izzet boilerworks', 'golgari rot farm', 'boros garrison', 'simic growth chamber',
    
    // Slow Lands (Midnight Hunt/Crimson Vow)
    'deserted beach', 'haunted ridge', 'overgrown farmland', 'rockfall vale', 'shipwreck marsh',
    
    // Tango/Battle Lands (Battle for Zendikar) - Usually tapped unless 2+ basics
    'prairie stream', 'sunken hollow', 'smoldering marsh', 'cinder glade', 'canopy vista',
    
    // Pathway Lands (back side enters tapped)
    // Note: Front side enters untapped, back side tapped - handled separately
    
    // Snow Tap Lands
    'arctic flats', 'boreal shelf', 'frost marsh', 'highland weald', 'tresserhorn sinks',
    
    // Various Other Tap Lands
    'crystal grotto', 'survivor\'s encampment', 'holdout settlement', 'painted bluffs', 'shimmerdrift vale',
    'gateway plaza', 'rupture spire', 'transguild promenade', 'gond gate', 'baldur\'s gate',
    
    // Thriving Lands
    'thriving bluff', 'thriving grove', 'thriving heath', 'thriving isle', 'thriving moor',
    
    // Special fetches that enter tapped
    'myriad landscape'
  ]);

  // Bounce Lands (return a land to hand)
  const BOUNCE_LANDS = new Set([
    'azorius chancery', 'dimir aqueduct', 'rakdos carnarium', 'gruul turf', 'selesnya sanctuary',
    'orzhov basilica', 'izzet boilerworks', 'golgari rot farm', 'boros garrison', 'simic growth chamber',
    'coral atoll', 'dormant volcano', 'everglades', 'jungle basin', 'karoo',
    'slippery karst', 'smoldering crater', 'polluted mire', 'remote isle', 'drifting meadow'
  ]);

  // Reveal Lands (enter tapped unless you reveal appropriate land from hand)
  const REVEAL_LANDS = new Set([
    'port town', 'choked estuary', 'foreboding ruins', 'game trail', 'fortified village'
  ]);

  // Check Lands (enter tapped unless you control appropriate land type)
  const CHECK_LANDS = new Set([
    'glacial fortress', 'drowned catacomb', 'dragonskull summit', 'rootbound crag', 'sunpetal grove',
    'isolated chapel', 'sulfur falls', 'woodland cemetery', 'clifftop retreat', 'hinterland harbor'
  ]);

  // Fast Lands (enter untapped if you control 2 or fewer other lands)
  const FAST_LANDS = new Set([
    'seachrome coast', 'darkslick shores', 'blackcleave cliffs', 'copperline gorge', 'razorverge thicket',
    'concealed courtyard', 'spirebluff canal', 'blooming marsh', 'inspiring vantage', 'botanical sanctum'
  ]);

  // Pain Lands (always enter untapped, can tap for colorless or pay 1 life for color)
  const PAIN_LANDS = new Set([
    'adarkar wastes', 'underground river', 'sulfurous springs', 'karplusan forest', 'brushland',
    'caves of koilos', 'shivan reef', 'llanowar wastes', 'battlefield forge', 'yavimaya coast'
  ]);

  // 5-Color Pain Lands (produce any color, 1 damage when tapped)
  const FIVE_COLOR_PAIN_LANDS = new Set([
    'mana confluence',
    'city of brass'
  ]);

  // Filter Lands (enter tapped, can filter mana)
  const FILTER_LANDS = new Set([
    'mystic gate', 'sunken ruins', 'graven cairns', 'fire-lit thicket', 'wooded bastion',
    'fetid heath', 'cascade bluffs', 'twilight mire', 'rugged prairie', 'flooded grove'
  ]);

  // Horizon Lands (enter untapped, can be cycled)
  const HORIZON_LANDS = new Set([
    'horizon canopy', 'grove of the burnwillows', 'nimbus maze', 'river of tears', 'graven cairns'
  ]);

  // Man Lands (creature lands - enter tapped)
  const MAN_LANDS = new Set([
    'celestial colonnade', 'creeping tar pit', 'lavaclaw reaches', 'raging ravine', 'stirring wildwood',
    'shambling vent', 'wandering fumarole', 'hissing quagmire', 'needle spires', 'lumbering falls'
  ]);

  // Storage Lands (enter tapped)
  const STORAGE_LANDS = new Set([
    'calciform pools', 'dreadship reef', 'molten slagheap', 'fungal reaches', 'saltcrusted steppe'
  ]);

  // Crowd Lands (enter tapped unless opponent has 2+)
  const CROWD_LANDS = new Set([
    'luxury suite', 'morphic pool', 'spire garden', 'bountiful promenade', 'sea of clouds',
    'spectator seating', 'undergrowth stadium', 'training center', 'vault of champions', 'rejuvenating springs'
  ]);

  // Utility Lands (always enter untapped, special effects)
  const UTILITY_LANDS_UNTAPPED = new Set([
    'reliquary tower',    // No maximum hand size
    'command tower'       // Produces colors in commander's identity
    // Starting Town has special turn-based logic (see below)
  ]);

  // Odyssey/Fallout Filter Lands (enter untapped, {1} for colored mana)
  const ODYSSEY_FILTER_LANDS = new Set([
    // Odyssey cycle
    'darkwater catacombs', 'shadowblood ridge', 'mossfire valley', 'skycloud expanse', 'sungrass prairie',
    // Fallout cycle (same mechanics)
    'desolate mire', 'ferrous lake', 'viridescent bog', 'sunscorched divide', 'overflowing basin'
  ]);

  // Hideaway Lands (Streets of New Capenna - enter tapped)
  const HIDEAWAY_LANDS = new Set([
    'obscura storefront', 'maestros theater', 'riveteers overlook', 'cabaretti courtyard', 'brokers hideout'
  ]);

  // Conditional Lands that enter tapped (opponent life total, etc.)
  const CONDITIONAL_LIFE_LANDS = new Set([
    'raucous carnival' // Enters tapped unless opponent has 13 or less life
  ]);

  // Battle Lands / Tango Lands (enter tapped unless you control 2+ basic lands)
  const BATTLE_LANDS = new Set([
    'prairie stream', 'sunken hollow', 'smoldering marsh', 'cinder glade', 'canopy vista',
    'port town', 'choked estuary', 'foreboding ruins', 'game trail', 'fortified village' // These are reveal lands but similar
  ]);

  // Pathway Lands (MDFC - front side enters untapped, back side enters tapped)
  // Note: These are handled in processLand as MDFCs
  const PATHWAY_LANDS = new Set([
    // Zendikar Rising
    'needleverge pathway', 'pillarverge pathway', 'riverglide pathway', 'lavaglide pathway',
    'cragcrown pathway', 'timbercrown pathway', 'branchloft pathway', 'boulderloft pathway',
    'brightclimb pathway', 'grimclimb pathway', 'clearwater pathway', 'murkwater pathway',
    // Kaldheim
    'hengegate pathway', 'mistgate pathway', 'darkbore pathway', 'slitherbore pathway',
    'blightstep pathway', 'searstep pathway', 'barkchannel pathway', 'tidechannel pathway',
    'snowfield pathway', 'alpine pathway'
  ]);

  // Card processing functions
  const processCardData = (data) => {
    let frontFace = data;
    let isMDFC = false;

    // Handle MDFC - but exclude transform cards
    // Transform cards (like Legion's Landing) are NOT modal double-faced cards
    // They are regular cards that transform, so the front face determines the type
    if (data.card_faces && data.card_faces.length > 0) {
      const layout = data.layout?.toLowerCase() || '';
      
      // Only treat as MDFC if it's actually a modal double-faced card
      // Layouts: 'modal_dfc', 'transform', 'double_faced_token', etc.
      if (layout === 'modal_dfc') {
        frontFace = data.card_faces[0];
        const backFace = data.card_faces[1];
        isMDFC = true;
        
        // Check both faces
        const frontIsLand = frontFace.type_line?.toLowerCase().includes('land');
        const backIsLand = backFace.type_line?.toLowerCase().includes('land');
        
        // If EITHER side is a land, it can be played as a land
        if (frontIsLand || backIsLand) {
          // For land side, use the land face
          const landFace = frontIsLand ? frontFace : backFace;
          return processLand(data, landFace, isMDFC);
        }
        
        // If front is not a land, process as spell (even if back is land)
        // This allows MDFCs like Kazuul's Fury to be selected as key cards
        // The land will be processed separately above
      }
      // For transform cards, treat as regular spell (front face only)
      else if (layout === 'transform' || layout === 'double_faced_token') {
        // Use front face type to determine card type
        frontFace = data.card_faces[0];
        isMDFC = false; // Not a modal DFC
      }
    }

    // Regular land check
    const isLand = !isMDFC && data.type_line?.toLowerCase().includes('land');
    if (isLand) {
      return processLand(data, data, false);
    }

    // Check for mana production ability
    const hasManaTap = hasManaTapAbility(data.oracle_text || frontFace.oracle_text);
    
    // Mana creature check (includes artifact creatures)
    const cardName = data.name.toLowerCase();
    const isCreature = (data.type_line || frontFace.type_line)?.includes('Creature');
    if (isCreature && hasManaTap) {
      return processManaCreature(data);
    }

    // Mana artifact check (only non-creature artifacts)
    const isArtifact = (data.type_line || frontFace.type_line)?.includes('Artifact');
    if (isArtifact && !isCreature && hasManaTap) {
      return processManaArtifact(data);
    }

    // Check for exploration effects (allows playing multiple lands per turn)
    if (EXPLORATION_EFFECTS.has(cardName)) {
      return processExploration(data);
    }

    // Regular spell
    return processSpell(data);
  };

  const hasManaTapAbility = (oracleText) => {
    if (!oracleText) return false;
    return /\{t\}:?\s*add|add\s*\{[wubrgc]/i.test(oracleText);
  };

  const processLand = (data, face, isMDFC) => {
    const name = data.name.toLowerCase();
    const oracleText = face.oracle_text || '';
    
    // CRITICAL: Exclude transform cards that have land on back side
    // These cannot be played as lands directly (e.g., Profane Procession, Legion's Landing)
    if (data.layout === 'transform' && data.card_faces && data.card_faces.length > 0) {
      const frontFace = data.card_faces[0];
      const backFace = data.card_faces[1];
      const frontIsLand = frontFace.type_line?.toLowerCase().includes('land');
      const backIsLand = backFace.type_line?.toLowerCase().includes('land');
      
      // If front is NOT a land but back is, this is a transform card
      // that transforms INTO a land - cannot be played as land
      if (!frontIsLand && backIsLand) {
        return null; // Return null to indicate this shouldn't be processed as a land
      }
    }
    
    // Detect fetch land
    const isFetch = KNOWN_FETCH_LANDS.has(name) || 
                    (oracleText.includes('search your library') && 
                     oracleText.includes('land card') && 
                     oracleText.includes('battlefield'));

    let fetchType = null;
    let fetchColors = [];
    let isHideawayFetch = false;
    let fetchesOnlyBasics = false;
    let fetchesTwoLands = false;
    let fetchcost = 0;
    let fetchedLandEntersTapped = false; // Does the fetched land enter tapped?
    
    if (isFetch) {
      // Check for hideaway fetch (enters tapped, sacrifices itself, fetches basic)
      if (HIDEAWAY_LANDS.has(name)) {
        fetchType = 'hideaway';
        isHideawayFetch = true;
        fetchesOnlyBasics = true;
        
        // Hideaway lands fetch basics of their color(s)
        // Parse from the card's mana production
        if (oracleText.includes('{T}: Add')) {
          const manaSymbols = oracleText.match(/\{[WUBRGC]\}/g);
          if (manaSymbols) {
            const colorToType = {
              'W': 'Plains', 'U': 'Island', 'B': 'Swamp', 'R': 'Mountain', 'G': 'Forest'
            };
            const colors = [...new Set(manaSymbols.map(s => s.replace(/[{}]/g, '')))];
            fetchColors = colors.map(c => colorToType[c] || c).filter(Boolean);
          }
        }
      }
      // Myriad Landscape: Special - fetches TWO basics of same type
      else if (name === 'myriad landscape') {
        fetchType = 'mana_cost';
        fetchesOnlyBasics = true;
        fetchesTwoLands = true;
        fetchcost = 2;
        entersTappedAlways = true;
        fetchedLandEntersTapped = true; // Lands enter tapped
        // Can fetch any basic type (all 5 colors)
        fetchColors = ['W', 'U', 'B', 'R', 'G'];
      }
      // Warped Landscape: Similar to Myriad but different cost
      else if (name === 'warped landscape') {
        fetchType = 'free_slow'; // Free activation
        fetchesOnlyBasics = true;
        fetchedLandEntersTapped = true; // Lands enter tapped
        // Can fetch any basic type (all 5 colors)
        fetchColors = ['W', 'U', 'B', 'R', 'G'];
      }
      // Panorama cycle: {1}, T, Sacrifice: Search for basic land of specific types
      else if (name.includes('panorama')) {
        fetchType = 'mana_cost';
        fetchesOnlyBasics = true;
        fetchcost = 1;
        fetchedLandEntersTapped = true; // Lands enter tapped
        
        // Parse which basic types from oracle text
        const typeMatch = oracleText.match(/(Plains|Island|Swamp|Mountain|Forest)/g);
        if (typeMatch) {
          const typeToColor = {
            'Plains': 'W', 'Island': 'U', 'Swamp': 'B', 'Mountain': 'R', 'Forest': 'G'
          };
          fetchColors = [...new Set(typeMatch.map(t => typeToColor[t]))];
        }
      }
      // Landscape cycle (Modern Horizons 3): {1}, T, Sacrifice: Search for basic land of 2 specific types
      else if ((name.includes('landscape') ) && 
               name !== 'myriad landscape' && name !== 'warped landscape' && name !== 'blasted landscape') {
        fetchType = 'mana_cost';
        fetchesOnlyBasics = true;
        fetchcost = 1;
        fetchedLandEntersTapped = true; // Lands enter tapped
        
        // Parse which basic types from oracle text
        const typeMatch = oracleText.match(/(Plains|Island|Swamp|Mountain|Forest)/g);
        if (typeMatch) {
          const typeToColor = {
            'Plains': 'W', 'Island': 'U', 'Swamp': 'B', 'Mountain': 'R', 'Forest': 'G'
          };
          fetchColors = [...new Set(typeMatch.map(t => typeToColor[t]))];
        }
      }
      // Check for "basic land" in oracle text (Terramorphic Expanse, Evolving Wilds, etc.)
      else if (oracleText.toLowerCase().includes('basic land')) {
        fetchType = 'free_slow';
        fetchesOnlyBasics = true;
        fetchedLandEntersTapped = true; // These fetches put lands in tapped
        
        // These can fetch any basic (all 5 colors)
        fetchColors = ['W', 'U', 'B', 'R', 'G'];
      }
      // Regular fetch land detection
      else if (oracleText.toLowerCase().includes('pay 1 life') && !oracleText.toLowerCase().includes('tapped')) {
        fetchType = 'classic';
      } else if (oracleText.toLowerCase().includes('pay 1 life') && oracleText.toLowerCase().includes('tapped')) {
        fetchType = 'slow';
      } else if (oracleText.match(/\{[0-9]+\}/)) {
        fetchType = 'mana_cost';
      } else {
        fetchType = 'free_slow';
      }

      // Extract fetch colors for non-hideaway fetches that don't only fetch basics
      if (!isHideawayFetch && !fetchesOnlyBasics) {
        const typeMatch = oracleText.match(/(Plains|Island|Swamp|Mountain|Forest)/g);
        if (typeMatch) {
          const typeToColor = {
            'Plains': 'W', 'Island': 'U', 'Swamp': 'B', 'Mountain': 'R', 'Forest': 'G'
          };
          fetchColors = [...new Set(typeMatch.map(t => typeToColor[t]))];
        }
      }
    }

    // Extract land subtypes
    const landSubtypes = [];
    if (face.type_line) {
      const types = face.type_line.split('—')[1];
      if (types) {
        const basicTypes = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'];
        basicTypes.forEach(type => {
          if (types.includes(type)) landSubtypes.push(type);
        });
      }
    }

    // Detect if this is a basic land
    // Basic lands have the "Basic" supertype in their type_line
    const isBasic = face.type_line?.includes('Basic') || 
                    // Also check by name for common basics
                    ['plains', 'island', 'swamp', 'mountain', 'forest', 'wastes'].includes(name);

    // Extract mana production
    const produces = [];
    
    // Special case: 5-color pain lands produce all 5 colors
    if (FIVE_COLOR_PAIN_LANDS.has(name)) {
      produces.push('W', 'U', 'B', 'R', 'G');
    } 
    // Special case: Command Tower and Path of Ancestry produce all 5 colors
    else if (name === 'command tower' || name === 'path of ancestry') {
      produces.push('W', 'U', 'B', 'R', 'G');
    } 
    else if (oracleText.includes('{T}: Add')) {
      const manaSymbols = oracleText.match(/\{[WUBRGC]\}/g);
      if (manaSymbols) {
        manaSymbols.forEach(symbol => {
          const color = symbol.replace(/[{}]/g, '');
          if (!produces.includes(color)) produces.push(color);
        });
      }
      
      if (oracleText.includes('any color') || oracleText.includes('mana of any color')) {
        produces.push('W', 'U', 'B', 'R', 'G');
      }
    }
    
    // Special case: Ancient Tomb produces {C}{C}
    // City of Traitors produces {C}{C}
    const manaAmount = (name === 'ancient tomb' || name === 'city of traitors') ? 2 : 1;

    // Determine if enters tapped using comprehensive lists
    let entersTappedAlways = false;
    let isBounce = false;
    let isReveal = false;
    let isCheck = false;
    let isFast = false;
    let isBattleLand = false;
    let isPathway = false;
    
    // Check hardcoded lists first (most reliable)
    // Determine if this land has internal logic (vs. pure oracle text parsing)
    let hasInternalLogic = false;
    
    // Check if land is in any special set (has hardcoded logic)
    if (FIVE_COLOR_PAIN_LANDS.has(name) || HIDEAWAY_LANDS.has(name) || KNOWN_FETCH_LANDS.has(name) ||  
        CONDITIONAL_LIFE_LANDS.has(name) || BOUNCE_LANDS.has(name) ||
        BATTLE_LANDS.has(name) || PATHWAY_LANDS.has(name) || CHECK_LANDS.has(name) ||
        FAST_LANDS.has(name) || CROWD_LANDS.has(name) || ODYSSEY_FILTER_LANDS.has(name) ||
        PAIN_LANDS.has(name) || name === 'starting town' || name === 'ancient tomb' ||
        name === 'city of traitors') {
      hasInternalLogic = true;
    }
    
    if (LANDS_ENTER_TAPPED_ALWAYS.has(name)) {
      entersTappedAlways = true;
    } else if (HIDEAWAY_LANDS.has(name)) {
      entersTappedAlways = true;
    } else if (CONDITIONAL_LIFE_LANDS.has(name)) {
      // These enter tapped unless opponent condition (conservative: always tapped)
      entersTappedAlways = true;
    } else if (BOUNCE_LANDS.has(name)) {
      entersTappedAlways = true;
      isBounce = true;
    } else if (BATTLE_LANDS.has(name)) {
      // Battle lands: enter tapped unless you control 2+ basic lands
      isBattleLand = true;
    } else if (PATHWAY_LANDS.has(name)) {
      // Pathway lands are MDFCs - front enters untapped
      isPathway = true;
    } else if (REVEAL_LANDS.has(name)) {
      // Reveal lands: enter tapped unless you reveal appropriate land
      // For simulation: assume conservative (always tapped)
      entersTappedAlways = true;
      isReveal = true;
    } else if (CHECK_LANDS.has(name)) {
      // Check lands: enter tapped unless you control appropriate basic type
      // Will be checked dynamically in doesLandEnterTapped
      isCheck = true;
    } else if (FAST_LANDS.has(name)) {
      // Fast lands: enter untapped if 2 or fewer other lands
      // Will be checked dynamically in doesLandEnterTapped
      isFast = true;
    } else if (PAIN_LANDS.has(name)) {
      // Pain lands always enter untapped
      entersTappedAlways = false;
    } else if (FIVE_COLOR_PAIN_LANDS.has(name)) {
      // 5-color pain lands (Mana Confluence, City of Brass) always enter untapped
      entersTappedAlways = false;
    } else if (FILTER_LANDS.has(name)) {
      entersTappedAlways = false; // Filter lands enter UNTAPPED
    } else if (MAN_LANDS.has(name)) {
      entersTappedAlways = true;
    } else if (STORAGE_LANDS.has(name)) {
      entersTappedAlways = true;
    } else if (CROWD_LANDS.has(name)) {
      // Crowd lands: enter condition depends on Commander Mode
      // Logic moved to doesLandEnterTapped() which has access to commanderMode
      entersTappedAlways = undefined; // Will be determined at runtime
    } else if (UTILITY_LANDS_UNTAPPED.has(name)) {
      // Utility lands always enter untapped
      entersTappedAlways = false;
    } else if (ODYSSEY_FILTER_LANDS.has(name)) {
      // Odyssey/Fallout filter lands enter untapped
      // Note: They require {1} for colored mana, but we simplify to always produce colored
      entersTappedAlways = false;
    } else {
      // Fallback to oracle text parsing
      const hasEntersTappedText = oracleText.toLowerCase().includes('enters the battlefield tapped') ||
                                   oracleText.toLowerCase().includes('enters tapped');
      const hasUnlessCondition = oracleText.includes('unless') || 
                                 oracleText.includes('if you control') ||
                                 oracleText.includes('if an opponent') ||
                                 oracleText.includes('As ~ enters');
      
      entersTappedAlways = hasEntersTappedText && !hasUnlessCondition;
    }
    
    const isShockLand = landSubtypes.length === 2 && 
                        oracleText.includes('pay 2 life');

    const hasCondition = oracleText.includes('unless you have two or more opponents') ||
                        oracleText.includes('unless you control') ||
                        oracleText.includes('unless an opponent');

    // Special land mechanics
    const isAncientTomb = name === 'ancient tomb';
    const isCityOfTraitors = name === 'city of traitors';
    const isPainLand = PAIN_LANDS.has(name);
    const isFiveColorPainLand = FIVE_COLOR_PAIN_LANDS.has(name);
    
    // Ancient Tomb: deals 2 damage when tapped for mana
    // City of Traitors: sacrificed when another land is played
    // Pain Lands: deal 1 damage when tapped for colored mana
    // 5-Color Pain Lands: deal 1 damage when tapped for mana

    return {
      name: data.name,
      type: 'land',
      isLand: true,
      isBasic,
      isFetch,
      fetchType,
      fetchColors,
      fetchesOnlyBasics,
      fetchesTwoLands,
      fetchedLandEntersTapped,
      isHideawayFetch,
      landSubtypes,
      produces,
      fetchcost, // How much it costs for fetching 
      manaAmount, // How much mana this land produces (1 for normal, 2 for Ancient Tomb/City)
      entersTappedAlways,
      isShockLand,
      hasCondition,
      isBounce,
      isReveal,
      isCheck,
      isFast,
      isBattleLand,
      isPathway,
      isAncientTomb,
      isCityOfTraitors,
      isPainLand,
      isFiveColorPainLand,
      hasInternalLogic, // Flag: true if land has hardcoded logic, false if pure oracle parsing
      cmc: 0,
      manaCost: '',
      oracleText
    };
  };

  const processManaArtifact = (data) => {
    const produces = extractManaProduction(data.oracle_text);
    const manaAmount = extractManaAmount(data.oracle_text);
    
    // Check if artifact enters tapped
    const cardName = data.name.toLowerCase();
    const oracle = (data.oracle_text || '').toLowerCase();
    
    const entersTapped = ENTERS_TAPPED_ARTIFACTS.has(cardName) ||
                        oracle.includes('enters tapped') ||
                        oracle.includes('enters the battlefield tapped');

    // Special artifact mechanics
    const isBasaltMonolith = cardName === 'basalt monolith';
    const isGrimMonolith = cardName === 'grim monolith';
    const isManaVault = cardName === 'mana vault';
    const isMoxDiamond = cardName === 'mox diamond';
    const isChromeMox = cardName === 'chrome mox';
    const isMoxOpal = cardName === 'mox opal';
    const isMoxAmber = cardName === 'mox amber';
    
    // Basalt/Grim Monolith/Mana Vault produce 3 colorless
    let finalManaAmount = manaAmount;
    if (isBasaltMonolith || isGrimMonolith || isManaVault) {
      finalManaAmount = 3;
    }
    
    // Basalt Monolith, Grim Monolith, and Mana Vault don't untap during untap step
    const doesntUntapNaturally = isBasaltMonolith || isGrimMonolith || isManaVault;

    return {
      name: data.name,
      type: 'artifact',
      isManaArtifact: true,
      produces,
      manaAmount: finalManaAmount,
      entersTapped,
      isBasaltMonolith,
      isGrimMonolith,
      isManaVault,
      isMoxDiamond,
      isChromeMox,
      isMoxOpal,
      isMoxAmber,
      doesntUntapNaturally,
      cmc: calculateCMC(data.cmc, data.mana_cost),
      manaCost: data.mana_cost || '',
      oracleText: data.oracle_text
    };
  };

  const processManaCreature = (data) => {
    const produces = extractManaProduction(data.oracle_text);
    const manaAmount = extractManaAmount(data.oracle_text);

    return {
      name: data.name,
      type: 'creature',
      isManaCreature: true,
      produces,
      manaAmount,
      cmc: calculateCMC(data.cmc, data.mana_cost),
      manaCost: data.mana_cost || '',
      oracleText: data.oracle_text
    };
  };

  const processExploration = (data) => {
    // Determine how many lands this allows per turn
    const cardName = data.name.toLowerCase();
    let landsPerTurn = 2; // Default for most exploration effects
    
    if (cardName.includes('azusa')) {
      landsPerTurn = 3;
    }
    
    // Check if it's a creature or artifact
    const isCreature = data.type_line?.includes('Creature');
    const isArtifact = data.type_line?.includes('Artifact');
    
    return {
      name: data.name,
      type: 'exploration',
      isExploration: true,
      isCreature: isCreature,
      isArtifact: isArtifact,
      landsPerTurn: landsPerTurn,
      cmc: calculateCMC(data.cmc, data.mana_cost),
      manaCost: data.mana_cost || '',
      oracleText: data.oracle_text
    };
  };

  const processSpell = (data) => {
    // For cards with card_faces (MDFCs, transform cards), we need to get data from the front face
    let cmc = data.cmc;
    let manaCost = data.mana_cost;
    let oracleText = data.oracle_text;
    let typeLine = data.type_line;
    
    // If card has card_faces and is missing main-level data, use front face
    if (data.card_faces && data.card_faces.length > 0) {
      const frontFace = data.card_faces[0];
      
      // Use front face data if main card data is missing
      if (cmc === undefined || cmc === null) {
        cmc = frontFace.cmc;
      }
      if (!manaCost && frontFace.mana_cost) {
        manaCost = frontFace.mana_cost;
      }
      if (!oracleText && frontFace.oracle_text) {
        oracleText = frontFace.oracle_text;
      }
      if (!typeLine && frontFace.type_line) {
        typeLine = frontFace.type_line;
      }
    }
    
    const calculatedCMC = calculateCMC(cmc, manaCost);
    
    // DEBUG: Log if CMC is 0 to help diagnose
    if (calculatedCMC === 0 && data.name) {
      console.log('⚠️ CMC is 0 for:', data.name);
      console.log('  data.cmc:', data.cmc);
      console.log('  data.mana_cost:', data.mana_cost);
      console.log('  final cmc:', cmc);
      console.log('  final manaCost:', manaCost);
      console.log('  has card_faces:', !!data.card_faces);
    }
    
    return {
      name: data.name,
      type: 'spell',
      cmc: calculatedCMC,
      manaCost: manaCost || '',
      oracleText: oracleText,
      typeLine: typeLine
    };
  };

  const extractManaProduction = (oracleText) => {
    if (!oracleText) return [];
    
    const produces = [];
    const manaSymbols = oracleText.match(/\{[WUBRGC]\}/g);
    
    if (manaSymbols) {
      manaSymbols.forEach(symbol => {
        const color = symbol.replace(/[{}]/g, '');
        if (!produces.includes(color)) produces.push(color);
      });
    }

    if (oracleText.includes('any color') || oracleText.includes('mana of any color')) {
      return ['W', 'U', 'B', 'R', 'G'];
    }

    return produces;
  };

  const extractManaAmount = (oracleText) => {
    if (!oracleText) return 1;
    
    // Check for {C}{C} patterns
    const colorlessMatch = oracleText.match(/\{C\}\{C\}/);
    if (colorlessMatch) return 2;

    // Default to 1
    return 1;
  };

  const extractRitualManaAmount = (oracleText) => {
    if (!oracleText) return 1;
    
    // Look for patterns like "Add {B}{B}{B}"
    const manaSymbols = oracleText.match(/Add\s+(\{[WUBRGC]\})+/i);
    if (manaSymbols) {
      const symbols = manaSymbols[0].match(/\{[WUBRGC]\}/g);
      if (symbols) return symbols.length;
    }
    
    // Look for "add three mana" or "add four mana" patterns
    const wordMatch = oracleText.match(/add\s+(one|two|three|four|five|six|seven)\s+mana/i);
    if (wordMatch) {
      const wordToNum = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };
      return wordToNum[wordMatch[1].toLowerCase()] || 1;
    }
    
    // Look for numeric patterns like "add X mana"
    const numMatch = oracleText.match(/add\s+(\d+)\s+mana/i);
    if (numMatch) {
      return parseInt(numMatch[1]) || 1;
    }
    
    // Default to 1
    return 1;
  };

  const calculateCMC = (dataCmc, manaCostString) => {
    // Start with the provided CMC
    let cmc = dataCmc;
    
    // If we have a mana cost string, calculate from it
    if (manaCostString) {
      let calculatedCmc = 0;
      const symbols = manaCostString.match(/\{([^}]+)\}/g) || [];
      
      symbols.forEach(symbol => {
        const clean = symbol.replace(/[{}]/g, '');
        const num = parseInt(clean);
        
        if (!isNaN(num)) {
          calculatedCmc += num;
        } else if (clean !== 'X' && clean !== 'Y' && clean !== 'Z') {
          calculatedCmc += 1;
        }
      });

      // Use calculated CMC if we don't have a valid dataCmc
      if (cmc === undefined || cmc === null || (cmc === 0 && calculatedCmc > 0)) {
        cmc = calculatedCmc;
      }
    }

    // Convert to integer, default to 0 if all else fails
    const result = parseInt(cmc);
    
    // Return the result, but if it's NaN, return 0
    return isNaN(result) ? 0 : result;
  };

  // Deck parsing
  const parseDeckList = async (deckText) => {
    if (!deckText.trim()) {
      setError('Please enter a deck list');
      return null;
    }

    if (!cardsDatabase && apiMode === 'local') {
      setError('Please upload cards.json file first');
      return null;
    }

    const lines = deckText.split('\n');
    const cardCounts = new Map();
    const errors = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.toLowerCase() === 'deck' || 
          trimmed.toLowerCase() === 'sideboard' || 
          trimmed.toLowerCase() === 'commander') {
        continue;
      }

      const match = trimmed.match(/^(\d+)x?\s+(.+)$/);
      if (match) {
        const quantity = parseInt(match[1]);
        const cardName = match[2].trim();

        if (cardCounts.has(cardName)) {
          cardCounts.set(cardName, cardCounts.get(cardName) + quantity);
        } else {
          cardCounts.set(cardName, quantity);
        }
      }
    }

    if (cardCounts.size === 0) {
      setError('No valid cards found in deck list');
      return null;
    }

    // Look up all cards
    const lands = [];
    const artifacts = [];
    const creatures = [];
    const rituals = [];
    const exploration = [];
    const spells = [];

    for (const [cardName, quantity] of cardCounts.entries()) {
      const cardData = await lookupCard(cardName);
      
      if (!cardData) {
        errors.push(`Card "${cardName}" not found`);
        continue;
      }

      const processed = processCardData(cardData);
      
      // Skip if processCardData returned null (e.g., transform lands)
      if (!processed) {
        continue;
      }
      
      processed.quantity = quantity;

      // Special handling for MDFCs with a land face
      // They should appear in BOTH lands and spells lists
      if (cardData.layout === 'modal_dfc' && cardData.card_faces && cardData.card_faces.length > 0) {
        const frontFace = cardData.card_faces[0];
        const backFace = cardData.card_faces[1];
        const frontIsLand = frontFace.type_line?.toLowerCase().includes('land');
        const backIsLand = backFace.type_line?.toLowerCase().includes('land');
        
        if (frontIsLand || backIsLand) {
          // Add as land (already done by processCardData)
          lands.push(processed);
          
          // ALSO add the spell side as a key-card option
          if (frontIsLand && !backIsLand) {
            // Front is land, back is spell - add back as spell
            const spellVersion = processSpell(cardData);
            spellVersion.quantity = quantity;
            spellVersion.name = cardData.name; // Keep full MDFC name
            spellVersion.isMDFCSpellSide = true;
            spells.push(spellVersion);
          } else if (!frontIsLand && backIsLand) {
            // Front is spell, back is land - add front as spell
            const spellVersion = processSpell(cardData);
            spellVersion.quantity = quantity;
            spellVersion.name = cardData.name;
            spellVersion.isMDFCSpellSide = true;
            spells.push(spellVersion);
          }
          continue; // Skip the normal categorization below
        }
      }

      // Normal categorization for non-MDFC cards
      if (processed.isLand) {
        lands.push(processed);
      } else if (processed.isManaArtifact) {
        artifacts.push(processed);
      } else if (processed.isManaCreature) {
        creatures.push(processed);
      } else if (processed.isExploration) {
        exploration.push(processed);
      } else if (processed.isRitual) {
        rituals.push(processed);
      } else {
        spells.push(processed);
      }
    }

    if (errors.length > 0) {
      setError(errors.join(', '));
    }

    const totalCards = [...lands, ...artifacts, ...creatures, ...exploration, ...rituals, ...spells]
      .reduce((sum, card) => sum + card.quantity, 0);

    return {
      lands,
      artifacts,
      creatures,
      exploration,
      rituals,
      spells,
      totalCards,
      landCount: lands.reduce((sum, card) => sum + card.quantity, 0)
    };
  };

  const handleParseDeck = async () => {
    const deck = await parseDeckList(deckText);
    if (deck) {
      setParsedDeck(deck);
      setError('');
      
      // If comparison mode is enabled, also parse deck 2
    }
  };

  // Simulation functions
  const shuffle = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const buildCompleteDeck = (deckToParse) => {
    if (!deckToParse) return [];
    
    // Use deck-specific toggles
    const includeArts = includeArtifacts;
    const disabledArts = disabledArtifacts;
    const includeCreats = includeCreatures;
    const disabledCreats = disabledCreatures;
    const includeExplor = includeExploration;
    const disabledExplor = disabledExploration;
    
    const deck = [];
    
    deckToParse.lands.forEach(card => {
      for (let i = 0; i < card.quantity; i++) {
        deck.push({ ...card });
      }
    });

    if (includeArts) {
      deckToParse.artifacts.forEach(card => {
        if (!disabledArts.has(card.name)) {
          for (let i = 0; i < card.quantity; i++) {
            deck.push({ ...card });
          }
        }
      });
    }

    if (includeCreats) {
      deckToParse.creatures.forEach(card => {
        if (!disabledCreats.has(card.name)) {
          for (let i = 0; i < card.quantity; i++) {
            deck.push({ ...card });
          }
        }
      });
    }

    if (includeExplor && deckToParse.exploration) {
      deckToParse.exploration.forEach(card => {
        if (!disabledExplor.has(card.name)) {
          for (let i = 0; i < card.quantity; i++) {
            deck.push({ ...card });
          }
        }
      });
    }

    deckToParse.spells.forEach(card => {
      for (let i = 0; i < card.quantity; i++) {
        deck.push({ ...card });
      }
    });

    return deck;
  };

  const runSimulation = () => {
    if (!parsedDeck) {
      setError('Please parse a deck first');
      return;
    }
    
    // Check if deck 2 is needed for comparison

    setIsSimulating(true);
    setError('');

    setTimeout(() => {
      try {
        // Run simulation for deck 1
        const results1 = monteCarlo(parsedDeck);
        setSimulationResults(results1);
        
        // Run simulation for deck 2 if comparison mode
        
        setIsSimulating(false);
      } catch (err) {
        setError('Simulation error: ' + err.message);
        setIsSimulating(false);
      }
    }, 100);
  };

  const monteCarlo = (deckToParse) => {
    const deck = buildCompleteDeck(deckToParse);
    const keyCardNames = Array.from(selectedKeyCards);
    
    const results = {
      landsPerTurn: Array(turns).fill(null).map(() => []),
      untappedLandsPerTurn: Array(turns).fill(null).map(() => []),
      colorsByTurn: Array(turns).fill(null).map(() => ({ W: [], U: [], B: [], R: [], G: [] })),
      totalManaPerTurn: Array(turns).fill(null).map(() => []),
      lifeLossPerTurn: Array(turns).fill(null).map(() => []),
      keyCardPlayability: {},
      fastestPlaySequences: {},
      mulligans: 0,
      handsKept: 0
    };

    keyCardNames.forEach(name => {
      results.keyCardPlayability[name] = Array(turns).fill(0);
    });

    for (let iter = 0; iter < iterations; iter++) {
      const shuffled = shuffle(deck);
      let hand = shuffled.slice(0, handSize);
      let library = shuffled.slice(handSize);
      
      // Mulligan logic
      let mulliganCount = 0;
      const maxMulligans = 6;
      
      if (enableMulligans) {
        let shouldMulligan = true;
        
        while (shouldMulligan && mulliganCount < maxMulligans) {
          shouldMulligan = false;
          const landCount = hand.filter(c => c.isLand).length;
          
          // Determine if we should mulligan based on strategy
          if (mulliganStrategy === 'conservative') {
            // Conservative: only mulligan extreme hands (0 or 7 lands)
            if (landCount === 0 || landCount === 7) {
              shouldMulligan = true;
            }
          } else if (mulliganStrategy === 'balanced') {
            // Balanced: mulligan 0/7 lands, or hands with no plays by turn 3
            if (landCount === 0 || landCount === 7) {
              shouldMulligan = true;
            } else if (landCount < 2 || landCount > 5) {
              // Check if we have any 2-drops or less
              const hasEarlyPlay = hand.some(c => !c.isLand && (c.cmc || 0) <= 2);
              if (!hasEarlyPlay) {
                shouldMulligan = true;
              }
            }
          } else if (mulliganStrategy === 'aggressive') {
            // Aggressive: mulligan aggressively for ideal hands
            if (landCount < 2 || landCount > 4) {
              shouldMulligan = true;
            }
          } else if (mulliganStrategy === 'custom') {
            // Custom: use user-defined rules
            if (customMulliganRules.mulligan0Lands && landCount === 0) {
              shouldMulligan = true;
            }
            if (customMulliganRules.mulligan7Lands && landCount === 7) {
              shouldMulligan = true;
            }
            if (customMulliganRules.mulliganMinLands && landCount < customMulliganRules.minLandsThreshold) {
              shouldMulligan = true;
            }
            if (customMulliganRules.mulliganMaxLands && landCount > customMulliganRules.maxLandsThreshold) {
              shouldMulligan = true;
            }
            if (customMulliganRules.mulliganNoPlaysByTurn) {
              // Simulate first N turns to check for plays
              // For simplicity, check if we have castable spells
              const hasEarlyPlay = hand.some(c => 
                !c.isLand && (c.cmc || 0) <= customMulliganRules.noPlaysTurnThreshold
              );
              if (!hasEarlyPlay) {
                shouldMulligan = true;
              }
            }
          }
          
          if (shouldMulligan) {
            mulliganCount++;
            results.mulligans++;
            
            if (mulliganRule === 'london') {
              // London Mulligan: Draw 7, then put N cards on bottom (where N = mulligan count)
              const newShuffle = shuffle(deck);
              const newHand = newShuffle.slice(0, 7);
              
              // Put mulliganCount cards on bottom (for simplicity, put worst cards)
              // Prefer non-lands if we have too many lands, lands if we have too few
              const cardsToBottom = mulliganCount;
              const sortedHand = [...newHand].sort((a, b) => {
                const landCount = newHand.filter(c => c.isLand).length;
                if (landCount > 4) {
                  // Too many lands - bottom lands first
                  if (a.isLand && !b.isLand) return -1;
                  if (!a.isLand && b.isLand) return 1;
                } else if (landCount < 2) {
                  // Too few lands - bottom non-lands first
                  if (!a.isLand && b.isLand) return -1;
                  if (a.isLand && !b.isLand) return 1;
                }
                // Otherwise sort by CMC (highest first)
                return (b.cmc || 0) - (a.cmc || 0);
              });
              
              hand = sortedHand.slice(cardsToBottom);
              library = newShuffle.slice(7);
            } else {
              // Vancouver Mulligan: Draw one fewer card
              const newShuffle = shuffle(deck);
              const newHandSize = 7 - mulliganCount;
              hand = newShuffle.slice(0, newHandSize);
              library = newShuffle.slice(newHandSize);
            }
          }
        }
      }
      
      results.handsKept++;

      const battlefield = [];
      const graveyard = [];
      let cumulativeLifeLoss = 0;
      const turnActions = [];
      const openingHand = hand.map(c => c.name);

      for (let turn = 0; turn < turns; turn++) {
        const turnLog = { turn: turn + 1, actions: [], lifeLoss: 0 };
        
        // Untap phase
        battlefield.forEach(p => {
          // Grim Monolith and Mana Vault don't untap during untap step
          if (p.card.doesntUntapNaturally) {
            // Keep tapped
            return;
          }
          
          p.tapped = false;
          if (p.summoningSick !== undefined) {
            p.summoningSick = false;
          }
        });
        
        // Upkeep: Mana Vault damage
        let manaVaultDamage = 0;
        battlefield.forEach(p => {
          if (p.card.isManaVault && p.tapped) {
            // Mana Vault deals 1 damage if it's tapped during upkeep
            // (player can pay {4} to untap, but we don't simulate that for now)
            manaVaultDamage += 1;
          }
        });
        turnLog.lifeLoss += manaVaultDamage;
        cumulativeLifeLoss += manaVaultDamage;

        // Draw phase
        // Commander Mode: Draw on turn 0 (multiplayer convention - everyone draws)
        // Standard Mode: Skip draw on turn 0 (on the play)
        const shouldDraw = turn > 0 || commanderMode;
        
        if (shouldDraw && library.length > 0) {
          const drawn = library.shift();
          hand.push(drawn);
          turnLog.actions.push(`Drew: ${drawn.name}`);
        }

        // PHASE 1: Cast Exploration effects FIRST (before playing lands)
        // This allows us to benefit from exploration in the same turn
        if (includeExploration) {
          const manaAvailable = calculateManaAvailability(battlefield);
          const explorationInHand = hand.filter(c => c.isExploration && !disabledExploration.has(c.name));
          
          for (const exploration of explorationInHand) {
            if (canPlayCard(exploration, manaAvailable)) {
              const index = hand.indexOf(exploration);
              hand.splice(index, 1);
              
              battlefield.push({
                card: exploration,
                tapped: exploration.entersTapped || false,
                summoningSick: exploration.isManaCreature || false // Only creatures have summoning sickness for mana
                // Exploration effect is IMMEDIATELY active for lands-per-turn
              });
              
              tapManaSources(exploration, battlefield);
              
              if (turnLog) {
                const type = exploration.isCreature ? 'creature' : (exploration.isArtifact ? 'artifact' : 'permanent');
                turnLog.actions.push(`Cast ${type}: ${exploration.name} (Exploration effect)`);
              }
              
              // Recalculate mana after casting
              const newMana = calculateManaAvailability(battlefield);
              Object.assign(manaAvailable, newMana);
            }
          }
        }

        // PHASE 2: Determine max lands per turn (NOW includes exploration cast this turn)
        let maxLandsPerTurn = 1;
        if (includeExploration) {
          battlefield.forEach(p => {
            // Check if this is an exploration effect card
            if (p.card.isExploration && !disabledExploration.has(p.card.name)) {
              maxLandsPerTurn = Math.max(maxLandsPerTurn, p.card.landsPerTurn || 2);
            }
          });
        }

        // PHASE 3: Play lands (up to maxLandsPerTurn, including exploration bonus from this turn)
        let landsPlayedThisTurn = 0;
        while (landsPlayedThisTurn < maxLandsPerTurn) {
          const landInHand = selectBestLand(hand, battlefield, library, turn);
          if (!landInHand) break;
          
          const lifeLoss = playLand(landInHand, hand, battlefield, library, graveyard, turn, turnLog, keyCardNames, deckToParse);
          turnLog.lifeLoss += lifeLoss;
          cumulativeLifeLoss += lifeLoss;
          
          if (lifeLoss > 0 && turnLog) {
            const lastAction = turnLog.actions[turnLog.actions.length - 1];
            if (lastAction && !lastAction.includes('Cannot play')) {
              turnLog.actions[turnLog.actions.length - 1] = `${lastAction} [-${lifeLoss} life]`;
            }
          }
          
          landsPlayedThisTurn++;
        }

        // Phase 4 Fetch
        //const lifeLoss = FetchLand(battlefield, library, turn, turnLog, keyCardNames, deckToParse);

        // PHASE 5: Cast remaining spells (mana dorks, artifacts, etc.)
        castSpells(hand, battlefield, graveyard, turnLog, keyCardNames, deckToParse);
        
        // Ancient Tomb: deals 2 damage per turn (regardless of tapped state)
        const ancientTombCount = battlefield.filter(p => 
          p.card.isLand && p.card.isAncientTomb
        ).length;
        const ancientTombDamage = ancientTombCount * 2;
        
        if (ancientTombDamage > 0) {
          cumulativeLifeLoss += ancientTombDamage;
          turnLog.lifeLoss += ancientTombDamage;
          turnLog.actions.push(`Ancient Tomb damage: -${ancientTombDamage} life`);
        }
        
        // Starting Town: deals 1 damage per turn at upkeep
        const startingTownCount = battlefield.filter(p =>
          p.card.isLand && p.card.name === 'starting town'
        ).length;
        const startingTownDamage = startingTownCount * 1;
        
        if (startingTownDamage > 0) {
          cumulativeLifeLoss += startingTownDamage;
          turnLog.lifeLoss += startingTownDamage;
          turnLog.actions.push(`Starting Town damage: -${startingTownDamage} life`);
        }
        
        // Pain Lands: deal 1 damage when tapped for colored mana
        // Simplified: assume all  pain lands dealt damage this under turn 5 turn
        const PainLands = battlefield.filter(p =>
          p.card.isLand && p.card.isPainLand
        ).length;
        const painLandDamage = PainLands * 1;
        
        if (painLandDamage > 0 && turn <= 5 ) {
          cumulativeLifeLoss += painLandDamage;
          turnLog.lifeLoss += painLandDamage;
          turnLog.actions.push(`Pain Land damage: -${painLandDamage} life`);
        }
        
        // 5-Color Pain Lands (Mana Confluence, City of Brass): deal 1 damage when tapped
        const tapped5ColorPainLands = battlefield.filter(p =>
          p.card.isLand && p.card.isFiveColorPainLand && p.tapped
        ).length;
        const fiveColorPainDamage = tapped5ColorPainLands * 1;
        
        if (fiveColorPainDamage > 0) {
          cumulativeLifeLoss += fiveColorPainDamage;
          turnLog.lifeLoss += fiveColorPainDamage;
          turnLog.actions.push(`5-Color Pain Land damage: -${fiveColorPainDamage} life`);
        }

        turnActions.push(turnLog);

        // Track statistics
        const landCount = battlefield.filter(p => p.card.isLand).length;
        const untappedLandCount = battlefield.filter(p => p.card.isLand && !p.tapped).length;
        
        results.landsPerTurn[turn].push(landCount);
        results.untappedLandsPerTurn[turn].push(untappedLandCount);
        results.lifeLossPerTurn[turn].push(cumulativeLifeLoss);

        // Calculate mana availability
        const manaAvailable = calculateManaAvailability(battlefield);
        results.totalManaPerTurn[turn].push(manaAvailable.total);
        
        // Only track W, U, B, R, G (not colorless)
        ['W', 'U', 'B', 'R', 'G'].forEach(color => {
          results.colorsByTurn[turn][color].push(manaAvailable.colors[color] || 0);
        });

        // Check key card playability
        keyCardNames.forEach(cardName => {
          // Find the key card in deckToParse
          const keyCard = deckToParse.spells.find(c => c.name === cardName) ||
                         deckToParse.creatures.find(c => c.name === cardName) ||
                         deckToParse.artifacts.find(c => c.name === cardName) ||
                         (deckToParse.exploration && deckToParse.exploration.find(c => c.name === cardName));
          
          if (keyCard && canPlayCard(keyCard, manaAvailable)) {
            results.keyCardPlayability[cardName][turn]++;
            
            // Track play sequences by turn
            if (!results.fastestPlaySequences[cardName]) {
              results.fastestPlaySequences[cardName] = {};
            }
            
            const currentTurn = turn + 1;
            
            // Initialize array for this turn if needed
            if (!results.fastestPlaySequences[cardName][currentTurn]) {
              results.fastestPlaySequences[cardName][currentTurn] = [];
            }
            
            // Add this sequence (limit to maxSequences examples per turn)
            if (results.fastestPlaySequences[cardName][currentTurn].length < maxSequences) {
              results.fastestPlaySequences[cardName][currentTurn].push({
                turn: currentTurn,
                manaAvailable: manaAvailable.total,
                sequence: JSON.parse(JSON.stringify(turnActions)),
                openingHand: [...openingHand]
              });
            }
          }
        });
      }
    }

    // Calculate averages
    for (let turn = 0; turn < turns; turn++) {
      results.landsPerTurn[turn] = average(results.landsPerTurn[turn]);
      results.untappedLandsPerTurn[turn] = average(results.untappedLandsPerTurn[turn]);
      results.totalManaPerTurn[turn] = average(results.totalManaPerTurn[turn]);
      results.lifeLossPerTurn[turn] = average(results.lifeLossPerTurn[turn]);

      Object.keys(results.colorsByTurn[turn]).forEach(color => {
        results.colorsByTurn[turn][color] = average(results.colorsByTurn[turn][color]);
      });
    }

    // Calculate key card percentages
    Object.keys(results.keyCardPlayability).forEach(cardName => {
      results.keyCardPlayability[cardName] = results.keyCardPlayability[cardName].map(
        count => (count / results.handsKept) * 100
      );
    });

    return results;
  };

  const selectBestLand = (hand, battlefield, library, turn) => {
    const lands = hand.filter(c => c.isLand);
    if (lands.length === 0) return null;

    // For each bounce land in hand, check if there's a NON-BOUNCE land to bounce
    const landsWithBouncability = lands.map(land => {
      // Defensive check: Also check by name if isBounce flag is missing
      const isBounceCard = land.isBounce || BOUNCE_LANDS.has(land.name.toLowerCase());
      
      if (!isBounceCard) {
        return { land, canPlay: true };
      }
      
      // Check if there's a non-bounce land on battlefield to bounce
      const nonBounceLandsToReturn = battlefield.filter(p => 
        p.card.isLand && 
        !p.card.isBounce && 
        !BOUNCE_LANDS.has(p.card.name.toLowerCase())
      );
      
      return { 
        land, 
        canPlay: nonBounceLandsToReturn.length > 0 
      };
    });
    
    const playableLands = landsWithBouncability
      .filter(item => item.canPlay)
      .map(item => item.land);
    
    if (playableLands.length === 0) return null;

    // Priority: fetch (mana costing fetches only if mana available)> untapped non-bounce >bounce (with non-bounce available) > tapped
    const fetches = playableLands.filter(l => l.isFetch && l.fetchType !== 'mana_cost');
    const untappedLands = battlefield.filter(d => d.isLand && !d.tapped);
    if (fetches.length > 0 && untappedLands.length >= fetches[0].fetchcost ) return fetches[0];

    const untappedNonBounce = playableLands.filter(l => 
      !l.entersTappedAlways && 
      !l.isBounce && 
      !BOUNCE_LANDS.has(l.name.toLowerCase())
    );
    if (untappedNonBounce.length > 0) return untappedNonBounce[0];

    const bouncelands = playableLands.filter(l => 
      l.isBounce || BOUNCE_LANDS.has(l.name.toLowerCase())
    );
    if (bouncelands.length > 0) return bouncelands[0];

    return playableLands[0];
  };

  const playLand = (land, hand, battlefield, library, graveyard, turn, turnLog, keyCardNames, parsedDeck) => {
    const index = hand.indexOf(land);
    hand.splice(index, 1);

    let lifeLoss = 0;
    
    // City of Traitors: Sacrifice when you play another land
    const cityOfTraitorsInPlay = battlefield.filter(p => 
      p.card.isLand && p.card.isCityOfTraitors
    );
    
    if (cityOfTraitorsInPlay.length > 0 && !land.isCityOfTraitors) {
      // Sacrifice all City of Traitors
      cityOfTraitorsInPlay.forEach(city => {
        const cityIndex = battlefield.indexOf(city);
        battlefield.splice(cityIndex, 1);
        graveyard.push(city.card);
        
        if (turnLog) {
          turnLog.actions.push(`Sacrificed ${city.card.name} (another land played)`);
        }
      });
    }

    if (land.isFetch) {
      // Hideaway fetch lands (Maestros Theater, etc.) - special handling
      if (land.isHideawayFetch) {
        // Hideaway lands enter tapped, then immediately sacrifice to fetch a basic tapped
        const fetchedLand = findBestLandToFetch(land, library, battlefield, keyCardNames, parsedDeck, turn);
        
        if (fetchedLand) {
          const libIndex = library.indexOf(fetchedLand);
          library.splice(libIndex, 1);

          // Fetched land enters tapped
          battlefield.push({
            card: fetchedLand,
            tapped: true,
            enteredTapped: true
          });

          // The hideaway land goes to graveyard (sacrificed)
          graveyard.push(land);
          
          if (turnLog) {
            turnLog.actions.push(`Played ${land.name}, sacrificed it to fetch ${fetchedLand.name} (tapped)`);
          }
        } else {
          // No valid fetch target, play as regular land (enters tapped)
          battlefield.push({
            card: land,
            tapped: true,
            enteredTapped: true
          });
          
          if (turnLog) {
            turnLog.actions.push(`Played ${land.name} (tapped, no fetch targets)`);
          }
        }
      }
      // Regular fetch land logic
      else {
        const fetchedLand = findBestLandToFetch(land, library, battlefield, keyCardNames, parsedDeck, turn);
        
        if (fetchedLand) {
          const libIndex = library.indexOf(fetchedLand);
          library.splice(libIndex, 1);

          // Check if the FETCH determines tapped state, otherwise check the land itself
          let entersTapped;
          if (land.fetchedLandEntersTapped) {
            // Fetch says land enters tapped (e.g., Terramorphic Expanse)
            entersTapped = true;
          } else {
            // Check if land itself enters tapped (e.g., shock lands)
            entersTapped = doesLandEnterTapped(fetchedLand, battlefield, turn, commanderMode);
          }
          
          battlefield.push({
            card: fetchedLand,
            tapped: entersTapped,
            enteredTapped: entersTapped
          });

          // Shock land decision (only if not forced tapped by fetch before turn 6 always untapped)
          if (fetchedLand.isShockLand && turn <= 6 && entersTapped && !land.fetchedLandEntersTapped) {
            battlefield[battlefield.length - 1].tapped = false;
            battlefield[battlefield.length - 1].enteredTapped = false;
            lifeLoss += 2;
          }

          // Myriad Landscape fetches TWO basics of the same type
          if (land.fetchesTwoLands && !land.tapped) {
            // Find a second basic of the SAME type
            const secondLand = library.find(card => 
              card.isLand && 
              card.isBasic && 
              card.name === fetchedLand.name
            );
            
            if (secondLand) {
              const secondIndex = library.indexOf(secondLand);
              library.splice(secondIndex, 1);
              
              battlefield.push({
                card: secondLand,
                tapped: true,
                enteredTapped: true
              });
            }
          }

          // Fetch land cost
          if (land.fetchType === 'classic' || land.fetchType === 'slow') {
            lifeLoss += 1;
          }

          graveyard.push(land);
          
          if (turnLog) {
            if (land.fetchesTwoLands) {
              const secondLandName = battlefield[battlefield.length - 1]?.card.name;
              if (secondLandName) {
                turnLog.actions.push(`Played ${land.name}, fetched 2x ${fetchedLand.name} (tapped)`);
              } else {
                turnLog.actions.push(`Played ${land.name}, fetched ${fetchedLand.name} (only 1 available)`);
              }
            } else {
              const finalState = battlefield[battlefield.length - 1]?.tapped ? 'tapped' : 'untapped';
              turnLog.actions.push(`Played ${land.name}, fetched ${fetchedLand.name} (${finalState})`);
            }
          }
        } else {
          // No valid fetch target, play as regular land
          battlefield.push({
            card: land,
            tapped: true,
            enteredTapped: true
          });
          
          if (turnLog) {
            turnLog.actions.push(`Played ${land.name} (no fetch targets)`);
          }
        }
      }
    } else {
      // Regular land
      const entersTapped = doesLandEnterTapped(land, battlefield, turn, commanderMode);
      
      // Defensive check: Also check by name if isBounce flag is missing
      const isBounceCard = land.isBounce || BOUNCE_LANDS.has(land.name.toLowerCase());
      
      // Bounce land mechanic - check BEFORE adding to battlefield
      if (isBounceCard) {
        // Check if there are OTHER lands to bounce (before we add this one)
        const landsToBounce = battlefield.filter(p => 
          p.card.isLand && !p.card.isBounce && !BOUNCE_LANDS.has(p.card.name.toLowerCase())
        );
        
        if (landsToBounce.length === 0) {
          // Cannot play bounce land without another NON-BOUNCE land to bounce
          if (turnLog) {
            turnLog.actions.push(`Cannot play ${land.name} (no non-bounce lands to bounce)`);
          }
          
          return 0; // No life loss, don't play the land at all
        }
      }
      
      // Now add the land to battlefield
      battlefield.push({
        card: land,
        tapped: entersTapped,
        enteredTapped: entersTapped
      });

      // Shock land decision
      if (land.isShockLand && turn <= 6 && entersTapped) {
        battlefield[battlefield.length - 1].tapped = false;
        battlefield[battlefield.length - 1].enteredTapped = false;
        lifeLoss += 2;
      }
      
      // Bounce land mechanic - execute the bounce AFTER adding to battlefield
      if (isBounceCard) {
        // Get the state of the bounce land BEFORE bouncing
        const bounceLandIndex = battlefield.length - 1;
        const finalState = battlefield[bounceLandIndex]?.tapped ? 'tapped' : 'untapped';
        
        // Find non-bounce lands to bounce
        const landsToBounce = battlefield.filter(p => 
          p.card.isLand && !p.card.isBounce && !BOUNCE_LANDS.has(p.card.name.toLowerCase())
        );
        
        // Prefer bouncing tapped lands
        const tappedLands = landsToBounce.filter(p => p.tapped);
        const toBounce = tappedLands.length > 0 ? tappedLands[0] : landsToBounce[0];
        const bouncedState = toBounce.tapped ? 'tapped' : 'untapped';
        
        const bounceIndex = battlefield.indexOf(toBounce);
        battlefield.splice(bounceIndex, 1);
        hand.push(toBounce.card);
        
        // Log play + bounce as single action
        if (turnLog) {
          turnLog.actions.push(`Played ${land.name} (${finalState}), bounced ${toBounce.card.name} (${bouncedState})`);
        }
      } else {
        // Regular land without bounce
        if (turnLog) {
          const finalState = battlefield[battlefield.length - 1]?.tapped ? 'tapped' : 'untapped';
          turnLog.actions.push(`Played ${land.name} (${finalState})`);
        }
      }
    }

    return lifeLoss;
  };

  const findBestLandToFetch = (fetchLand, library, battlefield, keyCardNames, parsedDeck, turn) => {
    // For hideaway fetches and basic-only fetches, only fetch basic lands
    const onlyBasics = fetchLand.isHideawayFetch || fetchLand.fetchesOnlyBasics;
    
    const eligibleLands = library.filter(card => {
      if (!card.isLand) return false;
      
      // If this fetch only gets basics, check if the land is basic
      if (onlyBasics && !card.isBasic) {
        return false;
      }
      
      const landTypes = card.landSubtypes || [];
      const fetchColors = fetchLand.fetchColors || [];
      
      return landTypes.some(type => {
        const typeToColor = {
          'Plains': 'W', 'Island': 'U', 'Swamp': 'B', 'Mountain': 'R', 'Forest': 'G'
        };
        return fetchColors.includes(typeToColor[type]);
      });
    });

    if (eligibleLands.length === 0) return null;

    // Determine what colors we need for key cards
    const neededColors = new Set();
    
    if (keyCardNames && keyCardNames.length > 0 && parsedDeck) {
      // Find key cards and sort by CMC (lower CMC = higher priority)
      const keyCards = [];
      keyCardNames.forEach(cardName => {
        const card = parsedDeck.spells.find(c => c.name === cardName) ||
                     parsedDeck.creatures.find(c => c.name === cardName) ||
                     parsedDeck.artifacts.find(c => c.name === cardName);
        if (card) keyCards.push(card);
      });
      
      keyCards.sort((a, b) => a.cmc - b.cmc);
      
      // Get colors needed for key cards (prioritize lower CMC cards)
      keyCards.forEach(card => {
        const symbols = card.manaCost.match(/\{([^}]+)\}/g) || [];
        symbols.forEach(symbol => {
          const clean = symbol.replace(/[{}]/g, '');
          if (['W', 'U', 'B', 'R', 'G'].includes(clean)) {
            neededColors.add(clean);
          }
        });
      });
    }

    // Calculate what colors we already have
    const currentColors = new Set();
    battlefield.forEach(permanent => {
      if (permanent.card.isLand || permanent.card.isManaArtifact || 
          (permanent.card.isManaCreature && !permanent.summoningSick)) {
        (permanent.card.produces || []).forEach(color => {
          if (['W', 'U', 'B', 'R', 'G'].includes(color)) {
            currentColors.add(color);
          }
        });
      }
    });

    // Find missing colors (colors needed but not available)
    const missingColors = new Set();
    neededColors.forEach(color => {
      if (!currentColors.has(color)) {
        missingColors.add(color);
      }
    });

    // Score lands based on priority
    const scoredLands = eligibleLands.map(land => {
      let score = 0;
      
      // Highest priority: lands that produce missing colors
      const producesNeededColor = (land.produces || []).some(color => missingColors.has(color));
      
      if (producesNeededColor) {
        score += 300;
      }

     // Bonus for early triomes
      if (turn <= 2 && ((land.produces || []).length > 2)) {
        score += 1000;
      }

      // Bonus for not shock late
      if (turn >= 6 && (land.isShockLand)) {
        score -= 100;
      }
      
      // Bonus for dual lands
      if ((land.produces || []).length >= 2) {
        score += 100;
      }
      
      // Bonus for producing multiple missing colors
      const missingColorCount = (land.produces || []).filter(c => missingColors.has(c)).length;
      score += missingColorCount * 250;
      
      return { land, score };
    });

    scoredLands.sort((a, b) => b.score - a.score);
    
    return scoredLands[0].land;
  };

  const doesLandEnterTapped = (land, battlefield, turn, commanderMode) => {
    // Shock lands have special logic - they CAN enter untapped but default to tapped
    if (land.isShockLand) {
      return true; // Default to tapped, we'll pay life to untap it
    }
    
    // Fast lands: enter untapped if you control 2 or fewer other lands
    if (land.isFast) {
      const landsOnBattlefield = battlefield.filter(p => p.card.isLand).length;
      return landsOnBattlefield > 2; // Tapped if more than 2 other lands
    }
    
    // Battle Lands / Tango Lands: enter untapped if you control 2+ basic lands
    if (land.isBattleLand) {
      const basicLands = battlefield.filter(p => p.card.isLand && p.card.isBasic).length;
      return basicLands < 2; // Tapped unless 2+ basics
    }
    
    // Check lands: enter tapped unless you control a land with the appropriate basic type
    if (land.isCheck) {
      // Determine which basic types this check land needs
      // e.g., Glacial Fortress needs Plains or Island
      const needsTypes = [];
      if (land.produces.includes('W') && land.produces.includes('U')) {
        needsTypes.push('Plains', 'Island');
      } else if (land.produces.includes('U') && land.produces.includes('B')) {
        needsTypes.push('Island', 'Swamp');
      } else if (land.produces.includes('B') && land.produces.includes('R')) {
        needsTypes.push('Swamp', 'Mountain');
      } else if (land.produces.includes('R') && land.produces.includes('G')) {
        needsTypes.push('Mountain', 'Forest');
      } else if (land.produces.includes('G') && land.produces.includes('W')) {
        needsTypes.push('Forest', 'Plains');
      } else if (land.produces.includes('W') && land.produces.includes('B')) {
        needsTypes.push('Plains', 'Swamp');
      } else if (land.produces.includes('U') && land.produces.includes('R')) {
        needsTypes.push('Island', 'Mountain');
      } else if (land.produces.includes('B') && land.produces.includes('G')) {
        needsTypes.push('Swamp', 'Forest');
      } else if (land.produces.includes('R') && land.produces.includes('W')) {
        needsTypes.push('Mountain', 'Plains');
      } else if (land.produces.includes('G') && land.produces.includes('U')) {
        needsTypes.push('Forest', 'Island');
      }
      
      // Check if battlefield has any land with these types
      const hasAppropriateType = battlefield.some(p => {
        if (!p.card.isLand) return false;
        const subtypes = p.card.landSubtypes || [];
        return needsTypes.some(type => subtypes.includes(type));
      });
      
      return !hasAppropriateType; // Enters tapped unless we have the right type
    }
    
    // Starting Town: enters untapped ONLY on turns 1, 2, or 3 (0-indexed: 0, 1, 2)
    if (land.name === 'starting town') {
      return turn > 2; // Tapped after turn 3
    }
    
    // Crowd Lands: enter tapped unless you have 2+ opponents
    // Check by name (Crowd lands are defined in CROWD_LANDS set during parsing)
    const CROWD_LANDS = new Set([
      'luxury suite', 'morphic pool', 'spire garden', 'bountiful promenade', 'sea of clouds',
      'spectator seating', 'undergrowth stadium', 'training center', 'vault of champions', 'rejuvenating springs'
    ]);
    
    if (CROWD_LANDS.has(land.name)) {
      // In Commander Mode (multiplayer), assume 2+ opponents → enters untapped
      // In 1v1 mode, only 1 opponent → enters tapped
      return !commanderMode; // Tapped if NOT commander mode
    }
    
    if (land.entersTappedAlways) return true;
    
    // Check for condition (e.g., "unless you have two or more opponents")
    if (land.hasCondition) return false; // Assume Commander format
    
    return false;
  };

  const castSpells = (hand, battlefield, graveyard, turnLog, keyCardNames, parsedDeck) => {
    let changed = true;
    
    // Phase 1: Cast mana-producing permanents (creatures, artifacts)
    // Note: Exploration effects are already cast in the main turn loop BEFORE lands
    // Priority: Regular mana dorks > Artifacts
    while (changed) {
      changed = false;
      const manaAvailable = calculateManaAvailability(battlefield);
      
      const creatures = hand.filter(c => c.isManaCreature);
      const exploration = hand.filter(c => c.isExploration); // Usually empty - already cast earlier
      const artifacts = hand.filter(c => c.isManaArtifact);
      
      // Priority order: Regular mana dorks > Exploration effects (if any left) > Artifacts
      const castable = [...creatures, ...exploration, ...artifacts].sort((a, b) => a.cmc - b.cmc);

      for (const spell of castable) {
        if (canPlayCard(spell, manaAvailable)) {
          // Special artifact requirements
          
          // Mox Diamond: requires discarding a land
          if (spell.isMoxDiamond) {
            const landsInHand = hand.filter(c => c.isLand);
            if (landsInHand.length === 0) {
              continue; // Can't cast Mox Diamond without a land to discard
            }
            // Discard a land (prefer tapped lands or basics)
            const landToDiscard = landsInHand.find(l => l.entersTappedAlways) || landsInHand[0];
            const discardIndex = hand.indexOf(landToDiscard);
            hand.splice(discardIndex, 1);
            graveyard.push(landToDiscard);
          }
          
          // Chrome Mox: requires imprinting a non-land card
          if (spell.isChromeMox) {
            const nonLandsInHand = hand.filter(c => !c.isLand);
            if (nonLandsInHand.length === 0) {
              continue; // Can't cast Chrome Mox without a non-land to imprint
            }
            // Imprint (exile) a non-land card
            const cardToImprint = nonLandsInHand[0];
            const imprintIndex = hand.indexOf(cardToImprint);
            hand.splice(imprintIndex, 1);
            // Note: We'd need to track imprinted card for color production
            // For now, assume it produces any color
          }
          
          // Mox Opal: requires metalcraft (3 artifacts)
          if (spell.isMoxOpal) {
            const artifactCount = battlefield.filter(p => 
              p.card.type?.includes('artifact') || p.card.isManaArtifact
            ).length;
            // Note: Mox Opal itself doesn't count yet (not on battlefield)
            // After casting, it will be artifact #(N+1)
            // For now, we allow casting but it won't produce mana until 3+ artifacts total
          }
          
          // Mox Amber: requires legendary creature/planeswalker
          if (spell.isMoxAmber) {
            // Note: Requires checking for legendaries on battlefield
            // For simplicity, allow casting but may not produce mana
          }
          
          const index = hand.indexOf(spell);
          hand.splice(index, 1);

          battlefield.push({
            card: spell,
            tapped: spell.entersTapped || false, // Artifacts can enter tapped
            summoningSick: spell.isManaCreature || spell.isExploration // Creatures and exploration creatures have summoning sickness
          });

          // Tap mana sources to pay for the spell
          tapManaSources(spell, battlefield);

          if (turnLog) {
            let type = 'permanent';
            if (spell.isManaArtifact) type = 'artifact';
            else if (spell.isManaCreature) type = 'creature';
            else if (spell.isExploration) type = spell.isCreature ? 'creature' : (spell.isArtifact ? 'artifact' : 'permanent');
            
            const suffix = spell.isExploration ? ' (Exploration effect)' : '';
            const tappedSuffix = spell.entersTapped ? ' (enters tapped)' : '';
            let specialSuffix = '';
            if (spell.isMoxDiamond) specialSuffix = ' (discarded land)';
            if (spell.isChromeMox) specialSuffix = ' (imprinted card)';
            
            turnLog.actions.push(`Cast ${type}: ${spell.name}${suffix}${tappedSuffix}${specialSuffix}`);
          }

          changed = true;
          break;
        }
      }
    }
  };

  const tapManaSources = (spell, battlefield) => {
    // Parse mana cost
    const symbols = spell.manaCost.match(/\{([^}]+)\}/g) || [];
    const colorNeeds = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    let genericNeeded = 0;
    let totalNeeded = 0;

    symbols.forEach(symbol => {
      const clean = symbol.replace(/[{}]/g, '');
      if (['W', 'U', 'B', 'R', 'G'].includes(clean)) {
        colorNeeds[clean]++;
        totalNeeded++;
      } else if (!isNaN(parseInt(clean))) {
        const num = parseInt(clean);
        genericNeeded += num;
        totalNeeded += num;
      }
    });

    // First, tap sources for colored mana requirements
    ['W', 'U', 'B', 'R', 'G'].forEach(color => {
      let needed = colorNeeds[color];
      if (needed === 0) return;

      const sources = battlefield.filter(p => 
        !p.tapped && 
        p.card.produces && 
        p.card.produces.includes(color) &&
        (!p.summoningSick || p.card.isLand)
      );

      for (const source of sources) {
        if (needed <= 0) break;
        source.tapped = true;
        needed--;
        totalNeeded--;
      }
    });

    // Then tap any remaining sources for generic mana
    const untappedSources = battlefield.filter(p => 
      !p.tapped && 
      (!p.summoningSick || p.card.isLand)
    );

    for (const source of untappedSources) {
      if (totalNeeded <= 0) break;
      source.tapped = true;
      const amount = source.card.manaAmount || 1;
      totalNeeded -= amount;
    }
  };

  const calculateManaAvailability = (battlefield) => {
    const colors = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    let total = 0;

    battlefield.filter(p => !p.tapped).forEach(permanent => {
      const card = permanent.card;
      
      if (card.isLand) {
        const landManaAmount = card.manaAmount || 1; // Ancient Tomb/City of Traitors produce 2
        total += landManaAmount;
        // Only count colors from lands that can actually produce them
        card.produces.forEach(color => {
          colors[color] = (colors[color] || 0) + landManaAmount;
        });
      } else if (card.isManaArtifact) {
        // Mox Opal: only produces mana with metalcraft (3+ artifacts)
        if (card.isMoxOpal) {
          const artifactCount = battlefield.filter(p => 
            p.card.type?.includes('artifact') || p.card.isManaArtifact
          ).length;
          if (artifactCount < 3) {
            return; // Mox Opal doesn't produce mana without metalcraft
          }
        }
        
        // Mox Amber: only produces colors from legendary creatures/planeswalkers
        if (card.isMoxAmber) {
          const legendaries = battlefield.filter(p => 
            p.card.oracleText?.includes('Legendary') || 
            p.card.type?.includes('Legendary')
          );
          if (legendaries.length === 0) {
            return; // Mox Amber doesn't produce mana without legendaries
          }
          // For simplicity, allow any color if legendaries exist
          // Proper implementation would track legendary colors
        }
        
        // Artifacts don't have summoning sickness - can tap immediately
        total += card.manaAmount || 1;
        card.produces.forEach(color => {
          colors[color] = (colors[color] || 0) + (card.manaAmount || 1);
        });
      } else if (card.isManaCreature && !permanent.summoningSick) {
        // Creatures have summoning sickness - can't tap until next turn
        total += card.manaAmount || 1;
        card.produces.forEach(color => {
          colors[color] = (colors[color] || 0) + (card.manaAmount || 1);
        });
      }
    });

    return { total, colors };
  };

  const canPlayCard = (card, manaAvailable) => {
    if (card.cmc > manaAvailable.total) return false;

    // Parse color requirements from mana cost
    const colorRequirements = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    const symbols = card.manaCost.match(/\{([^}]+)\}/g) || [];
    
    symbols.forEach(symbol => {
      const clean = symbol.replace(/[{}]/g, '');
      // Only count actual color symbols (not numbers or X)
      if (['W', 'U', 'B', 'R', 'G'].includes(clean)) {
        colorRequirements[clean]++;
      }
    });

    // Check if we have enough of each color
    for (const color in colorRequirements) {
      const required = colorRequirements[color];
      if (required > 0) {
        const available = manaAvailable.colors[color] || 0;
        if (available < required) {
          return false;
        }
      }
    }

    return true;
  };

  const average = (arr) => {
    if (!arr || arr.length === 0) return 0;
    const sum = arr.reduce((sum, val) => {
      // Skip undefined, null, NaN values
      if (val === undefined || val === null || isNaN(val)) return sum;
      return sum + val;
    }, 0);
    return arr.length > 0 ? sum / arr.length : 0;
  };

  // Safe toFixed - handles undefined/NaN/null
  const safeToFixed = (value, decimals = 2) => {
    if (value === undefined || value === null || isNaN(value)) return 0;
    return parseFloat(value.toFixed(decimals));
  };

  // Export functions
  const exportResultsAsPNG = async (event) => {
    if (!simulationResults) return;

    try {
      // Load html2canvas library
      const html2canvas = await loadHtml2Canvas();
      
      // Get the results section
      const resultsSection = document.getElementById('results-section');
      if (!resultsSection) {
        alert('Results section not found');
        return;
      }

      // Show loading state
      const button = event.target;
      const originalButtonText = button.textContent;
      button.textContent = '📸 Capturing...';
      button.disabled = true;

      // Wait a bit for any animations to finish
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capture the element
      const canvas = await html2canvas(resultsSection, {
        backgroundColor: '#f9fafb',
        scale: 2, // Higher quality
        logging: false,
        useCORS: true
      });

      // Convert to blob and download
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mtg-simulation-results-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Restore button
        button.textContent = originalButtonText;
        button.disabled = false;
      });
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export. Please use your browser screenshot tool (Ctrl+Shift+S on Windows, Cmd+Shift+5 on Mac)');
      if (event && event.target) {
        event.target.disabled = false;
      }
    }
  };

  const downloadTextFile = (content, filename) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Mana symbol helper
  const getManaSymbol = (color) => {
    const symbols = {
      W: '☀️',
      U: '💧',
      B: '💀',
      R: '🔥',
      G: '🌿',
      C: '◇'
    };
    return symbols[color] || '';
  };

  const parseManaSymbols = (manaCost) => {
    if (!manaCost) return [];
    const symbols = manaCost.match(/\{([^}]+)\}/g) || [];
    return symbols.map(s => s.replace(/[{}]/g, ''));
  };

  const renderManaCost = (manaCost) => {
    const symbols = parseManaSymbols(manaCost);
    return symbols.map((symbol, idx) => {
      const colorSymbols = { W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌿', C: '◇' };
      if (colorSymbols[symbol]) {
        return <span key={idx} style={{ marginLeft: '2px' }}>{colorSymbols[symbol]}</span>;
      }
      // Generic mana (numbers)
      return <span key={idx} style={{ 
        marginLeft: '2px', 
        display: 'inline-block',
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        background: '#d1d5db',
        fontSize: '0.7rem',
        textAlign: 'center',
        lineHeight: '18px',
        fontWeight: 600
      }}>{symbol}</span>;
    });
  };

  const getFetchSymbol = (fetchType) => {
    const symbols = {
      classic: '⚡',
      slow: '🐌',
      mana_cost: '💰',
      free_slow: '🆓'
    };
    return symbols[fetchType] || '';
  };

  // Chart data preparation
  const prepareChartData = () => {
    if (!simulationResults) return null;

    const landsData = [];
    const manaByColorData = [];
    const lifeLossData = [];
    const keyCardsData = [];

    for (let i = 0; i < turns; i++) {
      landsData.push({
        turn: i + 1,
        'Total Lands': safeToFixed(simulationResults.landsPerTurn?.[i], 2),
        'Untapped Lands': safeToFixed(simulationResults.untappedLandsPerTurn?.[i], 2)
      });

      manaByColorData.push({
        turn: i + 1,
        'Total Mana': safeToFixed(simulationResults.totalManaPerTurn?.[i], 2),
        'W': safeToFixed(simulationResults.colorsByTurn?.[i]?.W, 2),
        'U': safeToFixed(simulationResults.colorsByTurn?.[i]?.U, 2),
        'B': safeToFixed(simulationResults.colorsByTurn?.[i]?.B, 2),
        'R': safeToFixed(simulationResults.colorsByTurn?.[i]?.R, 2),
        'G': safeToFixed(simulationResults.colorsByTurn?.[i]?.G, 2)
      });

      lifeLossData.push({
        turn: i + 1,
        'Life Loss': safeToFixed(simulationResults.lifeLossPerTurn?.[i], 2)
      });

      const keyCardRow = { turn: i + 1 };
      if (simulationResults.keyCardPlayability) {
        Object.keys(simulationResults.keyCardPlayability).forEach(cardName => {
          keyCardRow[cardName] = safeToFixed(simulationResults.keyCardPlayability[cardName]?.[i], 1);
        });
      }
      keyCardsData.push(keyCardRow);
    }

    return { landsData, manaByColorData, lifeLossData, keyCardsData };
  };

  const chartData = prepareChartData();
  
  // Prepare chart data for deck 2 if in comparison mode
  

  return (
    <div style={{ 
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '20px',
      backgroundColor: '#f9fafb'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '30px',
        borderRadius: '12px',
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        <h1 style={{ margin: 0, fontSize: '2rem' }}>🎲 MTG Monte Carlo Deck Analyzer</h1>
        <p style={{ margin: '10px 0 0', opacity: 0.9 }}>Simulation-based deck analysis for Magic: The Gathering</p>
      </div>

      {/* API Mode Toggle */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ marginTop: 0 }}>⚙️ Data Source</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input
              type="radio"
              checked={apiMode === 'local'}
              onChange={() => setApiMode('local')}
            />
            Local JSON File
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input
              type="radio"
              checked={apiMode === 'scryfall'}
              onChange={() => setApiMode('scryfall')}
            />
            Scryfall API (Fallback)
          </label>
        </div>

        {apiMode === 'local' && (
          <div style={{ marginTop: '15px' }}>
            <div style={{ 
              background: '#dbeafe', 
              padding: '12px', 
              borderRadius: '8px', 
              marginBottom: '12px',
              fontSize: '0.875rem'
            }}>
              <p style={{ margin: '0 0 8px 0', fontWeight: 600 }}>📥 How to get cards.json:</p>
              <ol style={{ margin: 0, paddingLeft: '20px' }}>
                <li>Visit <a 
                  href="https://scryfall.com/docs/api/bulk-data" 
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#667eea', fontWeight: 600 }}
                >
                  Scryfall Bulk Data
                </a></li>
                <li>Download <strong>"Default Cards"</strong> (not "All Cards" or "Oracle Cards")</li>
                <li>File size should be ~200-300 MB (compressed)</li>
                <li>Upload the JSON file below</li>
              </ol>
            </div>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              style={{ display: 'block' }}
            />
            {cardsDatabase && (
              <p style={{ color: '#22c55e', marginTop: '10px', fontSize: '0.875rem' }}>
                ✓ Loaded {cardsDatabase.length.toLocaleString()} cards
              </p>
            )}
          </div>
        )}
      </div>

      {/* Deck Input */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0 }}>📝 Deck List</h3>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '8px', color: '#667eea' }}>
              Deck
            </div>
            <textarea
              value={deckText}
              onChange={(e) => setDeckText(e.target.value)}
              placeholder="Paste your deck list here (MTG Arena format)&#10;Example:&#10;4 Lightning Bolt&#10;4 Island&#10;3 Counterspell"
              style={{
                width: '100%',
                height: '200px',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontSize: '0.875rem',
                fontFamily: 'monospace',
                resize: 'vertical'
              }}
            />
          </div>
        </div>
        <button
          onClick={handleParseDeck}
          style={{
            marginTop: '10px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Parse Deck
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          background: '#fee2e2',
          color: '#dc2626',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '0.875rem'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Parsed Deck Display */}
      {parsedDeck && (
        <div>
          {/* Headers */}
          
          {/* Deck Statistics Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '20px', alignItems: 'start' }}>
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ marginTop: 0 }}>📊 Deck Statistics</h3>
              <p>Total Cards: {parsedDeck.totalCards}</p>
              <p>Lands: {parsedDeck.landCount} ({parsedDeck.totalCards > 0 ? ((parsedDeck.landCount / parsedDeck.totalCards) * 100).toFixed(1) : 0}%)</p>
            </div>
            
          </div>

          {/* Lands Section Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '20px', alignItems: 'start' }}>
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ marginTop: 0 }}>🏞️ Detected Lands ({parsedDeck.landCount})</h3>
            {parsedDeck.lands.map((land, idx) => {
              // Use the hasInternalLogic flag set during parsing
              // This is set to true if the land is in any special set with hardcoded logic
              const showLogic = land.hasInternalLogic;
              
              return (
                <div key={idx} style={{ 
                  padding: '8px 0', 
                  borderBottom: '1px solid #f3f4f6',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <span style={{ fontWeight: 600 }}>{land.quantity}x {land.name}</span>
                    {land.isBasic && <span style={{ marginLeft: '8px', fontSize: '0.875rem' }}>⭐</span>}
                    {land.isFetch && <span style={{ marginLeft: '10px', fontSize: '0.875rem' }}>FETCH {getFetchSymbol(land.fetchType)}</span>}
                    {showLogic && (
                      <span style={{ 
                        marginLeft: '10px', 
                        fontSize: '0.75rem', 
                        background: '#dbeafe', 
                        color: '#1e40af',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 600
                      }}>
                        LOGIC
                      </span>
                    )}
                    {!showLogic && (
                      <span style={{ 
                        marginLeft: '10px', 
                        fontSize: '0.75rem', 
                        background: '#f3f4f6', 
                        color: '#6b7280',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}>
                        PARSED
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', marginLeft: '10px' }}>
                    {land.produces.map(color => (
                      <span key={color} style={{ marginLeft: '5px', fontSize: '1.2rem' }}>{getManaSymbol(color)}</span>
                    ))}
                  </div>
                </div>
              );
            })}
            </div>
            
          </div>

          {/* Mana Artifacts Section Row */}
          {(parsedDeck.artifacts.length > 0 ) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '20px', alignItems: 'start' }}>
          {parsedDeck.artifacts.length > 0 && (
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ marginTop: 0 }}>⚙️ Mana Artifacts</h3>
              <label style={{ display: 'block', marginBottom: '15px' }}>
                <input
                  type="checkbox"
                  checked={includeArtifacts}
                  onChange={(e) => {
                    setIncludeArtifacts(e.target.checked);
                    if (e.target.checked) {
                      setDisabledArtifacts(new Set());
                    } else {
                      const allArtifacts = new Set(parsedDeck.artifacts.map(a => a.name));
                      setDisabledArtifacts(allArtifacts);
                    }
                  }}
                />
                <span style={{ marginLeft: '8px' }}>Enable All Artifacts</span>
              </label>
              {parsedDeck.artifacts.map((artifact, idx) => (
                <div key={idx} style={{ 
                  padding: '8px 0', 
                  borderBottom: '1px solid #f3f4f6',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={includeArtifacts && !disabledArtifacts.has(artifact.name)}
                      onChange={(e) => {
                        const newSet = new Set(disabledArtifacts);
                        if (e.target.checked) {
                          newSet.delete(artifact.name);
                        } else {
                          newSet.add(artifact.name);
                        }
                        setDisabledArtifacts(newSet);
                      }}
                    />
                    <span style={{ marginLeft: '8px', fontWeight: 600 }}>
                      {artifact.quantity}x {artifact.name}
                    </span>
                    <span style={{ marginLeft: '10px', fontSize: '0.875rem', color: '#6b7280' }}>
                      +{artifact.manaAmount} Mana, CMC {artifact.cmc}
                    </span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', marginLeft: '10px' }}>
                    {artifact.produces.map(color => (
                      <span key={color} style={{ marginLeft: '5px', fontSize: '1.2rem' }}>{getManaSymbol(color)}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          
            </div>
          )}

          {/* Mana Creatures Section Row */}
          {(parsedDeck.creatures.length > 0 ) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '20px', alignItems: 'start' }}>
          {parsedDeck.creatures.length > 0 && (
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ marginTop: 0 }}>🌱 Mana Creatures</h3>
              <label style={{ display: 'block', marginBottom: '15px' }}>
                <input
                  type="checkbox"
                  checked={includeCreatures}
                  onChange={(e) => {
                    setIncludeCreatures(e.target.checked);
                    if (e.target.checked) {
                      setDisabledCreatures(new Set());
                    } else {
                      const allCreatures = new Set(parsedDeck.creatures.map(c => c.name));
                      setDisabledCreatures(allCreatures);
                    }
                  }}
                />
                <span style={{ marginLeft: '8px' }}>Enable All Creatures</span>
              </label>
              {parsedDeck.creatures.map((creature, idx) => (
                <div key={idx} style={{ 
                  padding: '8px 0', 
                  borderBottom: '1px solid #f3f4f6',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={includeCreatures && !disabledCreatures.has(creature.name)}
                      onChange={(e) => {
                        const newSet = new Set(disabledCreatures);
                        if (e.target.checked) {
                          newSet.delete(creature.name);
                        } else {
                          newSet.add(creature.name);
                        }
                        setDisabledCreatures(newSet);
                      }}
                    />
                    <span style={{ marginLeft: '8px', fontWeight: 600 }}>
                      {creature.quantity}x {creature.name}
                    </span>
                    <span style={{ marginLeft: '10px', fontSize: '0.875rem', color: '#6b7280' }}>
                      +{creature.manaAmount} Mana, CMC {creature.cmc}
                    </span>
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', marginLeft: '10px' }}>
                    {creature.produces.map(color => (
                      <span key={color} style={{ marginLeft: '5px', fontSize: '1.2rem' }}>{getManaSymbol(color)}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          
            </div>
          )}

          {/* Exploration Effects Section Row */}
          {(parsedDeck.exploration && parsedDeck.exploration.length > 0 ) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '20px', alignItems: 'start' }}>
          {parsedDeck.exploration && parsedDeck.exploration.length > 0 && (
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ marginTop: 0 }}>🌳 Exploration Effects</h3>
              <label style={{ display: 'block', marginBottom: '15px' }}>
                <input
                  type="checkbox"
                  checked={includeExploration}
                  onChange={(e) => {
                    setIncludeExploration(e.target.checked);
                    if (e.target.checked) {
                      setDisabledExploration(new Set());
                    } else {
                      const allExploration = new Set(parsedDeck.exploration.map(c => c.name));
                      setDisabledExploration(allExploration);
                    }
                  }}
                />
                <span style={{ marginLeft: '8px' }}>Enable All Exploration Effects</span>
              </label>
              {parsedDeck.exploration.map((exploration, idx) => (
                <div key={idx} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={includeExploration && !disabledExploration.has(exploration.name)}
                      onChange={(e) => {
                        const newSet = new Set(disabledExploration);
                        if (e.target.checked) {
                          newSet.delete(exploration.name);
                        } else {
                          newSet.add(exploration.name);
                        }
                        setDisabledExploration(newSet);
                      }}
                    />
                    <span style={{ marginLeft: '8px', fontWeight: 600 }}>
                      {exploration.quantity}x {exploration.name}
                    </span>
                    <span style={{ marginLeft: '10px', fontSize: '0.875rem', color: '#6b7280' }}>
                      {exploration.landsPerTurn} Lands/Turn, CMC {exploration.cmc}
                    </span>
                  </label>
                </div>
              ))}
            </div>
          )}
          
            </div>
          )}

          {/* Spells & Key Cards Section */}
          {(parsedDeck.spells.length > 0 || parsedDeck.creatures.length > 0 || parsedDeck.artifacts.length > 0 || (parsedDeck.rituals && parsedDeck.rituals.length > 0) || (parsedDeck.exploration && parsedDeck.exploration.length > 0)) && (
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ marginTop: 0 }}>🎴 Spells & Creatures (Key Card Selection)</h3>
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Select cards to track playability:</p>
              {[...parsedDeck.spells, ...parsedDeck.creatures, ...parsedDeck.artifacts, ...(parsedDeck.rituals || []), ...(parsedDeck.exploration || [])]
                .sort((a, b) => a.cmc - b.cmc)
                .map((card, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    padding: '8px',
                    borderBottom: '1px solid #f3f4f6',
                    cursor: 'pointer',
                    background: selectedKeyCards.has(card.name) ? '#dbeafe' : 'transparent',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onClick={() => {
                    const newSet = new Set(selectedKeyCards);
                    if (newSet.has(card.name)) {
                      newSet.delete(card.name);
                    } else {
                      newSet.add(card.name);
                    }
                    setSelectedKeyCards(newSet);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={selectedKeyCards.has(card.name)}
                      readOnly
                    />
                    <span style={{ marginLeft: '8px', fontWeight: 600 }}>
                      {card.quantity}x {card.name}
                    </span>
                    <span style={{ marginLeft: '10px', fontSize: '0.875rem', color: '#6b7280' }}>
                      CMC {card.cmc}
                    </span>
                  </div>
                  <div style={{ marginLeft: '10px', fontSize: '1.2rem' }}>
                    {renderManaCost(card.manaCost)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Simulation Settings */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginTop: 0 }}>⚙️ Simulation Settings</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.875rem', fontWeight: 600 }}>
                  Number of Simulations
                </label>
                <input
                  type="number"
                  value={iterations}
                  onChange={(e) => setIterations(parseInt(e.target.value))}
                  min="1000"
                  max="100000"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.875rem', fontWeight: 600 }}>
                  Turns to Simulate
                </label>
                <input
                  type="number"
                  value={turns}
                  onChange={(e) => setTurns(parseInt(e.target.value))}
                  min="1"
                  max="15"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.875rem', fontWeight: 600 }}>
                  Starting Hand Size
                </label>
                <input
                  type="number"
                  value={handSize}
                  onChange={(e) => setHandSize(parseInt(e.target.value))}
                  min="1"
                  max="10"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.875rem', fontWeight: 600 }}>
                  Turn to View Play Sequences
                </label>
                <input
                  type="range"
                  value={selectedTurnForSequences}
                  onChange={(e) => setSelectedTurnForSequences(parseInt(e.target.value))}
                  min="1"
                  max={turns}
                  style={{ width: '100%' }}
                />
                <div style={{ textAlign: 'center', fontSize: '0.875rem', marginTop: '5px' }}>Turn {selectedTurnForSequences}</div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.875rem', fontWeight: 600 }}>
                  Number of Example Sequences
                </label>
                <input
                  type="range"
                  value={maxSequences}
                  onChange={(e) => setMaxSequences(parseInt(e.target.value))}
                  min="1"
                  max="10"
                  style={{ width: '100%' }}
                />
                <div style={{ textAlign: 'center', fontSize: '0.875rem', marginTop: '5px' }}>{maxSequences} {maxSequences === 1 ? 'example' : 'examples'}</div>
              </div>
            </div>

            <div style={{ marginTop: '15px', padding: '15px', background: '#f3f4f6', borderRadius: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={commanderMode}
                  onChange={(e) => setCommanderMode(e.target.checked)}
                  style={{ marginRight: '8px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                  🎩 Commander Mode (100-card singleton, optimized for multiplayer)
                </span>
              </label>
              {commanderMode && (
                <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#6b7280', paddingLeft: '24px' }}>
                  Assumes multiplayer environment: Crowd lands enter untapped, longer game simulation recommended
                </div>
              )}
            </div>

            <div style={{ marginTop: '15px', padding: '15px', background: '#f9fafb', borderRadius: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <input
                  type="checkbox"
                  checked={enableMulligans}
                  onChange={(e) => setEnableMulligans(e.target.checked)}
                />
                <span style={{ marginLeft: '8px', fontWeight: 600 }}>Enable Mulligan Logic</span>
              </label>
              
              {enableMulligans && (
                <div style={{ marginTop: '15px', paddingLeft: '10px', borderLeft: '3px solid #667eea' }}>
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
                      Mulligan Rule
                    </label>
                    <select
                      value={mulliganRule}
                      onChange={(e) => setMulliganRule(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                    >
                      <option value="london">London Mulligan (draw 7, bottom N cards)</option>
                      <option value="vancouver">Vancouver Mulligan (draw N-1 cards)</option>
                    </select>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
                      Mulligan Strategy
                    </label>
                    <select
                      value={mulliganStrategy}
                      onChange={(e) => setMulliganStrategy(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                    >
                      <option value="conservative">Conservative (only 0 or 7 lands)</option>
                      <option value="balanced">Balanced (0/7 lands, no early plays)</option>
                      <option value="aggressive">Aggressive (2-4 lands only)</option>
                      <option value="custom">Custom Rules</option>
                    </select>
                  </div>
                  
                  {mulliganStrategy === 'custom' && (
                    <div style={{ marginTop: '10px', padding: '10px', background: 'white', borderRadius: '6px' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '10px' }}>Custom Mulligan Rules:</div>
                      
                      <label style={{ display: 'block', marginBottom: '8px' }}>
                        <input
                          type="checkbox"
                          checked={customMulliganRules.mulligan0Lands}
                          onChange={(e) => setCustomMulliganRules({...customMulliganRules, mulligan0Lands: e.target.checked})}
                        />
                        <span style={{ marginLeft: '8px', fontSize: '0.875rem' }}>Mulligan if 0 lands</span>
                      </label>
                      
                      <label style={{ display: 'block', marginBottom: '8px' }}>
                        <input
                          type="checkbox"
                          checked={customMulliganRules.mulligan7Lands}
                          onChange={(e) => setCustomMulliganRules({...customMulliganRules, mulligan7Lands: e.target.checked})}
                        />
                        <span style={{ marginLeft: '8px', fontSize: '0.875rem' }}>Mulligan if 7 lands</span>
                      </label>
                      
                      <label style={{ display: 'block', marginBottom: '8px' }}>
                        <input
                          type="checkbox"
                          checked={customMulliganRules.mulliganMinLands}
                          onChange={(e) => setCustomMulliganRules({...customMulliganRules, mulliganMinLands: e.target.checked})}
                        />
                        <span style={{ marginLeft: '8px', fontSize: '0.875rem' }}>Mulligan if less than </span>
                        <input
                          type="number"
                          value={customMulliganRules.minLandsThreshold}
                          onChange={(e) => setCustomMulliganRules({...customMulliganRules, minLandsThreshold: parseInt(e.target.value)})}
                          min="0"
                          max="7"
                          style={{ width: '50px', marginLeft: '5px', padding: '4px', borderRadius: '4px', border: '1px solid #e5e7eb' }}
                        />
                        <span style={{ marginLeft: '5px', fontSize: '0.875rem' }}>lands</span>
                      </label>
                      
                      <label style={{ display: 'block', marginBottom: '8px' }}>
                        <input
                          type="checkbox"
                          checked={customMulliganRules.mulliganMaxLands}
                          onChange={(e) => setCustomMulliganRules({...customMulliganRules, mulliganMaxLands: e.target.checked})}
                        />
                        <span style={{ marginLeft: '8px', fontSize: '0.875rem' }}>Mulligan if more than </span>
                        <input
                          type="number"
                          value={customMulliganRules.maxLandsThreshold}
                          onChange={(e) => setCustomMulliganRules({...customMulliganRules, maxLandsThreshold: parseInt(e.target.value)})}
                          min="0"
                          max="7"
                          style={{ width: '50px', marginLeft: '5px', padding: '4px', borderRadius: '4px', border: '1px solid #e5e7eb' }}
                        />
                        <span style={{ marginLeft: '5px', fontSize: '0.875rem' }}>lands</span>
                      </label>
                      
                      <label style={{ display: 'block', marginBottom: '8px' }}>
                        <input
                          type="checkbox"
                          checked={customMulliganRules.mulliganNoPlaysByTurn}
                          onChange={(e) => setCustomMulliganRules({...customMulliganRules, mulliganNoPlaysByTurn: e.target.checked})}
                        />
                        <span style={{ marginLeft: '8px', fontSize: '0.875rem' }}>Mulligan if no plays by turn </span>
                        <input
                          type="number"
                          value={customMulliganRules.noPlaysTurnThreshold}
                          onChange={(e) => setCustomMulliganRules({...customMulliganRules, noPlaysTurnThreshold: parseInt(e.target.value)})}
                          min="1"
                          max="5"
                          style={{ width: '50px', marginLeft: '5px', padding: '4px', borderRadius: '4px', border: '1px solid #e5e7eb' }}
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={runSimulation}
              disabled={isSimulating}
              style={{
                marginTop: '20px',
                background: isSimulating ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '15px 30px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '1.125rem',
                fontWeight: 600,
                cursor: isSimulating ? 'not-allowed' : 'pointer',
                width: '100%'
              }}
            >
              {isSimulating ? '⏳ Simulating...' : '🎲 Start Simulation'}
            </button>
          </div>
        </div>
      )}

      {/* Results Section */}
      {simulationResults && chartData  && (
        <div id="results-section">
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ marginTop: 0 }}>📊 Simulation Results</h3>
            <p>Iterations: {iterations.toLocaleString()}</p>
            <p>Hands Kept: {simulationResults.handsKept.toLocaleString()}</p>
            {enableMulligans && (
              <p>Mulligan Rate: {iterations > 0 ? ((simulationResults.mulligans / iterations) * 100).toFixed(1) : 0}%</p>
            )}
            
            <button
              onClick={exportResultsAsPNG}
              style={{
                marginTop: '10px',
                background: '#22c55e',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              📸 Export Results as PNG
            </button>
          </div>

          {/* Charts */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h3>Lands per Turn</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.landsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="turn" label={{ value: 'Turn', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Total Lands" stroke="#667eea" strokeWidth={2} />
                <Line type="monotone" dataKey="Untapped Lands" stroke="#22c55e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h3>Available Mana by Color</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.manaByColorData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="turn" label={{ value: 'Turn', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Mana', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Total Mana" stroke="#7c3aed" strokeWidth={3} />
                <Line type="monotone" dataKey="W" stroke="#fcd34d" strokeWidth={2} />
                <Line type="monotone" dataKey="U" stroke="#60a5fa" strokeWidth={2} />
                <Line type="monotone" dataKey="B" stroke="#6b7280" strokeWidth={2} />
                <Line type="monotone" dataKey="R" stroke="#f87171" strokeWidth={2} />
                <Line type="monotone" dataKey="G" stroke="#4ade80" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h3>Cumulative Life Loss</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.lifeLossData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="turn" label={{ value: 'Turn', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Life Loss', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Life Loss" stroke="#dc2626" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {selectedKeyCards.size > 0 && (
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3>Key Cards Playability (%)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData.keyCardsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="turn" label={{ value: 'Turn', position: 'insideBottom', offset: -5 }} />
                  <YAxis label={{ value: 'Playable (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  {Array.from(selectedKeyCards).map((cardName, idx) => {
                    const colors = ['#667eea', '#f59e0b', '#22c55e', '#dc2626', '#60a5fa'];
                    return (
                      <Line 
                        key={cardName}
                        type="monotone" 
                        dataKey={cardName} 
                        stroke={colors[idx % colors.length]} 
                        strokeWidth={2} 
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Play Sequences for Selected Turn */}
          {Object.keys(simulationResults.fastestPlaySequences).length > 0 && (
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3>⚡ Play Sequences for Turn {selectedTurnForSequences}</h3>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '15px' }}>
                Showing example hands that can play key cards on turn {selectedTurnForSequences}
              </p>
              
              {Object.entries(simulationResults.fastestPlaySequences).map(([cardName, sequencesByTurn]) => {
                const sequencesForTurn = sequencesByTurn[selectedTurnForSequences];
                
                // Skip if no sequences exist for this turn
                if (!sequencesForTurn || sequencesForTurn.length === 0) {
                  return (
                    <div key={cardName} style={{ marginBottom: '25px' }}>
                      <h4 style={{ 
                        margin: '0 0 10px 0', 
                        fontSize: '1.1rem', 
                        color: '#667eea',
                        borderBottom: '2px solid #667eea',
                        paddingBottom: '8px'
                      }}>
                        {cardName}
                      </h4>
                      <p style={{ 
                        fontSize: '0.875rem', 
                        color: '#9ca3af', 
                        fontStyle: 'italic',
                        padding: '15px',
                        background: '#f9fafb',
                        borderRadius: '8px'
                      }}>
                        No sequences found for turn {selectedTurnForSequences}. This card was not playable on this turn in any simulated games.
                      </p>
                    </div>
                  );
                }
                
                return (
                  <div key={cardName} style={{ marginBottom: '25px' }}>
                    <h4 style={{ 
                      margin: '0 0 15px 0', 
                      fontSize: '1.1rem', 
                      color: '#667eea',
                      borderBottom: '2px solid #667eea',
                      paddingBottom: '8px'
                    }}>
                      {cardName}
                    </h4>
                    
                    {sequencesForTurn.map((data, seqIdx) => (
                      <div key={seqIdx} style={{ 
                        marginBottom: '15px', 
                        padding: '15px', 
                        background: '#f9fafb', 
                        borderRadius: '8px',
                        border: '2px solid #e5e7eb'
                      }}>
                        <p style={{ margin: '0 0 10px 0', fontSize: '0.875rem', color: '#6b7280' }}>
                          <strong>Example {seqIdx + 1}:</strong> Playable on turn {data.turn} ({data.manaAvailable} mana available)
                        </p>
                        
                        {/* Opening Hand */}
                        <div style={{ marginBottom: '12px', padding: '10px', background: 'white', borderRadius: '6px' }}>
                          <p style={{ fontWeight: 600, margin: '0 0 6px 0', fontSize: '0.85rem', color: '#374151' }}>
                            Opening Hand:
                          </p>
                          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                            {data.openingHand.join(', ')}
                          </div>
                        </div>
                        
                        {/* Turn by Turn */}
                        <div>
                          <p style={{ fontWeight: 600, marginBottom: '8px', fontSize: '0.9rem' }}>Turn-by-turn sequence:</p>
                          {data.sequence && data.sequence.map((turnLog, idx) => (
                            <div key={idx} style={{ 
                              marginBottom: '8px',
                              paddingLeft: '10px',
                              borderLeft: '3px solid #667eea'
                            }}>
                              <p style={{ 
                                margin: '0 0 4px 0', 
                                fontWeight: 600, 
                                fontSize: '0.85rem',
                                color: '#374151'
                              }}>
                                Turn {turnLog.turn}:
                              </p>
                              {turnLog.actions.length > 0 ? (
                                <ul style={{ 
                                  margin: '0', 
                                  paddingLeft: '20px',
                                  fontSize: '0.8rem',
                                  color: '#6b7280'
                                }}>
                                  {turnLog.actions.map((action, actionIdx) => (
                                    <li key={actionIdx}>{action}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af', fontStyle: 'italic' }}>
                                  No actions
                                </p>
                              )}
                              {turnLog.lifeLoss > 0 && (
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#dc2626' }}>
                                  Life lost this turn: {turnLog.lifeLoss}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Comparison Mode Results */}

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        padding: '20px',
        color: '#6b7280',
        fontSize: '0.875rem'
      }}>
        <p>All card data © Wizards of the Coast</p>
      </div>
    </div>
  );
};

export default MTGMonteCarloAnalyzer;
